from sqlalchemy.orm import Session
from app.models.all import Application, Task, User, ApplicationEvent, ApplicationStatus, TaskStatus
from datetime import datetime, timezone
from typing import List

def get_applications(db: Session) -> List[Application]:
    return db.query(Application).all()

def get_application(db: Session, app_id: int) -> Application:
    return db.query(Application).filter(Application.id == app_id).first()

def create_event(db: Session, app_id: int, event_type: str, actor_id: int = None, details: str = None, timestamp: datetime = None):
    if timestamp:
        event = ApplicationEvent(application_id=app_id, event_type=event_type, actor_id=actor_id, details=details, timestamp=timestamp)
    else:
        event = ApplicationEvent(application_id=app_id, event_type=event_type, actor_id=actor_id, details=details, timestamp=datetime.now(timezone.utc))
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def claim_application(db: Session, app_id: int, user_id: int):
    app = get_application(db, app_id)
    if not app:
        return None
    app.status = ApplicationStatus.CLAIMED
    app.claimed_by_user_id = user_id
    app.claimed_at = datetime.now(timezone.utc)
    app.current_stage = "Claimed Officer Review"
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        app.current_role = user.role
    db.commit()
    db.refresh(app)
    create_event(db, app.id, "APPLICATION_CLAIMED", actor_id=user_id)
    return app

def complete_application(db: Session, app_id: int, actor_id: int = None):
    app = get_application(db, app_id)
    if not app:
        return None
    app.status = ApplicationStatus.COMPLETED
    app.completed_at = datetime.now(timezone.utc)
    app.current_stage = "Completed"
    db.commit()
    db.refresh(app)
    create_event(db, app.id, "APPLICATION_COMPLETED", actor_id=actor_id)
    return app

def get_tasks(db: Session) -> List[Task]:
    return db.query(Task).all()

def get_task(db: Session, task_id: int) -> Task:
    return db.query(Task).filter(Task.id == task_id).first()

def complete_task(db: Session, task_id: int, actor_id: int = None):
    task = get_task(db, task_id)
    if not task:
        return None
    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    create_event(db, task.application_id, "TASK_COMPLETED", actor_id=actor_id, details=f"Task {task.task_type} completed")
    return task

def get_users(db: Session) -> List[User]:
    return db.query(User).all()

def get_app_timeline(db: Session, app_id: int):
    return db.query(ApplicationEvent).filter(ApplicationEvent.application_id == app_id).order_by(ApplicationEvent.timestamp.asc()).all()

