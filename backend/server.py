"""
Real Estate Stakeholder Dashboard — FastAPI backend.

Modules: auth (Emergent Google), users, projects, unit_types, units, payments,
expenses (2-stage approval), stock (items + movements), audit log, settings,
excel import/export, dashboard analytics, notifications, files.
"""
from __future__ import annotations

import io
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal, Any

import requests
from dotenv import load_dotenv
from fastapi import (
    FastAPI, APIRouter, HTTPException, Depends, Header, Query, Response,
    UploadFile, File, Form, Cookie,
)
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from openpyxl import Workbook, load_workbook

# ---------------------------------------------------------------- setup ----
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "realestate-dashboard"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Real Estate Dashboard")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("app")

# --------------------------------------------------------- object storage ----
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
_storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        log.warning("EMERGENT_LLM_KEY missing — object storage disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init",
                          json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        log.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        log.error("Storage init failed: %s", e)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": content_type},
                     data=data, timeout=120)
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# -------------------------------------------------------------- models -----
Role = Literal["admin", "accounts", "management", "site_manager"]
ExpenseStatus = Literal["pending", "stage1_approved", "final_approved",
                        "rejected"]


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: new_id("user"))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    role: Role = "site_manager"
    project_ids: List[str] = []
    is_active: bool = True
    created_at: str = Field(default_factory=now)


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: Role
    project_ids: List[str] = []


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    project_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str = Field(default_factory=lambda: new_id("proj"))
    name: str
    location: str = ""
    description: str = ""
    target_revenue: float = 0
    image_url: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=now)


class ProjectCreate(BaseModel):
    name: str
    location: str = ""
    description: str = ""
    target_revenue: float = 0
    image_url: Optional[str] = None


class UnitType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    unit_type_id: str = Field(default_factory=lambda: new_id("utype"))
    project_id: str
    name: str  # e.g. 1BHK, Villa, Plot
    default_price: float = 0


class UnitTypeCreate(BaseModel):
    project_id: str
    name: str
    default_price: float = 0


class Unit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    unit_id: str = Field(default_factory=lambda: new_id("unit"))
    project_id: str
    unit_type_id: Optional[str] = None
    unit_number: str
    price: float = 0
    status: Literal["available", "reserved", "sold", "cancelled"] = "available"
    buyer_name: Optional[str] = None
    buyer_contact: Optional[str] = None
    reserved_until: Optional[str] = None
    reserved_at: Optional[str] = None
    sold_at: Optional[str] = None
    created_at: str = Field(default_factory=now)


class UnitCreate(BaseModel):
    project_id: str
    unit_type_id: Optional[str] = None
    unit_number: str
    price: float = 0


class MarkSold(BaseModel):
    buyer_name: str
    buyer_contact: Optional[str] = ""
    total_price: Optional[float] = None


class ReserveUnit(BaseModel):
    buyer_name: str
    buyer_contact: Optional[str] = ""
    reserved_until: Optional[str] = None  # ISO date
    total_price: Optional[float] = None


class BulkUnitCreate(BaseModel):
    project_id: str
    unit_type_id: Optional[str] = None
    prefix: str = ""
    start: int
    end: int
    pad: int = 0            # zero-padding for numbers, 0 = none
    base_price: float = 0


class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_id: str = Field(default_factory=lambda: new_id("pay"))
    project_id: str
    unit_id: str
    amount: float
    mode: Literal["cash", "cheque", "bank_transfer", "upi", "card", "other"] = "bank_transfer"
    reference: str = ""
    paid_on: str
    recorded_by: str
    created_at: str = Field(default_factory=now)


class PaymentCreate(BaseModel):
    unit_id: str
    amount: float
    mode: Literal["cash", "cheque", "bank_transfer", "upi", "card", "other"] = "bank_transfer"
    reference: str = ""
    paid_on: str


class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    expense_id: str = Field(default_factory=lambda: new_id("exp"))
    project_id: str
    category: str
    amount: float
    vendor: str = ""
    description: str = ""
    receipt_file_id: Optional[str] = None
    status: ExpenseStatus = "pending"
    raised_by: str
    stage1_by: Optional[str] = None
    stage1_at: Optional[str] = None
    final_by: Optional[str] = None
    final_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[str] = None
    created_at: str = Field(default_factory=now)


class ExpenseCreate(BaseModel):
    project_id: str
    category: str
    amount: float
    vendor: str = ""
    description: str = ""
    receipt_file_id: Optional[str] = None


class ApprovalAction(BaseModel):
    action: Literal["approve", "reject"]
    reason: Optional[str] = None


class StockItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str = Field(default_factory=lambda: new_id("item"))
    project_id: str
    name: str
    unit: str = "pcs"   # kg, bag, m3, pcs
    opening: float = 0
    inward: float = 0
    outward: float = 0
    vendor: str = ""
    created_at: str = Field(default_factory=now)


class StockItemCreate(BaseModel):
    project_id: str
    name: str
    unit: str = "pcs"
    opening: float = 0
    vendor: str = ""


class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    movement_id: str = Field(default_factory=lambda: new_id("mov"))
    item_id: str
    project_id: str
    kind: Literal["inward", "outward"]
    quantity: float
    note: str = ""
    recorded_by: str
    recorded_at: str = Field(default_factory=now)


class StockMovementCreate(BaseModel):
    item_id: str
    kind: Literal["inward", "outward"]
    quantity: float
    note: str = ""


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    approval_threshold: float = 50000
    currency: str = "INR"
    company_name: str = "Estate OS"
    logo_file_id: Optional[str] = None
    updated_at: str = Field(default_factory=now)


class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str = Field(default_factory=lambda: new_id("ntf"))
    user_id: str
    kind: str
    message: str
    link: Optional[str] = None
    is_read: bool = False
    created_at: str = Field(default_factory=now)


PeriodType = Literal["monthly", "quarterly"]


class RevenueTarget(BaseModel):
    model_config = ConfigDict(extra="ignore")
    target_id: str = Field(default_factory=lambda: new_id("tgt"))
    project_id: str
    period_type: PeriodType
    period_key: str   # "YYYY-MM" or "YYYY-Qn"
    amount: float
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=now)


import re
_MONTHLY_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
_QUARTERLY_RE = re.compile(r"^\d{4}-Q[1-4]$")


class RevenueTargetCreate(BaseModel):
    project_id: str
    period_type: PeriodType
    period_key: str
    amount: float = Field(ge=0)

    def validate_period_key(self):
        pat = _MONTHLY_RE if self.period_type == "monthly" else _QUARTERLY_RE
        if not pat.match(self.period_key):
            raise HTTPException(
                400,
                f"period_key must match {pat.pattern} for {self.period_type}")


