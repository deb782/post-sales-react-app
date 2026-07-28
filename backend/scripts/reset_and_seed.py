"""Wipe all app collections and seed a single admin user."""
import asyncio
import os
import secrets
import string
import sys
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

ADMIN_EMAIL = "sales@agrocorp.co.in"
ADMIN_NAME = "Agrocorp Admin"

COLLECTIONS = [
    "users", "projects", "units", "unit_types", "revenue_targets",
    "expenses", "payments", "stock_items", "stock_movements",
    "audit_logs", "notifications", "login_attempts", "settings",
    "files", "invoices", "vendors", "invites",
]


def gen_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pw)
                and any(c.isupper() for c in pw)
                and any(c.isdigit() for c in pw)):
            return pw


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


async def main() -> str:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Wipe every known collection
    existing = await db.list_collection_names()
    for name in set(existing) | set(COLLECTIONS):
        await db[name].drop()

    temp_pw = gen_password()
    password_hash = bcrypt.hashpw(
        temp_pw.encode(), bcrypt.gensalt()).decode()

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    admin_doc = {
        "user_id": new_id("user"),
        "email": ADMIN_EMAIL,
        "name": ADMIN_NAME,
        "phone": None,
        "picture": None,
        "role": "admin",
        "project_ids": [],
        "password_hash": password_hash,
        "must_reset_password": True,
        "dashboard_config": None,
        "is_active": True,
        "onboarding_completed": False,
        "created_at": now_iso,
    }
    await db.users.insert_one(admin_doc)

    print("=== DATABASE RESET COMPLETE ===")
    print(f"Admin email : {ADMIN_EMAIL}")
    print(f"Temp password: {temp_pw}")
    return temp_pw


if __name__ == "__main__":
    pw = asyncio.run(main())
    sys.stdout.write(f"\nTEMP_PW={pw}\n")
