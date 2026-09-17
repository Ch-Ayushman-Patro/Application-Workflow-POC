import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.all import TaskResponse
from app.services import core

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    logger.info("GET /tasks — listing all tasks.")
    return core.get_tasks(db)


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, actor_id: int = Query(None), db: Session = Depends(get_db)):
    logger.info("POST /tasks/%d/complete — actor_id=%s.", task_id, actor_id)
    task = core.complete_task(db, task_id, actor_id=actor_id)
    if not task:
        logger.warning("Task id=%d not found; returning 404.", task_id)
        raise HTTPException(status_code=404, detail="Task not found")
    logger.info("Task id=%d completed successfully.", task_id)
    return task
