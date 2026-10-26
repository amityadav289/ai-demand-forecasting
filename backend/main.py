"""FastAPI application: all API routes live here to keep the project easy to follow."""
import csv
import io
import os
import shutil
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import ml_service
from auth import create_token, get_current_user, hash_password, verify_password
from database import Base, SessionLocal, UPLOAD_DIR, engine, get_db
from models import ModelMetric, Prediction, Product, Sale, User
from schemas import LoginIn, PredictIn, ProductIn, SaleIn, SetupIn, StockUpdateIn

load_dotenv()
Base.metadata.create_all(bind=engine)

MAX_UPLOAD_MB = 10

@asynccontextmanager
async def lifespan(_app):
    bootstrap_admin()
    yield


app = FastAPI(title="AI Demand Forecasting & Inventory Optimization", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup: optionally create the admin from environment variables
# ---------------------------------------------------------------------------
def bootstrap_admin():
    username = os.getenv("ADMIN_USERNAME")
    password = os.getenv("ADMIN_PASSWORD")
    if not username or not password:
        return
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(User(username=username.strip(), password_hash=hash_password(password)))
            db.commit()
    finally:
        db.close()


@app.exception_handler(SQLAlchemyError)
def db_error_handler(request, exc):
    return JSONResponse(status_code=500, content={"detail": "Database error. Please try again."})


@app.exception_handler(ml_service.MLError)
def ml_error_handler(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def stock_status(stock: int, minimum: int) -> str:
    if stock <= 0:
        return "out_of_stock"
    if stock <= minimum:
        return "low_stock"
    return "in_stock"


def product_dict(p: Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "price": p.price,
        "stock": p.stock,
        "minimum_stock": p.minimum_stock,
        "status": stock_status(p.stock, p.minimum_stock),
    }


def get_product_or_404(db: Session, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


def csv_response(filename: str, header: list, rows: list) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Health + authentication
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    return {"status": "ok", "admin_exists": db.query(User).count() > 0}


@app.post("/api/setup")
def first_time_setup(data: SetupIn, db: Session = Depends(get_db)):
    """Create the single admin account. Works only while no admin exists."""
    if db.query(User).count() > 0:
        raise HTTPException(status_code=403, detail="Admin account already exists")
    db.add(User(username=data.username.strip(), password_hash=hash_password(data.password)))
    db.commit()
    return {"message": "Admin account created. You can now log in."}


@app.post("/api/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username.strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"token": create_token(user.username), "username": user.username}


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
@app.get("/api/products")
def list_products(search: str = "", db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Product)
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.filter((Product.name.ilike(like)) | (Product.category.ilike(like)))
    return [product_dict(p) for p in q.order_by(Product.id.desc()).all()]


@app.post("/api/products", status_code=201)
def create_product(data: ProductIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = Product(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return product_dict(p)


@app.put("/api/products/{product_id}")
def update_product(product_id: int, data: ProductIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = get_product_or_404(db, product_id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return product_dict(p)


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = get_product_or_404(db, product_id)
    # Sales rows point to the product, so they are removed with it.
    db.query(Sale).filter(Sale.product_id == product_id).delete()
    db.delete(p)
    db.commit()
    return {"message": "Product deleted"}


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
@app.get("/api/inventory")
def inventory(db: Session = Depends(get_db), _=Depends(get_current_user)):
    items = [product_dict(p) for p in db.query(Product).order_by(Product.name).all()]
    return {
        "items": items,
        "low_stock": sum(1 for i in items if i["status"] == "low_stock"),
        "out_of_stock": sum(1 for i in items if i["status"] == "out_of_stock"),
    }


@app.put("/api/inventory/{product_id}")
def update_stock(product_id: int, data: StockUpdateIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = get_product_or_404(db, product_id)
    if data.action == "add":
        new_stock = p.stock + data.quantity
    elif data.action == "reduce":
        new_stock = p.stock - data.quantity
        if new_stock < 0:
            raise HTTPException(status_code=400, detail=f"Cannot reduce by {data.quantity}: only {p.stock} in stock")
    else:  # set
        new_stock = data.quantity
    p.stock = new_stock
    db.commit()
    db.refresh(p)
    return product_dict(p)


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------
@app.get("/api/sales")
def list_sales(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = (
        db.query(Sale, Product.name)
        .join(Product, Product.id == Sale.product_id)
        .order_by(Sale.date.desc(), Sale.id.desc())
        .all()
    )
    sales = [
        {
            "id": s.id,
            "product_id": s.product_id,
            "product_name": name,
            "date": s.date.isoformat(),
            "quantity": s.quantity,
            "selling_price": s.selling_price,
            "total": round(s.quantity * s.selling_price, 2),
        }
        for s, name in rows
    ]
    by_day = {}
    for s in sales:
        d = by_day.setdefault(s["date"], {"date": s["date"], "revenue": 0.0, "units": 0})
        d["revenue"] += s["total"]
        d["units"] += s["quantity"]
    chart = sorted(by_day.values(), key=lambda x: x["date"])
    for c in chart:
        c["revenue"] = round(c["revenue"], 2)
    return {
        "sales": sales,
        "total_revenue": round(sum(s["total"] for s in sales), 2),
        "total_units": sum(s["quantity"] for s in sales),
        "chart": chart,
    }


@app.post("/api/sales", status_code=201)
def add_sale(data: SaleIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = get_product_or_404(db, data.product_id)
    if data.quantity > p.stock:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough stock for {p.name}: requested {data.quantity}, available {p.stock}",
        )
    price = data.selling_price if data.selling_price is not None else p.price
    sale = Sale(product_id=p.id, date=data.date, quantity=data.quantity, selling_price=price)
    p.stock -= data.quantity  # sale and stock change are saved together
    db.add(sale)
    db.commit()
    return {"message": "Sale recorded", "remaining_stock": p.stock}


# ---------------------------------------------------------------------------
# Dataset upload
# ---------------------------------------------------------------------------
@app.post("/api/dataset/upload")
def upload_dataset(file: UploadFile = File(...), _=Depends(get_current_user)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are allowed")
    tmp_path = os.path.join(UPLOAD_DIR, "_incoming.csv")
    size = 0
    with open(tmp_path, "wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_MB * 1024 * 1024:
                out.close()
                os.remove(tmp_path)
                raise HTTPException(status_code=400, detail=f"File is larger than {MAX_UPLOAD_MB} MB")
            out.write(chunk)
    try:
        df = ml_service.validate_csv(tmp_path)  # raises MLError for bad files
    except ml_service.MLError:
        os.remove(tmp_path)
        raise
    shutil.move(tmp_path, ml_service.DATASET_PATH)
    # NOTE: uploading historical data never touches product stock.
    return {"message": "Dataset uploaded", "filename": file.filename, **ml_service.dataset_summary(df)}


@app.get("/api/dataset/preview")
def dataset_preview(_=Depends(get_current_user)):
    if not os.path.exists(ml_service.DATASET_PATH):
        return {"exists": False}
    df = ml_service.validate_csv(ml_service.DATASET_PATH)
    return {"exists": True, **ml_service.dataset_summary(df)}


# ---------------------------------------------------------------------------
# Machine learning
# ---------------------------------------------------------------------------
@app.post("/api/ml/train")
def train(db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not os.path.exists(ml_service.DATASET_PATH):
        raise HTTPException(status_code=400, detail="No dataset found. Please upload a CSV first.")
    out = ml_service.train_models()
    trained_at = datetime.utcnow()
    for r in out["results"]:
        db.add(
            ModelMetric(
                model_name=r["model_name"], mae=r["mae"], mse=r["mse"],
                rmse=r["rmse"], r2_score=r["r2_score"], trained_at=trained_at,
            )
        )
    db.commit()
    return {
        "message": f"Training complete. Best model: {out['best_model']}",
        "best_model": out["best_model"],
        "results": out["results"],
        "train_rows": out["meta"]["train_rows"],
        "test_rows": out["meta"]["test_rows"],
    }


@app.get("/api/ml/metrics")
def ml_metrics(db: Session = Depends(get_db), _=Depends(get_current_user)):
    meta = ml_service.load_meta()
    latest = db.query(func.max(ModelMetric.trained_at)).scalar()
    if not meta or not latest:
        return {"trained": False}
    rows = db.query(ModelMetric).filter(ModelMetric.trained_at == latest).all()
    return {
        "trained": True,
        "best_model": meta["best_model"],
        "trained_at": latest.isoformat(),
        "train_rows": meta["train_rows"],
        "test_rows": meta["test_rows"],
        "selection_metric": meta["selection_metric"],
        "metrics": [
            {"model_name": m.model_name, "mae": m.mae, "mse": m.mse, "rmse": m.rmse, "r2_score": m.r2_score}
            for m in rows
        ],
        "actual_vs_predicted": meta["actual_vs_predicted"],
    }


@app.post("/api/ml/predict")
def predict(data: PredictIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    units, model_name = ml_service.predict_units(
        data.item_id, data.store_id, data.item_base_price, data.discount_applied,
        data.store_footfall, data.is_holiday, data.past_week_sales,
    )
    db.add(Prediction(item_id=data.item_id.strip(), store_id=data.store_id.strip(),
                      predicted_units=units, model_name=model_name))
    db.commit()

    result = {
        "predicted_units": units,
        "model_name": model_name,
        "safety_stock": data.safety_stock,
        "current_stock": None,
        "stock_status": None,
        "product_name": None,
        "recommended_reorder": None,
    }
    if data.product_id is not None:
        p = get_product_or_404(db, data.product_id)
        result.update(
            current_stock=p.stock,
            product_name=p.name,
            stock_status=stock_status(p.stock, p.minimum_stock),
            recommended_reorder=ml_service.reorder_quantity(units, p.stock, data.safety_stock),
        )
    return result


@app.get("/api/ml/status")
def ml_status(_=Depends(get_current_user)):
    meta = ml_service.load_meta()
    return {
        "trained": ml_service.model_is_trained(),
        "best_model": meta["best_model"] if meta else None,
        "dataset_uploaded": os.path.exists(ml_service.DATASET_PATH),
    }


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    products = db.query(Product).all()
    total_stock = sum(p.stock for p in products)
    inventory_value = sum(p.stock * p.price for p in products)
    low = [p for p in products if stock_status(p.stock, p.minimum_stock) != "in_stock"]

    sales = db.query(Sale).all()
    total_sales_revenue = sum(s.quantity * s.selling_price for s in sales)
    total_units_sold = sum(s.quantity for s in sales)

    # Sales overview: revenue per day for the 30 most recent days with sales
    by_day = {}
    for s in sales:
        by_day[s.date.isoformat()] = by_day.get(s.date.isoformat(), 0) + s.quantity * s.selling_price
    sales_chart = [{"date": d, "revenue": round(v, 2)} for d, v in sorted(by_day.items())][-30:]

    # Inventory distribution: stock per category
    by_cat = {}
    for p in products:
        by_cat[p.category] = by_cat.get(p.category, 0) + p.stock
    inventory_chart = [{"category": c, "stock": s} for c, s in sorted(by_cat.items())]

    recent_preds = db.query(Prediction).order_by(Prediction.id.desc()).limit(5).all()
    meta = ml_service.load_meta()

    return {
        "cards": {
            "total_products": len(products),
            "total_stock": total_stock,
            "inventory_value": round(inventory_value, 2),
            "total_sales": round(total_sales_revenue, 2),
            "total_units_sold": total_units_sold,
            "low_stock_products": len(low),
            "latest_predicted_demand": recent_preds[0].predicted_units if recent_preds else None,
        },
        "sales_chart": sales_chart,
        "inventory_chart": inventory_chart,
        "actual_vs_predicted": meta["actual_vs_predicted"][:30] if meta else [],
        "model_name": meta["best_model"] if meta else None,
        "recent_products": [product_dict(p) for p in sorted(products, key=lambda x: -x.id)[:5]],
        "low_stock_alerts": [product_dict(p) for p in low][:8],
        "recent_predictions": [
            {
                "id": r.id, "item_id": r.item_id, "store_id": r.store_id,
                "predicted_units": r.predicted_units, "model_name": r.model_name,
                "created_at": r.created_at.isoformat(),
            }
            for r in recent_preds
        ],
    }


# ---------------------------------------------------------------------------
# Reports (CSV downloads)
# ---------------------------------------------------------------------------
@app.get("/api/reports/inventory")
def report_inventory(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = [
        [p.id, p.name, p.category, p.price, p.stock, p.minimum_stock,
         stock_status(p.stock, p.minimum_stock), round(p.price * p.stock, 2)]
        for p in db.query(Product).order_by(Product.id).all()
    ]
    return csv_response(
        "inventory_report.csv",
        ["Product ID", "Name", "Category", "Price", "Stock", "Minimum Stock", "Status", "Stock Value"],
        rows,
    )


@app.get("/api/reports/sales")
def report_sales(db: Session = Depends(get_db), _=Depends(get_current_user)):
    data = (
        db.query(Sale, Product.name).join(Product, Product.id == Sale.product_id)
        .order_by(Sale.date, Sale.id).all()
    )
    rows = [[s.id, name, s.date.isoformat(), s.quantity, s.selling_price, round(s.quantity * s.selling_price, 2)]
            for s, name in data]
    return csv_response(
        "sales_report.csv",
        ["Sale ID", "Product", "Date", "Quantity", "Selling Price", "Total"],
        rows,
    )


@app.get("/api/reports/predictions")
def report_predictions(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = [
        [r.id, r.item_id, r.store_id, r.predicted_units, r.model_name, r.created_at.isoformat()]
        for r in db.query(Prediction).order_by(Prediction.id).all()
    ]
    return csv_response(
        "prediction_history.csv",
        ["ID", "Item ID", "Store ID", "Predicted Units", "Model", "Created At"],
        rows,
    )


@app.get("/api/predictions")
def prediction_history(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [
        {
            "id": r.id, "item_id": r.item_id, "store_id": r.store_id,
            "predicted_units": r.predicted_units, "model_name": r.model_name,
            "created_at": r.created_at.isoformat(),
        }
        for r in db.query(Prediction).order_by(Prediction.id.desc()).limit(50).all()
    ]
