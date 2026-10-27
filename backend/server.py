from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import AliasChoices, BaseModel, Field, BeforeValidator, ConfigDict
from typing import Annotated, List, Optional
from bson import ObjectId
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api_router = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, validation_alias=AliasChoices("_id", "id"))

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)

    def to_mongo(self) -> dict:
        return self.model_dump(exclude={"id"})


class Note(BaseDocument):
    title: str
    body: str = ""
    is_task: bool = False
    done: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class NoteCreate(BaseModel):
    title: str
    body: str = ""
    is_task: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    is_task: Optional[bool] = None
    done: Optional[bool] = None


SEED = [
    ("Buy groceries", "Milk, eggs, bread, coffee", True, False),
    ("Call the dentist", "Book a check-up for next week", True, True),
    ("Project ideas", "1. Habit tracker\n2. Recipe box\n3. Trip planner", False, False),
    ("Pay electricity bill", "Due on the 15th", True, False),
    ("Meeting notes", "Discuss Q3 roadmap and testing plan", False, False),
    ("Water the plants", "", True, False),
    ("Book list", "Clean Code, The Pragmatic Programmer", False, False),
    ("Renew passport", "Check required documents", True, False),
]


def oid(note_id: str) -> ObjectId:
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=404, detail="Note not found")
    return ObjectId(note_id)


@api_router.get("/")
async def root():
    return {"message": "Good vs Broken API"}


@api_router.get("/notes", response_model=List[Note])
async def list_notes():
    docs = await db.notes.find().sort("created_at", -1).to_list(1000)
    return [Note.from_mongo(d) for d in docs]


@api_router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str):
    doc = await db.notes.find_one({"_id": oid(note_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")
    return Note.from_mongo(doc)


@api_router.post("/notes", response_model=Note)
async def create_note(payload: NoteCreate):
    note = Note(**payload.model_dump())
    res = await db.notes.insert_one(note.to_mongo())
    note.id = str(res.inserted_id)
    return note


@api_router.patch("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, payload: NoteUpdate):
    changes = {k: v for k, v in payload.model_dump().items() if v is not None}
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc = await db.notes.find_one_and_update({"_id": oid(note_id)}, {"$set": changes}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")
    return Note.from_mongo(doc)


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    res = await db.notes.delete_one({"_id": oid(note_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}


@api_router.post("/notes/reset", response_model=List[Note])
async def reset_notes():
    await db.notes.delete_many({})
    notes = []
    base = datetime.now(timezone.utc).timestamp()
    for i, (title, body, is_task, done) in enumerate(SEED):
        ts = datetime.fromtimestamp(base - i, tz=timezone.utc).isoformat()
        n = Note(title=title, body=body, is_task=is_task, done=done, created_at=ts, updated_at=ts)
        res = await db.notes.insert_one(n.to_mongo())
        n.id = str(res.inserted_id)
        notes.append(n)
    return notes


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
