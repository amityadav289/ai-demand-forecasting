"""Simple single-admin authentication: bcrypt password hashing + JWT tokens."""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User

load_dotenv()

SECRET_KEY = os.getenv("AUTH_SECRET", "")
ALGORITHM = "HS256"
TOKEN_HOURS = 12

bearer = HTTPBearer(auto_error=False)


def _secret() -> str:
    # No hardcoded secret: the app refuses to issue tokens without AUTH_SECRET.
    if not SECRET_KEY or len(SECRET_KEY) < 16:
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: set AUTH_SECRET (16+ characters) in the environment.",
        )
    return SECRET_KEY


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    try:
        data = jwt.decode(creds.credentials, _secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.username == data.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
