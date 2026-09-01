from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
