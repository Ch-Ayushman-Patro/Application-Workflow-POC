from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.applications import router as applications_router
from app.api.tasks import router as tasks_router
from app.api.users import router as users_router
from app.api.workflow import router as workflow_router
from app.api.analytics import router as analytics_router
from app.database import engine, Base
import app.models.all

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Application Workflow POC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(workflow_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Application Workflow POC API is running."}

