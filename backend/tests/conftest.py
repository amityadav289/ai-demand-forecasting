"""Test setup: use a temporary database/model/upload folder so real data is never touched."""
import os
import sys
import tempfile

_tmp = tempfile.mkdtemp(prefix="forecast_tests_")
os.environ["DATABASE_PATH"] = os.path.join(_tmp, "test.db")
os.environ["MODEL_DIR"] = os.path.join(_tmp, "models")
os.environ["UPLOAD_DIR"] = os.path.join(_tmp, "uploads")
os.environ["AUTH_SECRET"] = "test-secret-key-at-least-16-chars"
os.environ.pop("ADMIN_USERNAME", None)
os.environ.pop("ADMIN_PASSWORD", None)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
