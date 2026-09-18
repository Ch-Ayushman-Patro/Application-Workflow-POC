from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.analytics.time_analysis import get_time
from app.schemas.all import AnalyticsTime

router = APIRouter()

@router.get("/time", response_model=AnalyticsTime)
def api_get_time(db: Session = Depends(get_db)):
    return get_time(db)
