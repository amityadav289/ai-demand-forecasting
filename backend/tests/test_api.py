"""End-to-end API tests. Run with:  pytest -v"""
import io
import os

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)
SAMPLE = os.path.join(os.path.dirname(__file__), "..", "..", "sample_data", "sample_dataset.csv")


@pytest.fixture(scope="module")
def auth():
    r = client.post("/api/setup", json={"username": "admin", "password": "secret123"})
    assert r.status_code == 200
    r = client.post("/api/login", json={"username": "admin", "password": "secret123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_setup_only_once(auth):
    # the auth fixture already created the admin, so a second setup must be refused
    r = client.post("/api/setup", json={"username": "other", "password": "secret123"})
    assert r.status_code == 403


def test_invalid_login(auth):
    r = client.post("/api/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_protected_routes_need_token():
    assert client.get("/api/products").status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_password_is_hashed(auth):
    from database import SessionLocal
    from models import User

    db = SessionLocal()
    u = db.query(User).first()
    assert u.password_hash != "secret123" and u.password_hash.startswith("$2")
    db.close()


def test_empty_dashboard(auth):
    r = client.get("/api/dashboard", headers=auth)
    assert r.status_code == 200
    assert r.json()["cards"]["total_products"] == 0
    assert r.json()["cards"]["latest_predicted_demand"] is None


def test_product_crud_and_validation(auth):
    bad = client.post("/api/products", headers=auth,
                      json={"name": "X", "category": "A", "price": -5, "stock": 1, "minimum_stock": 1})
    assert bad.status_code == 422
    bad = client.post("/api/products", headers=auth,
                      json={"name": "X", "category": "A", "price": 5, "stock": -1, "minimum_stock": 1})
    assert bad.status_code == 422

    r = client.post("/api/products", headers=auth,
                    json={"name": "Widget", "category": "Tools", "price": 10.5, "stock": 50, "minimum_stock": 10})
    assert r.status_code == 201
    pid = r.json()["id"]
    assert r.json()["status"] == "in_stock"

    assert len(client.get("/api/products?search=widg", headers=auth).json()) == 1
    assert client.get("/api/products?search=zzz", headers=auth).json() == []

    r = client.put(f"/api/products/{pid}", headers=auth,
                   json={"name": "Widget Pro", "category": "Tools", "price": 12, "stock": 50, "minimum_stock": 10})
    assert r.status_code == 200 and r.json()["name"] == "Widget Pro"

    assert client.put("/api/products/9999", headers=auth,
                      json={"name": "n", "category": "c", "price": 1, "stock": 1, "minimum_stock": 1}).status_code == 404

    d = client.post("/api/products", headers=auth,
                    json={"name": "Temp", "category": "Tools", "price": 1, "stock": 1, "minimum_stock": 0}).json()["id"]
    assert client.delete(f"/api/products/{d}", headers=auth).status_code == 200
    assert client.delete(f"/api/products/{d}", headers=auth).status_code == 404


def test_inventory_updates(auth):
    pid = client.get("/api/products", headers=auth).json()[0]["id"]
    r = client.put(f"/api/inventory/{pid}", headers=auth, json={"action": "add", "quantity": 10})
    assert r.json()["stock"] == 60
    r = client.put(f"/api/inventory/{pid}", headers=auth, json={"action": "reduce", "quantity": 20})
    assert r.json()["stock"] == 40
    r = client.put(f"/api/inventory/{pid}", headers=auth, json={"action": "reduce", "quantity": 999})
    assert r.status_code == 400  # negative stock blocked
    r = client.put(f"/api/inventory/{pid}", headers=auth, json={"action": "set", "quantity": 8})
    assert r.json()["stock"] == 8 and r.json()["status"] == "low_stock"
    r = client.put(f"/api/inventory/{pid}", headers=auth, json={"action": "set", "quantity": 0})
    assert r.json()["status"] == "out_of_stock"
    client.put(f"/api/inventory/{pid}", headers=auth, json={"action": "set", "quantity": 40})
    inv = client.get("/api/inventory", headers=auth).json()
    assert "items" in inv


def test_sales_reduce_stock_and_block_oversell(auth):
    pid = client.get("/api/products", headers=auth).json()[0]["id"]
    r = client.post("/api/sales", headers=auth,
                    json={"product_id": pid, "date": "2026-10-01", "quantity": 5, "selling_price": 12})
    assert r.status_code == 201 and r.json()["remaining_stock"] == 35
    r = client.post("/api/sales", headers=auth,
                    json={"product_id": pid, "date": "2026-10-02", "quantity": 500})
    assert r.status_code == 400
    assert client.post("/api/sales", headers=auth,
                       json={"product_id": 9999, "date": "2026-10-02", "quantity": 1}).status_code == 404
    s = client.get("/api/sales", headers=auth).json()
    assert s["total_revenue"] == 60.0 and s["total_units"] == 5
    assert client.get("/api/products", headers=auth).json()[0]["stock"] == 35


def test_predict_before_training(auth):
    r = client.post("/api/ml/predict", headers=auth, json={
        "item_id": "ITEM001", "store_id": "STORE1", "item_base_price": 100, "discount_applied": 10,
        "store_footfall": 900, "is_holiday": 0, "past_week_sales": 60})
    assert r.status_code == 400 and "not trained" in r.json()["detail"].lower()
    assert client.get("/api/ml/metrics", headers=auth).json() == {"trained": False}
    assert client.post("/api/ml/train", headers=auth).status_code == 400  # no dataset yet


def test_invalid_csvs_rejected(auth):
    r = client.post("/api/dataset/upload", headers=auth, files={"file": ("a.txt", b"hi", "text/plain")})
    assert r.status_code == 400
    r = client.post("/api/dataset/upload", headers=auth,
                    files={"file": ("a.csv", b"Item_ID,Units_Sold\nA,1\n", "text/csv")})
    assert r.status_code == 400 and "Missing required columns" in r.json()["detail"]
    r = client.post("/api/dataset/upload", headers=auth, files={"file": ("a.csv", b"", "text/csv")})
    assert r.status_code == 400


def test_upload_train_predict_reorder(auth):
    with open(SAMPLE, "rb") as f:
        r = client.post("/api/dataset/upload", headers=auth, files={"file": ("sample.csv", f, "text/csv")})
    assert r.status_code == 200, r.text
    assert r.json()["rows"] == 1500 and r.json()["columns"] == 8
    stock_before = client.get("/api/products", headers=auth).json()[0]["stock"]

    prev = client.get("/api/dataset/preview", headers=auth).json()
    assert prev["exists"] and len(prev["preview"]) == 10

    r = client.post("/api/ml/train", headers=auth)
    assert r.status_code == 200, r.text
    res = r.json()
    names = {m["model_name"] for m in res["results"]}
    assert names == {"Linear Regression", "Random Forest", "XGBoost"}
    for m in res["results"]:
        assert m["rmse"] > 0 and m["mae"] > 0
        assert abs(m["rmse"] ** 2 - m["mse"]) < 1e-6
        assert m["r2_score"] < 1.0
    assert res["best_model"] in names
    assert res["train_rows"] == 1200 and res["test_rows"] == 300

    m = client.get("/api/ml/metrics", headers=auth).json()
    assert m["trained"] and len(m["metrics"]) == 3 and len(m["actual_vs_predicted"]) == 100

    # historical upload must not touch inventory
    assert client.get("/api/products", headers=auth).json()[0]["stock"] == stock_before

    pid = client.get("/api/products", headers=auth).json()[0]["id"]
    payload = {"item_id": "ITEM001", "store_id": "STORE1", "item_base_price": 100, "discount_applied": 10,
               "store_footfall": 900, "is_holiday": 0, "past_week_sales": 60, "safety_stock": 20, "product_id": pid}
    p = client.post("/api/ml/predict", headers=auth, json=payload)
    assert p.status_code == 200, p.text
    out = p.json()
    assert isinstance(out["predicted_units"], int) and out["predicted_units"] >= 0
    assert out["current_stock"] == stock_before
    expected = max(0, out["predicted_units"] + 20 - stock_before)
    assert out["recommended_reorder"] == expected

    # deterministic: same input -> same output (not random)
    assert client.post("/api/ml/predict", headers=auth, json=payload).json()["predicted_units"] == out["predicted_units"]

    # a higher "past week sales" should raise predicted demand on this data
    hi = client.post("/api/ml/predict", headers=auth, json={**payload, "past_week_sales": 150}).json()
    assert hi["predicted_units"] > out["predicted_units"]

    # unseen item still works (handle_unknown=ignore)
    assert client.post("/api/ml/predict", headers=auth, json={**payload, "item_id": "NEW_ITEM"}).status_code == 200

    # validation
    bad = client.post("/api/ml/predict", headers=auth, json={**payload, "is_holiday": 5})
    assert bad.status_code == 422


def test_reorder_formula_example():
    import ml_service
    assert ml_service.reorder_quantity(100, 60, 20) == 60
    assert ml_service.reorder_quantity(10, 60, 5) == 0


def test_dashboard_and_reports(auth):
    d = client.get("/api/dashboard", headers=auth).json()
    assert d["cards"]["total_products"] == 1
    assert d["cards"]["latest_predicted_demand"] is not None
    assert d["cards"]["total_sales"] == 60.0
    assert len(d["actual_vs_predicted"]) == 30 and d["recent_predictions"]
    for name, header in [("inventory", "Product ID"), ("sales", "Sale ID"), ("predictions", "Predicted Units")]:
        r = client.get(f"/api/reports/{name}", headers=auth)
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
        assert header in r.text.splitlines()[0]
        assert len(r.text.splitlines()) >= 2
