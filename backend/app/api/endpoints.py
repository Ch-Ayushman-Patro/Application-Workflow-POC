from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.all import ApplicationEvent
from app.schemas.all import (
    ApplicationResponse, TaskResponse, UserResponse, 
    EventResponse, WorkflowRunResponse, AnalyticsSummary
)
from app.services import core
from app.workflow.rule_engine import WorkflowEngine
from app.analytics import time_analysis

router = APIRouter()

@router.get("/applications", response_model=List[ApplicationResponse])
def get_applications(db: Session = Depends(get_db)):
    return core.get_applications(db)

@router.get("/applications/{app_id}", response_model=ApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db)):
    app = core.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app

@router.post("/applications/{app_id}/claim", response_model=ApplicationResponse)
def claim_application(app_id: int, user_id: int, db: Session = Depends(get_db)):
    app = core.claim_application(db, app_id, user_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app

@router.post("/applications/{app_id}/complete", response_model=ApplicationResponse)
def complete_application(app_id: int, db: Session = Depends(get_db)):
    app = core.complete_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app

@router.get("/applications/{app_id}/timeline", response_model=List[EventResponse])
def get_application_timeline(app_id: int, db: Session = Depends(get_db)):
    return core.get_app_timeline(db, app_id)

@router.get("/tasks", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    return core.get_tasks(db)

@router.post("/tasks/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = core.complete_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/users", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return core.get_users(db)

@router.post("/workflow/run", response_model=WorkflowRunResponse)
def run_workflow(db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    stats = engine.evaluate_all()
    return stats

@router.get("/analytics/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    return time_analysis.calculate_summary(db)