def period_key_of(iso_dt: str, kind: PeriodType) -> str:
    d = datetime.fromisoformat(iso_dt.replace("Z", "+00:00"))
    if kind == "monthly":
        return d.strftime("%Y-%m")
    q = (d.month - 1) // 3 + 1
    return f"{d.year}-Q{q}"


def current_period_keys() -> dict[str, str]:
    today = datetime.now(timezone.utc)
    q = (today.month - 1) // 3 + 1
    return {"monthly": today.strftime("%Y-%m"),
            "quarterly": f"{today.year}-Q{q}"}


def prior_period_keys(kind: PeriodType, count: int) -> list[str]:
    """Return list of most recent `count` period keys (oldest first, including current)."""
    today = datetime.now(timezone.utc).replace(day=1)
    keys: list[str] = []
    if kind == "monthly":
        d = today
        for _ in range(count):
            keys.append(d.strftime("%Y-%m"))
            # step back one month
            d = (d - timedelta(days=1)).replace(day=1)
    else:
        y = today.year
        q = (today.month - 1) // 3 + 1
        for _ in range(count):
            keys.append(f"{y}-Q{q}")
            q -= 1
            if q == 0:
                q = 4
                y -= 1
    return list(reversed(keys))


# ---------------------------------------------------------------- helpers ---
async def audit(actor_id: str, action: str, entity: str,
                entity_id: str, meta: dict[str, Any] | None = None):
    await db.audit_logs.insert_one({
        "log_id": new_id("log"),
        "actor_id": actor_id, "action": action, "entity": entity,
        "entity_id": entity_id, "meta": meta or {}, "created_at": now(),
    })


async def notify(user_id: str, kind: str, message: str,
                 link: str | None = None):
    await db.notifications.insert_one(Notification(
        user_id=user_id, kind=kind, message=message, link=link,
    ).model_dump())


async def get_settings_doc() -> Settings:
    doc = await db.settings.find_one({"_id": "singleton"})
    if not doc:
        s = Settings()
        d = s.model_dump()
        d["_id"] = "singleton"
        await db.settings.insert_one(d)
        return s
    doc.pop("_id", None)
    return Settings(**doc)


# ------------------------------------------------------------------ auth ---
async def get_current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> User:
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(401, "Not authenticated")

    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid session")

    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")

    user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user_doc or not user_doc.get("is_active", True):
        raise HTTPException(401, "User not found or inactive")
    return User(**user_doc)


def require_roles(*roles: Role):
    async def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, f"Requires role in {roles}")
        return user
    return _dep


def user_scope_projects(user: User) -> Optional[List[str]]:
    """Return None (all projects) or list of project_ids the user can see."""
    if user.role in ("admin", "accounts", "management"):
        return None
    return user.project_ids or []


# ------------------------------------------------------ auth endpoints -----
class SessionExchange(BaseModel):
    session_id: str


@api.post("/auth/session")
async def exchange_session(payload: SessionExchange, response: Response):
    """Exchange Emergent session_id for our session_token cookie."""
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": payload.session_id}, timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid session id")
    data = r.json()

    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})

    user_count = await db.users.count_documents({})

    if not existing:
        # bootstrap admin if first user, else deny
        if user_count == 0:
            role: Role = "admin"
        else:
            raise HTTPException(
                403,
                "This email is not authorized. Ask your admin to add you.",
            )
        user_doc = User(
            email=email, name=data.get("name") or email,
            picture=data.get("picture"), role=role,
        ).model_dump()
        await db.users.insert_one(user_doc)
        existing = user_doc
        await audit(existing["user_id"], "bootstrap_admin", "user",
                    existing["user_id"], {"email": email})
    else:
        if not existing.get("is_active", True):
            raise HTTPException(403, "Account deactivated")
        # refresh name/picture on each login
        await db.users.update_one(
            {"user_id": existing["user_id"]},
            {"$set": {"name": data.get("name") or existing["name"],
                      "picture": data.get("picture")}},
        )

    token = data["session_token"]
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "session_token": token,
            "user_id": existing["user_id"],
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": now(),
        }},
        upsert=True,
    )

    response.set_cookie(
        key="session_token", value=token, max_age=7 * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/",
    )
    user_doc = await db.users.find_one({"user_id": existing["user_id"]}, {"_id": 0})
    return {"user": user_doc, "session_token": token}


@api.post("/auth/logout")
async def logout(response: Response,
                 authorization: Optional[str] = Header(None),
                 session_token: Optional[str] = Cookie(None)):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: User = Depends(get_current_user)):
    return user.model_dump()


# ------------------------------------------------------ users --------------
@api.get("/users")
async def list_users(user: User = Depends(require_roles("admin"))):
    docs = await db.users.find({}, {"_id": 0}).to_list(1000)
    return docs


@api.post("/users")
async def create_user(payload: UserCreate,
                      user: User = Depends(require_roles("admin"))):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(400, "User with this email already exists")
    u = User(email=payload.email.lower(), name=payload.name,
             role=payload.role, project_ids=payload.project_ids)
    await db.users.insert_one(u.model_dump())
    await audit(user.user_id, "create_user", "user", u.user_id,
                {"email": u.email, "role": u.role})
    return u.model_dump()


