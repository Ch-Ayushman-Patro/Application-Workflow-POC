from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.all import ApplicationEvent
from app.schemas.all import (
    ApplicationResponse, TaskResponse, UserResponse, 
    EventResponse, WorkflowRunResponse, AnalyticsSummary
)
from app.services import core
from app.services.generator import generate_random_cases
from app.seed import seed_db
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
def complete_application(app_id: int, actor_id: int = Query(None), db: Session = Depends(get_db)):
    app = core.complete_application(db, app_id, actor_id=actor_id)
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
def complete_task(task_id: int, actor_id: int = Query(None), db: Session = Depends(get_db)):
    task = core.complete_task(db, task_id, actor_id=actor_id)
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

@router.post("/demo/simulate-inflow")
def simulate_inflow(
    count: int = Query(3, ge=1, le=10, description="Number of applications to simulate"),
    run_workflow: bool = Query(True, description="Whether to evaluate workflow rules immediately"),
    db: Session = Depends(get_db)
):
    """
    Simulate new incoming applications with diverse ages and states,
    and automatically trigger the workflow engine to generate tasks and escalations.
    """
    return generate_random_cases(db, count=count, run_workflow=run_workflow)

@router.post("/demo/reset-and-seed")
def reset_and_seed():
    """
    Resets database and re-populates with a rich set of 12 diverse applications
    and auto-evaluated tasks for demo purposes.
    """
    seed_db()
    return {"message": "Database reset and seeded with 12 applications and active tasks."}
