from fastapi import APIRouter
from . import overview, time, sla, workload, trends, insights

router = APIRouter(prefix="/analytics", tags=["Analytics"])
router.include_router(overview.router)
router.include_router(time.router)
router.include_router(sla.router)
router.include_router(workload.router)
router.include_router(trends.router)
router.include_router(insights.router)
