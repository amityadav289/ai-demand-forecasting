"""Pydantic request/response schemas with input validation."""
from datetime import date as date_type
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LoginIn(BaseModel):
    username: str
    password: str


class SetupIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(default="General", max_length=60)
    price: float = Field(ge=0)
    stock: int = Field(ge=0)
    minimum_stock: int = Field(ge=0)

    @field_validator("name", "category")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v


class StockUpdateIn(BaseModel):
    # action: "add" | "reduce" | "set"
    action: str
    quantity: int = Field(ge=0)

    @field_validator("action")
    @classmethod
    def check_action(cls, v: str) -> str:
        if v not in ("add", "reduce", "set"):
            raise ValueError("action must be add, reduce or set")
        return v


class SaleIn(BaseModel):
    product_id: int
    date: date_type
    quantity: int = Field(gt=0)
    selling_price: Optional[float] = Field(default=None, ge=0)


class PredictIn(BaseModel):
    item_id: str = Field(min_length=1)
    store_id: str = Field(min_length=1)
    item_base_price: float = Field(ge=0)
    discount_applied: float = Field(ge=0)
    store_footfall: float = Field(ge=0)
    is_holiday: int = Field(ge=0, le=1)
    past_week_sales: float = Field(ge=0)
    safety_stock: int = Field(default=0, ge=0)
    product_id: Optional[int] = None  # optional link to a product for stock lookup
