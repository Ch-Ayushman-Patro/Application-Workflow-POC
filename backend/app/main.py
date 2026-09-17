import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api.applications import router as applications_router
from app.api.tasks import router as tasks_router
from app.api.users import router as users_router
from app.api.workflow import router as workflow_router
from app.api.analytics import router as analytics_router
from app.database import engine, Base
import app.models.all

# ---------------------------------------------------------------------------
# Root logger configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DB bootstrap
# ---------------------------------------------------------------------------
Base.metadata.create_all(bind=engine)
logger.info("Database tables verified / created via SQLAlchemy metadata.")

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(title="Application Workflow")

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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info("← %s %s  status=%d", request.method, request.url.path, response.status_code)
    return response


app.include_router(applications_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(workflow_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")

logger.info("All routers registered: applications, tasks, users, workflow, analytics.")


@app.get("/")
def root():
    logger.debug("Root health-check endpoint called.")
    return {"message": "Application Workflow API is running."}
