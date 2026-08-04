"""Wipe all app collections, seed a single admin user, and set default branding."""
import asyncio
import os
import secrets
import string
import sys
from pathlib import Path

import bcrypt
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "deb@agrocorp.co.in").lower()
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Agrocorp Admin")
ADMIN_TEMP_PASSWORD = os.environ.get("ADMIN_TEMP_PASSWORD", "")
COMPANY_NAME = os.environ.get("COMPANY_NAME", "Agrocorp Admin")

# Client-provided Agrocorp logo (uploaded via chat)
LOGO_URL = (
    "https://customer-assets-cm19k8pv.emergentagent.net/job_property-ops-60/"
    "artifacts/l500php4_AG%20Logo%20%28arch%20%2B%20tg%29%20tm.webp"
)

APP_NAME = "realestate-dashboard"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

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


def _init_storage() -> str | None:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return None
    r = requests.post(f"{STORAGE_URL}/init",
                      json={"emergent_key": key}, timeout=30)
    r.raise_for_status()
    return r.json()["storage_key"]


def upload_default_logo() -> tuple[str, dict] | tuple[None, None]:
    """Download the Agrocorp logo and push it to object storage.

    Returns (file_id, file_doc) or (None, None) if storage is unavailable.
    """
    try:
        storage_key = _init_storage()
        if not storage_key:
            print("WARN: EMERGENT_LLM_KEY missing — skipping logo upload")
            return None, None
        resp = requests.get(LOGO_URL, timeout=60)
        resp.raise_for_status()
        data = resp.content
        ext = LOGO_URL.rsplit(".", 1)[-1].lower()
        content_type = f"image/{ext}"
        file_id = new_id("file")
        path = f"{APP_NAME}/branding/{file_id}.{ext}"
        put = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": storage_key,
                     "Content-Type": content_type},
            data=data, timeout=120,
        )
        put.raise_for_status()
        result = put.json()
        from datetime import datetime, timezone
        doc = {
            "file_id": file_id,
            "storage_path": result["path"],
            "original_filename": "agrocorp-logo.webp",
            "content_type": content_type,
            "size": result.get("size", len(data)),
            "uploaded_by": "system",
            "is_deleted": False,
            "is_public": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return file_id, doc
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: logo upload failed: {exc}")
        return None, None


async def main() -> str:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Wipe every known collection
    existing = await db.list_collection_names()
    for name in set(existing) | set(COLLECTIONS):
        await db[name].drop()

    temp_pw = ADMIN_TEMP_PASSWORD or gen_password()
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
        "role": "super_admin",
        "project_ids": [],
        "password_hash": password_hash,
        "must_reset_password": True,
        "dashboard_config": None,
        "is_active": True,
        "onboarding_completed": False,
        "created_at": now_iso,
    }
    await db.users.insert_one(admin_doc)

    # Upload Agrocorp logo + seed branding settings
    logo_file_id, logo_doc = upload_default_logo()
    if logo_doc:
        await db.files.insert_one(logo_doc)

    settings_doc = {
        "_id": "singleton",
        "approval_threshold": 50000,
        "currency": "INR",
        "company_name": COMPANY_NAME,
        "logo_file_id": logo_file_id,
        "updated_at": now_iso,
    }
    await db.settings.insert_one(settings_doc)

    print("=== DATABASE RESET COMPLETE ===")
    print(f"Company     : {COMPANY_NAME}")
    print(f"Logo file_id: {logo_file_id or '(none — storage unavailable)'}")
    print(f"Admin email : {ADMIN_EMAIL}")
    print(f"Temp password: {temp_pw}")
    return temp_pw


if __name__ == "__main__":
    pw = asyncio.run(main())
    sys.stdout.write(f"\nTEMP_PW={pw}\n")
