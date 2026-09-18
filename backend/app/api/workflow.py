import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.all import WorkflowRunResponse
from app.services.generator import generate_random_cases
from app.seed import seed_db
from app.workflow.rule_engine import WorkflowEngine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Workflow"])


@router.post("/workflow/run", response_model=WorkflowRunResponse)
def run_workflow(db: Session = Depends(get_db)):
    logger.info("POST /workflow/run — triggering WorkflowEngine evaluation.")
    engine = WorkflowEngine(db)
    stats = engine.evaluate_all()
    logger.info("WorkflowEngine finished: %s", stats)
    return stats


@router.post("/demo/simulate-inflow")
def simulate_inflow(
    count: int = Query(50, ge=1, le=100, description="Number of applications to simulate"),
    run_workflow: bool = Query(True, description="Whether to evaluate workflow rules immediately"),
    db: Session = Depends(get_db)
):
    """
    Simulate new incoming applications with diverse ages and states,
    and automatically trigger the workflow engine to generate tasks and escalations.
    """
    logger.info("POST /demo/simulate-inflow — count=%d run_workflow=%s.", count, run_workflow)
    result = generate_random_cases(db, count=count, run_workflow=run_workflow)
    logger.info(
        "Simulated %d case(s): %s. Workflow stats: %s",
        result.get("cases_created"), result.get("application_numbers"), result.get("workflow_stats")
    )
    return result


@router.post("/demo/reset-and-seed")
def reset_and_seed():
    """
    Resets database and re-populates with a rich set of 12 diverse applications
    and auto-evaluated tasks for demo purposes.
    """
    logger.info("POST /demo/reset-and-seed — resetting and re-seeding database.")
    seed_db()
    logger.info("Database reset and seeded successfully.")
    return {"message": "Database reset and seeded with 12 applications and active tasks."}
