"""SQLAlchemy table definitions (exactly the 5 tables from the project spec)."""
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String

from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False, default="General")
    price = Column(Float, nullable=False, default=0)
    stock = Column(Integer, nullable=False, default=0)
    minimum_stock = Column(Integer, nullable=False, default=0)


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    selling_price = Column(Float, nullable=False)


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(String, nullable=False)
    store_id = Column(String, nullable=False)
    predicted_units = Column(Integer, nullable=False)
    model_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ModelMetric(Base):
    __tablename__ = "model_metrics"
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, nullable=False)
    mae = Column(Float, nullable=False)
    mse = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    r2_score = Column(Float, nullable=False)
    trained_at = Column(DateTime, default=datetime.utcnow)
