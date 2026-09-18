from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.analytics.overview_analysis import get_overview
from app.schemas.all import AnalyticsOverview

router = APIRouter()

@router.get("/overview", response_model=AnalyticsOverview)
def api_get_overview(db: Session = Depends(get_db)):
    return get_overview(db)
