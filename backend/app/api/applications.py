import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.schemas.all import ApplicationResponse, EventResponse, DecisionRequest
from app.services import core

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationResponse])
def get_applications(db: Session = Depends(get_db)):
    logger.info("GET /applications — listing all applications.")
    return core.get_applications(db)


@router.get("/{app_id}", response_model=ApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db)):
    logger.info("GET /applications/%d.", app_id)
    app = core.get_application(db, app_id)
    if not app:
        logger.warning("Application id=%d not found; returning 404.", app_id)
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.post("/{app_id}/claim", response_model=ApplicationResponse)
def claim_application(app_id: int, user_id: int, db: Session = Depends(get_db)):
    logger.info("POST /applications/%d/claim — user_id=%d.", app_id, user_id)
    app = core.claim_application(db, app_id, user_id)
    if not app:
        logger.warning("Application id=%d not found during claim; returning 404.", app_id)
        raise HTTPException(status_code=404, detail="Application not found")
    logger.info("Application id=%d claimed successfully.", app_id)
    return app


@router.post("/{app_id}/complete", response_model=ApplicationResponse)
def complete_application(app_id: int, actor_id: int = Query(None), db: Session = Depends(get_db)):
    logger.info("POST /applications/%d/complete — actor_id=%s.", app_id, actor_id)
    app = core.complete_application(db, app_id, actor_id=actor_id)
    if not app:
        logger.warning("Application id=%d not found during complete; returning 404.", app_id)
        raise HTTPException(status_code=404, detail="Application not found")
    logger.info("Application id=%d completed (legacy endpoint).", app_id)
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
    logger.info("POST /applications/%d/decision — decision=%s actor_id=%s.", app_id, dec, act)
    if not dec:
        logger.warning("Decision parameter missing for application id=%d.", app_id)
        raise HTTPException(status_code=400, detail="Decision parameter ('APPROVED' or 'REJECTED') is required")
    try:
        app = core.decide_application(db, app_id, decision=dec, actor_id=act)
    except ValueError as e:
        logger.error("Invalid decision value for application id=%d: %s", app_id, e)
        raise HTTPException(status_code=400, detail=str(e))
    if not app:
        logger.warning("Application id=%d not found during decision; returning 404.", app_id)
        raise HTTPException(status_code=404, detail="Application not found")
    logger.info("Application id=%d decision=%s recorded.", app_id, dec)
    return app


@router.get("/{app_id}/timeline", response_model=List[EventResponse])
def get_application_timeline(app_id: int, db: Session = Depends(get_db)):
    logger.info("GET /applications/%d/timeline.", app_id)
    return core.get_app_timeline(db, app_id)
