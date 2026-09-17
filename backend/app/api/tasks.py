from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.all import TaskResponse
from app.services import core

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    return core.get_tasks(db)


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, actor_id: int = Query(None), db: Session = Depends(get_db)):
    task = core.complete_task(db, task_id, actor_id=actor_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

