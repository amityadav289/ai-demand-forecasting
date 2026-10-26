"""Machine Learning service: dataset validation, training, evaluation and prediction.

Design notes (kept simple on purpose):
- One scikit-learn Pipeline per model = preprocessing + estimator, so training and
  prediction always use exactly the same transformations (no train/serve mismatch).
- All imputing / scaling / encoding is fitted ONLY on the training split (no data leakage).
- The best model is chosen by cross-validated RMSE on the TRAINING split, so the
  held-out test set is only used once, for the final reported metrics.
"""
import json
import os
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

from database import MODEL_DIR, UPLOAD_DIR

CATEGORICAL = ["Item_ID", "Store_ID"]
NUMERIC = ["Item_Base_Price", "Discount_Applied", "Store_Footfall", "Is_Holiday", "Past_Week_Sales"]
TARGET = "Units_Sold"
REQUIRED_COLUMNS = CATEGORICAL + NUMERIC + [TARGET]
MIN_ROWS = 30

DATASET_PATH = os.path.join(UPLOAD_DIR, "dataset.csv")
MODEL_PATH = os.path.join(MODEL_DIR, "best_model.joblib")
META_PATH = os.path.join(MODEL_DIR, "model_meta.json")


class MLError(Exception):
    """Friendly error that the API turns into a clear message for the user."""


# ----------------------------------------------------------------------------
# Dataset helpers
# ----------------------------------------------------------------------------
def validate_csv(path: str) -> pd.DataFrame:
    """Read the CSV and make sure it has what we need. Raises MLError otherwise."""
    try:
        df = pd.read_csv(path)
    except Exception:
        raise MLError("Could not read the file. Please upload a valid CSV file.")
    if df.empty:
        raise MLError("The CSV file is empty.")
    df.columns = [str(c).strip() for c in df.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise MLError(f"Missing required columns: {', '.join(missing)}")
    return df


def dataset_summary(df: pd.DataFrame, preview_rows: int = 10) -> dict:
    missing = {c: int(df[c].isna().sum()) for c in df.columns}
    preview = df.head(preview_rows).astype(object).where(df.head(preview_rows).notna(), None)
    return {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "column_names": list(df.columns),
        "missing_values": missing,
        "total_missing": int(sum(missing.values())),
        "duplicate_rows": int(df.duplicated().sum()),
        "preview": preview.to_dict(orient="records"),
    }


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Duplicate removal + type fixing + dropping rows with no usable target."""
    df = df[REQUIRED_COLUMNS].copy()
    df = df.drop_duplicates()
    for col in NUMERIC + [TARGET]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    for col in CATEGORICAL:
        df[col] = df[col].astype("string").str.strip()
        df[col] = df[col].fillna("unknown").astype(str)
    # Rows without a target cannot be used for supervised learning.
    df = df.dropna(subset=[TARGET])
    df = df[df[TARGET] >= 0]
    return df.reset_index(drop=True)


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
def _preprocessor() -> ColumnTransformer:
    numeric_pipe = Pipeline(
        [("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]
    )
    categorical_pipe = Pipeline(
        [
            ("impute", SimpleImputer(strategy="constant", fill_value="unknown")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        [("num", numeric_pipe, NUMERIC), ("cat", categorical_pipe, CATEGORICAL)]
    )


def _build_models() -> dict:
    return {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(
            n_estimators=100, max_depth=12, min_samples_leaf=2, random_state=42, n_jobs=1
        ),
        "XGBoost": XGBRegressor(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=5,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            n_jobs=1,
            verbosity=0,
        ),
    }


def train_models(csv_path: str = DATASET_PATH) -> dict:
    """Train the three models, evaluate them, save the best pipeline. Returns a result dict."""
    raw = validate_csv(csv_path)
    df = clean_dataset(raw)
    if len(df) < MIN_ROWS:
        raise MLError(
            f"Not enough usable rows after cleaning ({len(df)}). At least {MIN_ROWS} are required."
        )

    X = df[CATEGORICAL + NUMERIC]
    y = df[TARGET]
    # No date column exists, so a random 80/20 split is used.
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    cv = KFold(n_splits=3, shuffle=True, random_state=42)
    results = []
    fitted = {}
    for name, estimator in _build_models().items():
        pipe = Pipeline([("prep", _preprocessor()), ("model", estimator)])
        try:
            cv_rmse = float(
                -cross_val_score(
                    pipe, X_train, y_train, cv=cv, scoring="neg_root_mean_squared_error"
                ).mean()
            )
            pipe.fit(X_train, y_train)
            pred = pipe.predict(X_test)
        except Exception as exc:  # keep the API alive on odd data
            raise MLError(f"Training failed for {name}: {exc}")
        mse = float(mean_squared_error(y_test, pred))
        results.append(
            {
                "model_name": name,
                "mae": float(mean_absolute_error(y_test, pred)),
                "mse": mse,
                "rmse": float(np.sqrt(mse)),
                "r2_score": float(r2_score(y_test, pred)),
                "cv_rmse": cv_rmse,
            }
        )
        fitted[name] = (pipe, pred)

    best = min(results, key=lambda r: r["cv_rmse"])
    best_name = best["model_name"]
    best_pipe, best_pred = fitted[best_name]

    joblib.dump(best_pipe, MODEL_PATH)

    # Sample of actual vs predicted values for the performance chart.
    n = min(100, len(y_test))
    actual_vs_pred = [
        {"index": i + 1, "actual": float(a), "predicted": float(max(0, p))}
        for i, (a, p) in enumerate(zip(y_test.values[:n], best_pred[:n]))
    ]
    meta = {
        "best_model": best_name,
        "trained_at": datetime.utcnow().isoformat(),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "rows_removed_in_cleaning": int(len(raw) - len(df)),
        "selection_metric": "3-fold cross-validated RMSE on the training split",
        "known_items": sorted(df["Item_ID"].unique().tolist())[:500],
        "known_stores": sorted(df["Store_ID"].unique().tolist())[:500],
        "actual_vs_predicted": actual_vs_pred,
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f)

    return {"results": results, "best_model": best_name, "meta": meta}


def load_meta() -> dict | None:
    if not os.path.exists(META_PATH):
        return None
    with open(META_PATH) as f:
        return json.load(f)


def model_is_trained() -> bool:
    return os.path.exists(MODEL_PATH) and os.path.exists(META_PATH)


def predict_units(item_id, store_id, base_price, discount, footfall, is_holiday, past_week_sales):
    """Load the saved pipeline and return (whole-number demand, model name)."""
    if not model_is_trained():
        raise MLError("The model is not trained yet. Upload a dataset and train a model first.")
    try:
        pipe = joblib.load(MODEL_PATH)
        row = pd.DataFrame(
            [
                {
                    "Item_ID": str(item_id).strip(),
                    "Store_ID": str(store_id).strip(),
                    "Item_Base_Price": float(base_price),
                    "Discount_Applied": float(discount),
                    "Store_Footfall": float(footfall),
                    "Is_Holiday": float(is_holiday),
                    "Past_Week_Sales": float(past_week_sales),
                }
            ]
        )[CATEGORICAL + NUMERIC]
        raw = float(pipe.predict(row)[0])
    except MLError:
        raise
    except Exception as exc:
        raise MLError(f"Prediction failed: {exc}")
    units = max(0, int(round(raw)))
    return units, load_meta()["best_model"]


def reorder_quantity(predicted: int, current_stock: int, safety_stock: int) -> int:
    """max(0, Predicted Demand + Safety Stock - Current Stock)"""
    return max(0, int(predicted) + int(safety_stock) - int(current_stock))