@api.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate,
                      user: User = Depends(require_roles("admin"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.users.update_one({"user_id": user_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "User not found")
    await audit(user.user_id, "update_user", "user", user_id, update)
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return doc


@api.delete("/users/{user_id}")
async def deactivate_user(user_id: str,
                          user: User = Depends(require_roles("admin"))):
    r = await db.users.update_one({"user_id": user_id},
                                  {"$set": {"is_active": False}})
    if r.matched_count == 0:
        raise HTTPException(404, "User not found")
    await audit(user.user_id, "deactivate_user", "user", user_id, {})
    return {"ok": True}


# ------------------------------------------------------ projects -----------
@api.get("/projects")
async def list_projects(user: User = Depends(get_current_user)):
    q = {}
    scope = user_scope_projects(user)
    if scope is not None:
        q["project_id"] = {"$in": scope}
    docs = await db.projects.find(q, {"_id": 0}).to_list(1000)
    return docs


@api.post("/projects")
async def create_project(payload: ProjectCreate,
                         user: User = Depends(require_roles("admin"))):
    p = Project(**payload.model_dump())
    await db.projects.insert_one(p.model_dump())
    await audit(user.user_id, "create_project", "project", p.project_id,
                payload.model_dump())
    return p.model_dump()


@api.patch("/projects/{project_id}")
async def update_project(project_id: str, payload: ProjectCreate,
                         user: User = Depends(require_roles("admin"))):
    upd = payload.model_dump()
    r = await db.projects.update_one({"project_id": project_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Project not found")
    await audit(user.user_id, "update_project", "project", project_id, upd)
    return await db.projects.find_one({"project_id": project_id}, {"_id": 0})


@api.get("/projects/{project_id}/impact")
async def project_impact(project_id: str,
                         user: User = Depends(require_roles("admin"))):
    users = await db.users.count_documents({"project_ids": project_id})
    units = await db.units.count_documents({"project_id": project_id})
    payments = await db.payments.count_documents({"project_id": project_id})
    expenses = await db.expenses.count_documents({"project_id": project_id})
    stock = await db.stock_items.count_documents({"project_id": project_id})
    return {"users": users, "units": units, "payments": payments,
            "expenses": expenses, "stock_items": stock}


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str,
                         user: User = Depends(require_roles("admin"))):
    n_users = await db.users.count_documents({"project_ids": project_id})
    if n_users > 0:
        raise HTTPException(
            400, f"Cannot delete: {n_users} user(s) still assigned")
    await db.projects.delete_one({"project_id": project_id})
    await db.units.delete_many({"project_id": project_id})
    await db.unit_types.delete_many({"project_id": project_id})
    await db.payments.delete_many({"project_id": project_id})
    await db.expenses.delete_many({"project_id": project_id})
    await db.stock_items.delete_many({"project_id": project_id})
    await db.stock_movements.delete_many({"project_id": project_id})
    await audit(user.user_id, "delete_project", "project", project_id, {})
    return {"ok": True}


# ------------------------------------------------------ unit types ---------
@api.get("/unit-types")
async def list_unit_types(project_id: Optional[str] = None,
                          user: User = Depends(get_current_user)):
    q: dict = {}
    if project_id:
        q["project_id"] = project_id
    scope = user_scope_projects(user)
    if scope is not None:
        q["project_id"] = {"$in": scope} if not project_id else project_id
    docs = await db.unit_types.find(q, {"_id": 0}).to_list(1000)
    return docs


@api.post("/unit-types")
async def create_unit_type(payload: UnitTypeCreate,
                           user: User = Depends(require_roles("admin"))):
    ut = UnitType(**payload.model_dump())
    await db.unit_types.insert_one(ut.model_dump())
    return ut.model_dump()


# ------------------------------------------------------ units --------------
@api.get("/units")
async def list_units(project_id: Optional[str] = None,
                     user: User = Depends(get_current_user)):
    q: dict = {}
    if project_id:
        q["project_id"] = project_id
    scope = user_scope_projects(user)
    if scope is not None:
        if project_id and project_id not in scope:
            return []
        if not project_id:
            q["project_id"] = {"$in": scope}
    docs = await db.units.find(q, {"_id": 0}).to_list(2000)
    return docs


@api.post("/units")
async def create_unit(payload: UnitCreate,
                      user: User = Depends(require_roles("admin"))):
    u = Unit(**payload.model_dump())
    await db.units.insert_one(u.model_dump())
    return u.model_dump()


@api.post("/units/bulk")
async def bulk_create_units(payload: BulkUnitCreate,
                            user: User = Depends(require_roles("admin"))):
    if payload.end < payload.start:
        raise HTTPException(400, "end must be >= start")
    if payload.end - payload.start + 1 > 500:
        raise HTTPException(400, "Bulk limit is 500 units per call")
    existing = await db.units.find(
        {"project_id": payload.project_id}, {"_id": 0, "unit_number": 1}
    ).to_list(5000)
    existing_nums = {u["unit_number"] for u in existing}

    created: list[dict] = []
    skipped: list[str] = []
    for n in range(payload.start, payload.end + 1):
        num = f"{payload.prefix}{str(n).zfill(payload.pad) if payload.pad else n}"
        if num in existing_nums:
            skipped.append(num)
            continue
        u = Unit(project_id=payload.project_id,
                 unit_type_id=payload.unit_type_id,
                 unit_number=num, price=payload.base_price)
        await db.units.insert_one(u.model_dump())
        created.append(u.model_dump())
    await audit(user.user_id, "bulk_units", "unit", payload.project_id,
                {"created": len(created), "skipped": len(skipped)})
    return {"created": len(created), "skipped": skipped,
            "units": created}


@api.post("/units/{unit_id}/sell")
async def mark_sold(unit_id: str, payload: MarkSold,
                    user: User = Depends(require_roles("admin"))):
    unit = await db.units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(404, "Unit not found")
    if unit["status"] == "sold":
        raise HTTPException(400, "Unit already sold")
    upd = {"status": "sold", "buyer_name": payload.buyer_name,
           "buyer_contact": payload.buyer_contact or "", "sold_at": now(),
           "reserved_until": None, "reserved_at": None}
    if payload.total_price is not None:
        upd["price"] = payload.total_price
    await db.units.update_one({"unit_id": unit_id}, {"$set": upd})
    await audit(user.user_id, "sell_unit", "unit", unit_id, upd)
    return await db.units.find_one({"unit_id": unit_id}, {"_id": 0})


@api.post("/units/{unit_id}/reserve")
async def reserve_unit(unit_id: str, payload: ReserveUnit,
                       user: User = Depends(require_roles("admin"))):
    unit = await db.units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(404, "Unit not found")
    if unit["status"] not in ("available", "reserved"):
        raise HTTPException(400, "Unit must be available to reserve")
    upd = {"status": "reserved", "buyer_name": payload.buyer_name,
           "buyer_contact": payload.buyer_contact or "",
           "reserved_until": payload.reserved_until,
           "reserved_at": now()}
    if payload.total_price is not None:
        upd["price"] = payload.total_price
    await db.units.update_one({"unit_id": unit_id}, {"$set": upd})
    await audit(user.user_id, "reserve_unit", "unit", unit_id, upd)
    return await db.units.find_one({"unit_id": unit_id}, {"_id": 0})


@api.post("/units/{unit_id}/release")
async def release_unit(unit_id: str,
                       user: User = Depends(require_roles("admin"))):
    unit = await db.units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(404, "Unit not found")
    if unit["status"] != "reserved":
        raise HTTPException(400, "Only reserved units can be released")
    upd = {"status": "available", "buyer_name": None, "buyer_contact": None,
           "reserved_until": None, "reserved_at": None}
    await db.units.update_one({"unit_id": unit_id}, {"$set": upd})
    await audit(user.user_id, "release_unit", "unit", unit_id, {})
    return await db.units.find_one({"unit_id": unit_id}, {"_id": 0})


@api.post("/units/{unit_id}/cancel")
async def cancel_sale(unit_id: str,
                      user: User = Depends(require_roles("admin"))):
    unit = await db.units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(404, "Unit not found")
    await db.units.update_one({"unit_id": unit_id},
                              {"$set": {"status": "cancelled"}})
    await audit(user.user_id, "cancel_sale", "unit", unit_id, {})
    return {"ok": True}


# ------------------------------------------------------ payments -----------
@api.get("/payments")
async def list_payments(project_id: Optional[str] = None,
                        unit_id: Optional[str] = None,
                        user: User = Depends(get_current_user)):
    q: dict = {}
    if project_id:
        q["project_id"] = project_id
    if unit_id:
        q["unit_id"] = unit_id
    scope = user_scope_projects(user)
    if scope is not None:
        if not project_id:
            q["project_id"] = {"$in": scope}
    docs = await db.payments.find(q, {"_id": 0}).sort("paid_on", -1).to_list(2000)
    return docs


@api.post("/payments")
async def create_payment(payload: PaymentCreate,
                         user: User = Depends(require_roles("admin", "accounts"))):
    unit = await db.units.find_one({"unit_id": payload.unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(404, "Unit not found")
    p = Payment(project_id=unit["project_id"],
                unit_id=payload.unit_id, amount=payload.amount,
                mode=payload.mode, reference=payload.reference,
                paid_on=payload.paid_on, recorded_by=user.user_id)
    await db.payments.insert_one(p.model_dump())
    await audit(user.user_id, "record_payment", "payment", p.payment_id,
                {"unit": payload.unit_id, "amount": payload.amount})
    return p.model_dump()


@api.get("/revenue/summary")
async def revenue_summary(project_id: Optional[str] = None,
                          user: User = Depends(get_current_user)):
    scope = user_scope_projects(user)
    unit_q: dict = {}
    if project_id:
        unit_q["project_id"] = project_id
    elif scope is not None:
        unit_q["project_id"] = {"$in": scope}
    units = await db.units.find(unit_q, {"_id": 0}).to_list(5000)
    unit_ids = [u["unit_id"] for u in units]

    pay_q: dict = {"unit_id": {"$in": unit_ids}}
    payments = await db.payments.find(pay_q, {"_id": 0}).to_list(10000)

    accrued = sum(u["price"] for u in units if u["status"] == "sold")
    received = sum(p["amount"] for p in payments)
    receivable = accrued - received

    by_unit = {}
    for u in units:
        by_unit[u["unit_id"]] = {
            "unit_id": u["unit_id"],
            "unit_number": u["unit_number"],
            "project_id": u["project_id"],
            "status": u["status"],
            "accrued": u["price"] if u["status"] == "sold" else 0,
            "received": 0,
        }
    for p in payments:
        if p["unit_id"] in by_unit:
            by_unit[p["unit_id"]]["received"] += p["amount"]
    for row in by_unit.values():
        row["receivable"] = row["accrued"] - row["received"]

    return {"accrued": accrued, "received": received,
            "receivable": receivable,
            "by_unit": list(by_unit.values())}


# ------------------------------------------------------ revenue targets ---
async def _compute_period_actuals(scope_pids: Optional[list[str]],
                                  period_type: PeriodType,
                                  keys: list[str]) -> dict[str, dict]:
    """
    Return {period_key: {received: X, accrued: Y}} across given projects.
    scope_pids semantics:
      * None      → include ALL projects (no filter)
      * []        → no visible projects → all zeros
      * [ids...]  → limit to these projects
    """
    out: dict[str, dict] = {k: {"received": 0.0, "accrued": 0.0} for k in keys}
    if scope_pids is not None and len(scope_pids) == 0:
        return out
    key_set = set(keys)

    pay_q: dict = {}
    if scope_pids:
        pay_q["project_id"] = {"$in": scope_pids}
    async for p in db.payments.find(pay_q, {"_id": 0}):
        if not p.get("paid_on"):
            continue
        k = period_key_of(p["paid_on"], period_type)
        if k in key_set:
            out[k]["received"] += p["amount"]

    unit_q: dict = {"status": "sold"}
    if scope_pids:
        unit_q["project_id"] = {"$in": scope_pids}
    async for u in db.units.find(unit_q, {"_id": 0}):
        if not u.get("sold_at"):
            continue
        k = period_key_of(u["sold_at"], period_type)
        if k in key_set:
            out[k]["accrued"] += u.get("price", 0)
    return out


async def _sum_targets(scope_pids: Optional[list[str]],
                       period_type: PeriodType,
                       keys: list[str]) -> dict[str, float]:
    totals: dict[str, float] = {k: 0.0 for k in keys}
    if scope_pids is not None and len(scope_pids) == 0:
        return totals
    q: dict = {"period_type": period_type, "period_key": {"$in": keys}}
    if scope_pids:
        q["project_id"] = {"$in": scope_pids}
    async for t in db.revenue_targets.find(q, {"_id": 0}):
        totals[t["period_key"]] = totals.get(t["period_key"], 0.0) + t["amount"]
    return totals


def _resolve_scope(user: User, project_id: Optional[str]) -> list[str] | None:
    """Return concrete list of project ids to filter by, or None = no filter."""
    scope = user_scope_projects(user)
    if project_id:
        if scope is not None and project_id not in scope:
            return []
        return [project_id]
    return scope  # may be None


@api.get("/revenue-targets")
async def list_targets(project_id: Optional[str] = None,
                       period_type: Optional[PeriodType] = None,
                       user: User = Depends(get_current_user)):
    q: dict = {}
    scope = _resolve_scope(user, project_id)
    if scope is not None:
        if not scope:
            return []
        q["project_id"] = {"$in": scope}
    if period_type:
        q["period_type"] = period_type
    docs = await db.revenue_targets.find(q, {"_id": 0}).sort("period_key", -1).to_list(500)
    return docs


@api.post("/revenue-targets")
async def upsert_target(payload: RevenueTargetCreate,
                        user: User = Depends(require_roles("admin"))):
    payload.validate_period_key()
    if not await db.projects.find_one({"project_id": payload.project_id}):
        raise HTTPException(404, "Project not found")
    existing = await db.revenue_targets.find_one({
        "project_id": payload.project_id,
        "period_type": payload.period_type,
        "period_key": payload.period_key,
    }, {"_id": 0})
    if existing:
        await db.revenue_targets.update_one(
            {"target_id": existing["target_id"]},
            {"$set": {"amount": payload.amount}},
        )
        await audit(user.user_id, "update_target", "revenue_target",
                    existing["target_id"], {"amount": payload.amount})
        return await db.revenue_targets.find_one(
            {"target_id": existing["target_id"]}, {"_id": 0})
    t = RevenueTarget(**payload.model_dump(), created_by=user.user_id)
    await db.revenue_targets.insert_one(t.model_dump())
    await audit(user.user_id, "create_target", "revenue_target", t.target_id,
                payload.model_dump())
    return t.model_dump()


@api.delete("/revenue-targets/{target_id}")
async def delete_target(target_id: str,
                        user: User = Depends(require_roles("admin"))):
    r = await db.revenue_targets.delete_one({"target_id": target_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Target not found")
    await audit(user.user_id, "delete_target", "revenue_target", target_id, {})
    return {"ok": True}


@api.get("/revenue-targets/variance")
async def target_variance(project_id: Optional[str] = None,
                          period_type: PeriodType = "monthly",
                          periods: int = 6,
                          user: User = Depends(get_current_user)):
    periods = max(1, min(24, periods))
    scope = _resolve_scope(user, project_id)
    # Preserve None → all-projects; [] → no-access; concrete list → scope
    if scope is None:
        pids = None
    else:
        pids = scope  # may be []
    keys = prior_period_keys(period_type, periods)
    targets = await _sum_targets(pids, period_type, keys)
    actuals = await _compute_period_actuals(pids, period_type, keys)
    series = []
    for k in keys:
        t = targets.get(k, 0.0)
        rec = actuals[k]["received"]
        acc = actuals[k]["accrued"]
        series.append({
            "period_key": k,
            "target": t,
            "received": rec,
            "accrued": acc,
            "variance_received": rec - t,
            "variance_accrued": acc - t,
            "variance_received_pct": None if t == 0 else round(((rec - t) / t) * 100, 1),
            "variance_accrued_pct": None if t == 0 else round(((acc - t) / t) * 100, 1),
        })
    return {"period_type": period_type, "series": series}


# ------------------------------------------------------ expenses -----------
@api.get("/expenses")
async def list_expenses(project_id: Optional[str] = None,
                        status: Optional[ExpenseStatus] = None,
                        user: User = Depends(get_current_user)):
    q: dict = {}
    if project_id:
        q["project_id"] = project_id
    if status:
        q["status"] = status
    scope = user_scope_projects(user)
    if scope is not None:
        if not project_id:
            q["project_id"] = {"$in": scope}
    if user.role == "site_manager":
        # site managers see only their own + their projects
        q["project_id"] = q.get("project_id", {"$in": user.project_ids})
    docs = await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api.post("/expenses")
async def raise_expense(payload: ExpenseCreate,
                        user: User = Depends(require_roles(
                            "site_manager", "admin"))):
    if user.role == "site_manager" and payload.project_id not in user.project_ids:
        raise HTTPException(403, "You are not assigned to this project")
    e = Expense(**payload.model_dump(), raised_by=user.user_id)
    await db.expenses.insert_one(e.model_dump())
    await audit(user.user_id, "raise_expense", "expense", e.expense_id,
                {"amount": payload.amount})
    # notify accounts users
    async for acc in db.users.find({"role": "accounts", "is_active": True},
                                   {"_id": 0}):
        await notify(acc["user_id"], "expense_new",
                     f"New expense ₹{payload.amount:,.0f} pending Stage-1",
                     link=f"/expenses/{e.expense_id}")
    return e.model_dump()


@api.post("/expenses/{expense_id}/stage1")
async def stage1(expense_id: str, payload: ApprovalAction,
                 user: User = Depends(require_roles("accounts", "admin"))):
    exp = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not exp:
        raise HTTPException(404, "Expense not found")
    if exp["status"] != "pending":
        raise HTTPException(400, "Expense not in pending state")

    settings = await get_settings_doc()
    threshold = settings.approval_threshold

    if payload.action == "reject":
        if not payload.reason:
            raise HTTPException(400, "Rejection reason required")
        upd = {"status": "rejected", "rejection_reason": payload.reason,
               "rejected_by": user.user_id, "rejected_at": now()}
    else:
        if exp["amount"] > threshold:
            upd = {"status": "stage1_approved",
                   "stage1_by": user.user_id, "stage1_at": now()}
        else:
            upd = {"status": "final_approved",
                   "stage1_by": user.user_id, "stage1_at": now(),
                   "final_by": user.user_id, "final_at": now()}

    await db.expenses.update_one({"expense_id": expense_id}, {"$set": upd})
    await audit(user.user_id, "stage1", "expense", expense_id, upd)
    if upd["status"] == "stage1_approved":
        async for m in db.users.find({"role": "management", "is_active": True},
                                     {"_id": 0}):
            await notify(m["user_id"], "expense_stage1",
                         f"Expense ₹{exp['amount']:,.0f} needs final approval",
                         link=f"/expenses/{expense_id}")
    else:
        await notify(exp["raised_by"], "expense_result",
                     f"Your expense is {upd['status'].replace('_', ' ')}",
                     link=f"/expenses/{expense_id}")
    return await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})


@api.post("/expenses/{expense_id}/final")
async def final_approve(expense_id: str, payload: ApprovalAction,
                        user: User = Depends(require_roles("management", "admin"))):
    exp = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not exp:
        raise HTTPException(404, "Expense not found")
    if exp["status"] != "stage1_approved":
        raise HTTPException(400, "Expense not awaiting final approval")

    if payload.action == "reject":
        if not payload.reason:
            raise HTTPException(400, "Rejection reason required")
        upd = {"status": "rejected", "rejection_reason": payload.reason,
               "rejected_by": user.user_id, "rejected_at": now()}
    else:
        upd = {"status": "final_approved",
               "final_by": user.user_id, "final_at": now()}

    await db.expenses.update_one({"expense_id": expense_id}, {"$set": upd})
    await audit(user.user_id, "final", "expense", expense_id, upd)
    await notify(exp["raised_by"], "expense_result",
                 f"Your expense is {upd['status'].replace('_', ' ')}",
                 link=f"/expenses/{expense_id}")
    return await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})


# ------------------------------------------------------ stock --------------
@api.get("/stock/items")
async def list_stock_items(project_id: Optional[str] = None,
                           user: User = Depends(get_current_user)):
    q: dict = {}
    if project_id:
        q["project_id"] = project_id
    scope = user_scope_projects(user)
    if scope is not None:
        if not project_id:
            q["project_id"] = {"$in": scope}
    items = await db.stock_items.find(q, {"_id": 0}).to_list(2000)
    for it in items:
        it["closing"] = (it.get("opening", 0)
                         + it.get("inward", 0) - it.get("outward", 0))
    return items


@api.post("/stock/items")
async def create_stock_item(payload: StockItemCreate,
                            user: User = Depends(require_roles(
                                "admin", "site_manager"))):
    if user.role == "site_manager" and payload.project_id not in user.project_ids:
        raise HTTPException(403, "Project not in your scope")
    it = StockItem(**payload.model_dump())
    await db.stock_items.insert_one(it.model_dump())
    return it.model_dump()


@api.post("/stock/movements")
async def add_movement(payload: StockMovementCreate,
                       user: User = Depends(require_roles(
                           "admin", "site_manager"))):
    item = await db.stock_items.find_one({"item_id": payload.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    if (user.role == "site_manager"
            and item["project_id"] not in user.project_ids):
        raise HTTPException(403, "Project not in your scope")
    mv = StockMovement(item_id=payload.item_id,
                       project_id=item["project_id"],
                       kind=payload.kind, quantity=payload.quantity,
                       note=payload.note, recorded_by=user.user_id)
    await db.stock_movements.insert_one(mv.model_dump())
    inc = {"inward": payload.quantity} if payload.kind == "inward" \
        else {"outward": payload.quantity}
    await db.stock_items.update_one({"item_id": payload.item_id},
                                    {"$inc": inc})
    await audit(user.user_id, f"stock_{payload.kind}", "stock_item",
                payload.item_id, {"qty": payload.quantity})
    return mv.model_dump()


@api.get("/stock/movements")
async def list_movements(item_id: Optional[str] = None,
                         project_id: Optional[str] = None,
                         user: User = Depends(get_current_user)):
    q: dict = {}
    if item_id:
        q["item_id"] = item_id
    if project_id:
        q["project_id"] = project_id
    return await db.stock_movements.find(q, {"_id": 0}).sort(
        "recorded_at", -1).to_list(2000)


# ------------------------------------------------------ settings -----------
@api.get("/settings/public")
async def public_settings():
    """Non-sensitive settings visible before login (branding)."""
    s = await get_settings_doc()
    return {
        "company_name": s.company_name,
        "currency": s.currency,
        "logo_file_id": s.logo_file_id,
    }


@api.get("/settings")
async def read_settings(user: User = Depends(get_current_user)):
    s = await get_settings_doc()
    return s.model_dump()


class SettingsUpdate(BaseModel):
    approval_threshold: Optional[float] = None
    currency: Optional[str] = None
    company_name: Optional[str] = None
    logo_file_id: Optional[str] = None


@api.patch("/settings")
async def update_settings(payload: SettingsUpdate,
                          user: User = Depends(require_roles("admin"))):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    upd["updated_at"] = now()
    await db.settings.update_one({"_id": "singleton"}, {"$set": upd},
                                 upsert=True)
    await audit(user.user_id, "update_settings", "settings", "singleton", upd)
    return (await get_settings_doc()).model_dump()


# ------------------------------------------------------ notifications -----
@api.get("/notifications")
async def my_notifications(user: User = Depends(get_current_user)):
    return await db.notifications.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: User = Depends(get_current_user)):
    await db.notifications.update_one(
        {"notification_id": nid, "user_id": user.user_id},
        {"$set": {"is_read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user.user_id, "is_read": False},
        {"$set": {"is_read": True}})
    return {"ok": True}


# ------------------------------------------------------ audit log ---------
@api.get("/audit-logs")
async def audit_logs(user: User = Depends(require_roles("admin"))):
    return await db.audit_logs.find({}, {"_id": 0}).sort(
        "created_at", -1).limit(500).to_list(500)


# ------------------------------------------------------ files -------------
@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...),
                      user: User = Depends(get_current_user)):
    data = await file.read()
    ext = (file.filename or "bin").split(".")[-1].lower()
    file_id = new_id("file")
    path = f"{APP_NAME}/uploads/{user.user_id}/{file_id}.{ext}"
    result = put_object(path, data, file.content_type or "application/octet-stream")
    doc = {
        "file_id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": user.user_id,
        "is_deleted": False,
        "created_at": now(),
    }
    await db.files.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/files/{file_id}/download")
async def download_file(file_id: str,
                        authorization: Optional[str] = Header(None),
                        session_token: Optional[str] = Cookie(None),
                        auth: Optional[str] = Query(None)):
    # Allow logo (public) via public flag on file record; else require auth
    rec = await db.files.find_one({"file_id": file_id, "is_deleted": False},
                                  {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    if not rec.get("is_public"):
        # authenticate: cookie, Bearer, or ?auth= query param
        token = session_token
        if not token and authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ", 1)[1]
        if not token and auth:
            token = auth
        if not token:
            raise HTTPException(401, "Not authenticated")
        sess = await db.user_sessions.find_one({"session_token": token},
                                               {"_id": 0})
        if not sess:
            raise HTTPException(401, "Invalid session")
        exp = sess["expires_at"]
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(401, "Session expired")
    data, ct = get_object(rec["storage_path"])
    return Response(content=data,
                    media_type=rec.get("content_type") or ct,
                    headers={"Content-Disposition":
                             f'inline; filename="{rec["original_filename"]}"'})


@api.post("/files/logo")
async def upload_logo(file: UploadFile = File(...),
                      user: User = Depends(require_roles("admin"))):
    data = await file.read()
    ext = (file.filename or "png").split(".")[-1].lower()
    file_id = new_id("file")
    path = f"{APP_NAME}/branding/{file_id}.{ext}"
    result = put_object(path, data, file.content_type or "image/png")
    doc = {
        "file_id": file_id, "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": user.user_id, "is_deleted": False, "is_public": True,
        "created_at": now(),
    }
    await db.files.insert_one(doc)
    await db.settings.update_one({"_id": "singleton"},
                                 {"$set": {"logo_file_id": file_id,
                                           "updated_at": now()}},
                                 upsert=True)
    await audit(user.user_id, "upload_logo", "settings", "singleton",
                {"file_id": file_id})
    doc.pop("_id", None)
    return doc


# ------------------------------------------------------ analytics ---------
@api.get("/dashboard/summary")
async def dashboard_summary(project_id: Optional[str] = None,
                            user: User = Depends(get_current_user)):
    scope = user_scope_projects(user)
    unit_q: dict = {}
    exp_q: dict = {}
    stock_q: dict = {}
    if project_id:
        unit_q["project_id"] = project_id
        exp_q["project_id"] = project_id
        stock_q["project_id"] = project_id
    elif scope is not None:
        unit_q["project_id"] = {"$in": scope}
        exp_q["project_id"] = {"$in": scope}
        stock_q["project_id"] = {"$in": scope}

    total = await db.units.count_documents(unit_q)
    sold = await db.units.count_documents({**unit_q, "status": "sold"})
    available = await db.units.count_documents({**unit_q, "status": "available"})
    reserved = await db.units.count_documents({**unit_q, "status": "reserved"})

    units = await db.units.find(unit_q, {"_id": 0}).to_list(5000)
    accrued = sum(u["price"] for u in units if u["status"] == "sold")
    unit_ids = [u["unit_id"] for u in units]
    payments = await db.payments.find(
        {"unit_id": {"$in": unit_ids}}, {"_id": 0}
    ).to_list(10000)
    received = sum(p["amount"] for p in payments)

    projects_q: dict = {}
    if project_id:
        projects_q["project_id"] = project_id
    elif scope is not None:
        projects_q["project_id"] = {"$in": scope}
    projects = await db.projects.find(projects_q, {"_id": 0}).to_list(500)
    target = sum(p.get("target_revenue", 0) for p in projects)

    pending = await db.expenses.count_documents({**exp_q, "status": "pending"})
    stage1 = await db.expenses.count_documents(
        {**exp_q, "status": "stage1_approved"})
    approved = await db.expenses.count_documents(
        {**exp_q, "status": "final_approved"})
    rejected = await db.expenses.count_documents(
        {**exp_q, "status": "rejected"})

    approved_amt = 0.0
    # single pass for both approved_amt, trend and vendor spend
    from collections import defaultdict
    by_day: dict[str, float] = defaultdict(float)
    vendor_now: dict[str, float] = defaultdict(float)
    vendor_prev: dict[str, float] = defaultdict(float)
    today = datetime.now(timezone.utc)
    this_month = today.strftime("%Y-%m")
    prev_dt = today.replace(day=1) - timedelta(days=1)
    prev_month = prev_dt.strftime("%Y-%m")

    async for e in db.expenses.find({**exp_q, "status": "final_approved"},
                                    {"_id": 0}):
        approved_amt += e["amount"]
        d = (e.get("final_at") or e["created_at"])[:10]
        by_day[d] += e["amount"]
        mo = d[:7]
        vendor = (e.get("vendor") or "Unknown").strip() or "Unknown"
        if mo == this_month:
            vendor_now[vendor] += e["amount"]
        elif mo == prev_month:
            vendor_prev[vendor] += e["amount"]

    trend = [{"date": d, "amount": v} for d, v in sorted(by_day.items())][-30:]

    # top vendors this month vs last
    vendors: list[dict] = []
    for v, amt in sorted(vendor_now.items(), key=lambda x: -x[1])[:5]:
        prev = vendor_prev.get(v, 0.0)
        delta_pct = None if prev == 0 else round(((amt - prev) / prev) * 100, 1)
        vendors.append({
            "vendor": v, "this_month": amt, "last_month": prev,
            "delta_pct": delta_pct,
        })

    return {
        "units": {"total": total, "sold": sold, "available": available,
                  "reserved": reserved},
        "revenue": {"accrued": accrued, "received": received,
                    "receivable": accrued - received, "target": target},
        "expenses": {"pending": pending, "stage1": stage1,
                     "approved": approved, "rejected": rejected,
                     "approved_amount": approved_amt},
        "expense_trend": trend,
        "top_vendors": vendors,
        "period_targets": await _current_period_targets(
            [p["project_id"] for p in projects]),
        "projects_count": len(projects),
    }


async def _current_period_targets(project_ids: list[str]) -> dict:
    """Build monthly + quarterly current-period target vs received vs accrued."""
    keys = current_period_keys()
    out: dict[str, dict] = {}
    for kind in ("monthly", "quarterly"):
        k = keys[kind]
        tgt = (await _sum_targets(project_ids, kind, [k]))[k]
        act = (await _compute_period_actuals(project_ids, kind, [k]))[k]
        rec, acc = act["received"], act["accrued"]
        out[kind] = {
            "period_key": k,
            "target": tgt,
            "received": rec,
            "accrued": acc,
            "variance_received": rec - tgt,
            "variance_accrued": acc - tgt,
            "variance_received_pct": None if tgt == 0 else round(((rec - tgt) / tgt) * 100, 1),
            "variance_accrued_pct": None if tgt == 0 else round(((acc - tgt) / tgt) * 100, 1),
        }
    return out


# ------------------------------------------------------ search ------------
@api.get("/search")
async def global_search(q: str, user: User = Depends(get_current_user)):
    if not q:
        return {"projects": [], "units": [], "expenses": []}
    scope = user_scope_projects(user)
    proj_q = {"name": {"$regex": q, "$options": "i"}}
    if scope is not None:
        proj_q["project_id"] = {"$in": scope}
    projects = await db.projects.find(proj_q, {"_id": 0}).limit(10).to_list(10)

    unit_q = {"unit_number": {"$regex": q, "$options": "i"}}
    if scope is not None:
        unit_q["project_id"] = {"$in": scope}
    units = await db.units.find(unit_q, {"_id": 0}).limit(10).to_list(10)

    exp_q = {"$or": [{"category": {"$regex": q, "$options": "i"}},
                     {"vendor": {"$regex": q, "$options": "i"}}]}
    if scope is not None:
        exp_q["project_id"] = {"$in": scope}
    expenses = await db.expenses.find(exp_q, {"_id": 0}).limit(10).to_list(10)
    return {"projects": projects, "units": units, "expenses": expenses}


# ------------------------------------------------------ excel -------------
IMPORT_SHEETS = {
    "projects": ["name", "location", "description", "target_revenue"],
    "units": ["project_id", "unit_type", "unit_number", "price"],
    "stock_items": ["project_id", "name", "unit", "opening", "vendor"],
}


@api.get("/excel/template/{kind}")
async def excel_template(kind: str,
                         user: User = Depends(require_roles("admin"))):
    if kind not in IMPORT_SHEETS:
        raise HTTPException(400, "Unknown template kind")
    wb = Workbook()
    ws = wb.active
    ws.title = kind
    ws.append(IMPORT_SHEETS[kind])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition":
                 f'attachment; filename="template_{kind}.xlsx"'})


@api.post("/excel/import/{kind}")
async def excel_import(kind: str, file: UploadFile = File(...),
                       user: User = Depends(require_roles("admin"))):
    if kind not in IMPORT_SHEETS:
        raise HTTPException(400, "Unknown import kind")
    wb = load_workbook(io.BytesIO(await file.read()))
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(400, "Empty workbook")
    header = [str(c).strip() if c else "" for c in rows[0]]
    expected = IMPORT_SHEETS[kind]
    if header[:len(expected)] != expected:
        raise HTTPException(
            400, f"Header mismatch. Expected: {expected}")

    inserted = 0
    errors: list[dict] = []
    for i, row in enumerate(rows[1:], start=2):
        try:
            data = dict(zip(expected, row))
            if kind == "projects":
                if not data.get("name"):
                    raise ValueError("name required")
                p = Project(
                    name=str(data["name"]),
                    location=str(data.get("location") or ""),
                    description=str(data.get("description") or ""),
                    target_revenue=float(data.get("target_revenue") or 0),
                )
                await db.projects.insert_one(p.model_dump())
            elif kind == "units":
                pid = str(data.get("project_id") or "")
                if not pid or not await db.projects.find_one({"project_id": pid}):
                    raise ValueError("invalid project_id")
                utype_name = str(data.get("unit_type") or "").strip()
                ut_id = None
                if utype_name:
                    ut = await db.unit_types.find_one(
                        {"project_id": pid, "name": utype_name}, {"_id": 0})
                    if not ut:
                        ut_new = UnitType(project_id=pid, name=utype_name)
                        await db.unit_types.insert_one(ut_new.model_dump())
                        ut_id = ut_new.unit_type_id
                    else:
                        ut_id = ut["unit_type_id"]
                u = Unit(project_id=pid, unit_type_id=ut_id,
                         unit_number=str(data.get("unit_number") or ""),
                         price=float(data.get("price") or 0))
                await db.units.insert_one(u.model_dump())
            elif kind == "stock_items":
                pid = str(data.get("project_id") or "")
                if not pid or not await db.projects.find_one({"project_id": pid}):
                    raise ValueError("invalid project_id")
                it = StockItem(
                    project_id=pid,
                    name=str(data.get("name") or ""),
                    unit=str(data.get("unit") or "pcs"),
                    opening=float(data.get("opening") or 0),
                    vendor=str(data.get("vendor") or ""),
                )
                await db.stock_items.insert_one(it.model_dump())
            inserted += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    await audit(user.user_id, "excel_import", kind, "-",
                {"inserted": inserted, "errors": len(errors)})
    return {"inserted": inserted, "errors": errors}


# ------------------------------------------------------ excel export ------
def _rows_to_xlsx(sheet_name: str, headers: list[str],
                  rows: list[list[Any]]) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]
    ws.append(headers)
    for r in rows:
        ws.append(r)
    for col in ws.columns:
        max_len = max((len(str(c.value)) if c.value is not None else 0)
                      for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


@api.get("/exports/units")
async def export_units(project_id: Optional[str] = None,
                       user: User = Depends(get_current_user)):
    q: dict = {}
    scope = user_scope_projects(user)
    if project_id:
        q["project_id"] = project_id
    elif scope is not None:
        q["project_id"] = {"$in": scope}
    units = await db.units.find(q, {"_id": 0}).to_list(5000)
    proj = {p["project_id"]: p["name"] for p in
            await db.projects.find({}, {"_id": 0}).to_list(1000)}
    utypes = {u["unit_type_id"]: u["name"] for u in
              await db.unit_types.find({}, {"_id": 0}).to_list(1000)}
    headers = ["Unit #", "Project", "Type", "Price", "Status",
               "Buyer", "Contact", "Reserved Until", "Sold At"]
    rows = [[u["unit_number"], proj.get(u["project_id"], ""),
             utypes.get(u.get("unit_type_id"), ""), u["price"], u["status"],
             u.get("buyer_name") or "", u.get("buyer_contact") or "",
             u.get("reserved_until") or "", u.get("sold_at") or ""]
            for u in units]
    buf = _rows_to_xlsx("units", headers, rows)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="units.xlsx"'})


@api.get("/exports/expenses")
async def export_expenses(project_id: Optional[str] = None,
                          user: User = Depends(get_current_user)):
    q: dict = {}
    scope = user_scope_projects(user)
    if project_id:
        q["project_id"] = project_id
    elif scope is not None:
        q["project_id"] = {"$in": scope}
    exps = await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    proj = {p["project_id"]: p["name"] for p in
            await db.projects.find({}, {"_id": 0}).to_list(1000)}
    users_map = {u["user_id"]: u["name"] for u in
                 await db.users.find({}, {"_id": 0}).to_list(1000)}
    headers = ["Date", "Project", "Category", "Vendor", "Amount",
               "Status", "Raised By", "Stage-1 By", "Final By",
               "Rejection Reason", "Description"]
    rows = [[e["created_at"][:10], proj.get(e["project_id"], ""),
             e["category"], e.get("vendor") or "", e["amount"], e["status"],
             users_map.get(e.get("raised_by"), ""),
             users_map.get(e.get("stage1_by"), ""),
             users_map.get(e.get("final_by"), ""),
             e.get("rejection_reason") or "", e.get("description") or ""]
            for e in exps]
    buf = _rows_to_xlsx("expenses", headers, rows)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="expenses.xlsx"'})


@api.get("/exports/payments")
async def export_payments(project_id: Optional[str] = None,
                          user: User = Depends(get_current_user)):
    q: dict = {}
    scope = user_scope_projects(user)
    if project_id:
        q["project_id"] = project_id
    elif scope is not None:
        q["project_id"] = {"$in": scope}
    pays = await db.payments.find(q, {"_id": 0}).sort("paid_on", -1).to_list(5000)
    units_map = {u["unit_id"]: u["unit_number"] for u in
                 await db.units.find({}, {"_id": 0}).to_list(5000)}
    proj = {p["project_id"]: p["name"] for p in
            await db.projects.find({}, {"_id": 0}).to_list(1000)}
    headers = ["Date", "Project", "Unit", "Amount", "Mode", "Reference"]
    rows = [[p["paid_on"], proj.get(p["project_id"], ""),
             units_map.get(p["unit_id"], ""), p["amount"], p["mode"],
             p.get("reference") or ""] for p in pays]
    buf = _rows_to_xlsx("payments", headers, rows)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="payments.xlsx"'})


@api.get("/exports/stock")
async def export_stock(project_id: Optional[str] = None,
                       user: User = Depends(get_current_user)):
    q: dict = {}
    scope = user_scope_projects(user)
    if project_id:
        q["project_id"] = project_id
    elif scope is not None:
        q["project_id"] = {"$in": scope}
    items = await db.stock_items.find(q, {"_id": 0}).to_list(5000)
    proj = {p["project_id"]: p["name"] for p in
            await db.projects.find({}, {"_id": 0}).to_list(1000)}
    headers = ["Item", "Project", "Unit", "Opening", "Inward", "Outward",
               "Closing", "Vendor"]
    rows = []
    for it in items:
        closing = it.get("opening", 0) + it.get("inward", 0) - it.get("outward", 0)
        rows.append([it["name"], proj.get(it["project_id"], ""), it["unit"],
                     it.get("opening", 0), it.get("inward", 0),
                     it.get("outward", 0), closing, it.get("vendor") or ""])
    buf = _rows_to_xlsx("stock", headers, rows)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="stock.xlsx"'})


# ------------------------------------------------------ mount -------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_storage()
    log.info("Backend started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
