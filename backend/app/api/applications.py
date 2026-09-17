from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.schemas.all import ApplicationResponse, EventResponse, DecisionRequest
from app.services import core

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationResponse])
def get_applications(db: Session = Depends(get_db)):
    return core.get_applications(db)


@router.get("/{app_id}", response_model=ApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db)):
    app = core.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.post("/{app_id}/claim", response_model=ApplicationResponse)
def claim_application(app_id: int, user_id: int, db: Session = Depends(get_db)):
    app = core.claim_application(db, app_id, user_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.post("/{app_id}/complete", response_model=ApplicationResponse)
def complete_application(app_id: int, actor_id: int = Query(None), db: Session = Depends(get_db)):
    app = core.complete_application(db, app_id, actor_id=actor_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.post("/{app_id}/decision", response_model=ApplicationResponse)
def decide_application(
    app_id: int,
    request: Optional[DecisionRequest] = None,
    decision: Optional[str] = Query(None),
    actor_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    dec = request.decision if request and request.decision else decision
    act = request.actor_id if request and request.actor_id is not None else actor_id
    if not dec:
        raise HTTPException(status_code=400, detail="Decision parameter ('APPROVED' or 'REJECTED') is required")
    try:
        app = core.decide_application(db, app_id, decision=dec, actor_id=act)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.get("/{app_id}/timeline", response_model=List[EventResponse])
def get_application_timeline(app_id: int, db: Session = Depends(get_db)):
    return core.get_app_timeline(db, app_id)


