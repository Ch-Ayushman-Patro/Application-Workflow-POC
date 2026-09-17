from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.all import WorkflowRunResponse
from app.services.generator import generate_random_cases
from app.seed import seed_db
from app.workflow.rule_engine import WorkflowEngine

router = APIRouter(tags=["Workflow"])


@router.post("/workflow/run", response_model=WorkflowRunResponse)
def run_workflow(db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    stats = engine.evaluate_all()
    return stats


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

