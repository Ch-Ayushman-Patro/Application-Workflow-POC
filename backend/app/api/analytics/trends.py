from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.analytics.trend_analysis import get_trends
from app.schemas.all import AnalyticsTrends

router = APIRouter()

@router.get("/trends", response_model=AnalyticsTrends)
def api_get_trends(db: Session = Depends(get_db)):
    return get_trends(db)
