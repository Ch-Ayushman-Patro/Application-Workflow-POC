from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.analytics.workload_analysis import get_workload
from app.schemas.all import AnalyticsWorkload

router = APIRouter()

@router.get("/workload", response_model=AnalyticsWorkload)
def api_get_workload(db: Session = Depends(get_db)):
    return get_workload(db)
