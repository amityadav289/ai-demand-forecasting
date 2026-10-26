"""Database setup (SQLite + SQLAlchemy). All paths come from environment variables."""
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

# Paths can be overridden with environment variables (useful on Render with a persistent disk).
DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "app.db"))
MODEL_DIR = os.getenv("MODEL_DIR", str(BASE_DIR / "ml_models"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))

for _d in (os.path.dirname(DATABASE_PATH) or ".", MODEL_DIR, UPLOAD_DIR):
    os.makedirs(_d, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DATABASE_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    """FastAPI dependency that gives each request its own DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
