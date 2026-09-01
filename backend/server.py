from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------- Object storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "courtsplit"
_storage_key = None

MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    paid: bool = False


class PlayerInput(BaseModel):
    id: Optional[str] = None
    name: str
    paid: bool = False


class SessionBase(BaseModel):
    venue: str
    date: str
    court_fee: float = Field(default=0, ge=0)
    num_shuttles: int = Field(default=0, ge=0)
    price_per_shuttle: float = Field(default=0, ge=0)
    currency: str = "PHP"
    payment_note: str = ""
    payment_qr_path: str = ""


class SessionCreate(SessionBase):
    players: List[PlayerInput] = []


class Session(SessionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    players: List[Player] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PaidUpdate(BaseModel):
    paid: bool


def normalize_players(players: List[PlayerInput]) -> List[Player]:
    result = []
    for p in players:
        result.append(Player(id=p.id or str(uuid.uuid4()), name=p.name, paid=p.paid))
    return result


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "CourtSplit API"}


@api_router.post("/upload-qr")
async def upload_qr(file: UploadFile = File(...)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png").lower()
    content_type = MIME_TYPES.get(ext, file.content_type or "image/png")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    path = f"{APP_NAME}/qr/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "content_type": content_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"]}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type),
                    headers={"Cache-Control": "public, max-age=31536000"})


@api_router.post("/sessions", response_model=Session)
async def create_session(payload: SessionCreate):
    session = Session(
        **payload.model_dump(exclude={"players"}),
        players=normalize_players(payload.players),
    )
    await db.sessions.insert_one(session.model_dump())
    return session


@api_router.get("/sessions", response_model=List[Session])
async def list_sessions():
    docs = await db.sessions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Session(**d) for d in docs]


@api_router.get("/sessions/{session_id}", response_model=Session)
async def get_session(session_id: str):
    doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return Session(**doc)


@api_router.put("/sessions/{session_id}", response_model=Session)
async def update_session(session_id: str, payload: SessionCreate):
    existing = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    updated = Session(
        **payload.model_dump(exclude={"players"}),
        id=session_id,
        players=normalize_players(payload.players),
        created_at=existing.get("created_at"),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    await db.sessions.replace_one({"id": session_id}, updated.model_dump())
    return updated


@api_router.patch("/sessions/{session_id}/players/{player_id}", response_model=Session)
async def toggle_paid(session_id: str, player_id: str, body: PaidUpdate):
    doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    session = Session(**doc)
    found = False
    for p in session.players:
        if p.id == player_id:
            p.paid = body.paid
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Player not found")
    session.updated_at = datetime.now(timezone.utc).isoformat()
    await db.sessions.replace_one({"id": session_id}, session.model_dump())
    return session


@api_router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    result = await db.sessions.delete_one({"id": session_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_storage():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
