from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.analytics.insight_engine import get_insights
from app.schemas.all import AnalyticsInsightsResponse

router = APIRouter()


import traceback
from fastapi import HTTPException

@router.get("/insights", response_model=AnalyticsInsightsResponse)
def api_get_insights(db: Session = Depends(get_db)):
    try:
        return get_insights(db)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

