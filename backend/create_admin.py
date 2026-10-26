"""Create the single admin account from the command line.

Usage:  python create_admin.py
The password is typed in the terminal (hidden) and is stored only as a bcrypt hash.
"""
import getpass
import sys

from auth import hash_password
from database import Base, SessionLocal, engine
from models import User

Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    if db.query(User).count() > 0:
        print("An admin account already exists. Nothing to do.")
        sys.exit(0)
    username = input("Admin username: ").strip()
    password = getpass.getpass("Admin password (min 6 chars): ")
    if len(username) < 3 or len(password) < 6:
        print("Username must be 3+ chars and password 6+ chars.")
        sys.exit(1)
    if password != getpass.getpass("Repeat password: "):
        print("Passwords do not match.")
        sys.exit(1)
    db.add(User(username=username, password_hash=hash_password(password)))
    db.commit()
    print("Admin account created.")
finally:
    db.close()
