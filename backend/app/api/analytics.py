import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.all import AnalyticsSummary
from app.analytics import time_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    logger.info("GET /analytics/summary — calculating analytics summary.")
    summary = time_analysis.calculate_summary(db)
    logger.info(
        "Analytics summary: total=%d open=%d claimed=%d completed=%d approved=%d rejected=%d.",
        summary.get("total_applications", 0),
        summary.get("open_applications", 0),
        summary.get("claimed_applications", 0),
        summary.get("completed_applications", 0),
        summary.get("approved_applications", 0),
        summary.get("rejected_applications", 0),
    )
    return summary
