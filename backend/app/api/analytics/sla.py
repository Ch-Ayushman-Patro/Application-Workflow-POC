from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.analytics.sla_analysis import get_sla
from app.schemas.all import AnalyticsSla

router = APIRouter()

@router.get("/sla", response_model=AnalyticsSla)
def api_get_sla(db: Session = Depends(get_db)):
    return get_sla(db)
