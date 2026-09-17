import logging
from sqlalchemy.orm import Session
from app.models.all import Application, Task, User, ApplicationEvent, ApplicationStatus, TaskStatus, ApplicationDecision
from datetime import datetime, timezone
from typing import List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application queries
# ---------------------------------------------------------------------------

def get_applications(db: Session) -> List[Application]:
    logger.info("Fetching all applications.")
    apps = db.query(Application).all()
    logger.info("Found %d applications.", len(apps))
    return apps


def get_application(db: Session, app_id: int) -> Application:
    logger.info("Fetching application id=%d.", app_id)
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        logger.warning("Application id=%d not found.", app_id)
    return app


# ---------------------------------------------------------------------------
# Event helper
# ---------------------------------------------------------------------------

def create_event(db: Session, app_id: int, event_type: str, actor_id: int = None, details: str = None, timestamp: datetime = None):
    logger.debug(
        "Creating event type=%s for application_id=%d actor_id=%s.",
        event_type, app_id, actor_id
    )
    ts = timestamp if timestamp else datetime.now(timezone.utc)
    event = ApplicationEvent(
        application_id=app_id,
        event_type=event_type,
        actor_id=actor_id,
        details=details,
        timestamp=ts,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    logger.debug("Event id=%d created (type=%s).", event.id, event_type)
    return event


# ---------------------------------------------------------------------------
# Claim
# ---------------------------------------------------------------------------

def claim_application(db: Session, app_id: int, user_id: int):
    logger.info("Claiming application id=%d by user_id=%d.", app_id, user_id)
    app = get_application(db, app_id)
    if not app:
        return None

    app.status = ApplicationStatus.CLAIMED
    app.claimed_by_user_id = user_id
    app.claimed_at = datetime.now(timezone.utc)
    app.current_stage = "Underwriting Review"

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        app.current_role = user.role
        logger.info("Application id=%d assigned to user '%s' (role=%s).", app_id, user.name, user.role)
    else:
        logger.warning("User id=%d not found during claim of application id=%d.", user_id, app_id)

    # Close open ASSIGNMENT tasks for this application
    open_assignment_tasks = db.query(Task).filter(
        Task.application_id == app_id,
        Task.task_type == "ASSIGNMENT",
        Task.status == TaskStatus.OPEN
    ).all()
    if open_assignment_tasks:
        logger.info(
            "Closing %d open ASSIGNMENT task(s) for application id=%d.",
            len(open_assignment_tasks), app_id
        )
    for task in open_assignment_tasks:
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc)
        create_event(db, app_id, "TASK_COMPLETED", actor_id=user_id, details="Assignment task completed via claim")

    db.commit()
    db.refresh(app)
    create_event(db, app.id, "APPLICATION_CLAIMED", actor_id=user_id)
    logger.info("Application id=%d successfully claimed.", app_id)
    return app


# ---------------------------------------------------------------------------
# Complete (legacy)
# ---------------------------------------------------------------------------

def complete_application(db: Session, app_id: int, actor_id: int = None):
    logger.info("Completing application id=%d (actor_id=%s).", app_id, actor_id)
    app = get_application(db, app_id)
    if not app:
        return None

    app.status = ApplicationStatus.COMPLETED
    if not app.decision:
        app.decision = ApplicationDecision.APPROVED.value
        logger.info("No explicit decision set for application id=%d; defaulting to APPROVED.", app_id)
    app.completed_at = datetime.now(timezone.utc)
    app.current_stage = "Approved"

    # Close all open tasks for this application
    open_tasks = db.query(Task).filter(
        Task.application_id == app_id,
        Task.status == TaskStatus.OPEN
    ).all()
    if open_tasks:
        logger.info("Auto-closing %d open task(s) for application id=%d.", len(open_tasks), app_id)
    for task in open_tasks:
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc)
        create_event(db, app_id, "TASK_COMPLETED", actor_id=actor_id, details=f"Task {task.task_type} completed via application completion")

    db.commit()
    db.refresh(app)
    create_event(db, app.id, "APPLICATION_COMPLETED", actor_id=actor_id)
    logger.info("Application id=%d marked COMPLETED (decision=%s).", app_id, app.decision)
    return app


# ---------------------------------------------------------------------------
# Decide (Approve / Reject)
# ---------------------------------------------------------------------------

def decide_application(db: Session, app_id: int, decision: str, actor_id: int = None):
    logger.info(
        "Recording decision='%s' for application id=%d (actor_id=%s).",
        decision, app_id, actor_id
    )
    app = get_application(db, app_id)
    if not app:
        return None

    decision_norm = decision.upper()
    if decision_norm not in [ApplicationDecision.APPROVED.value, ApplicationDecision.REJECTED.value]:
        logger.error("Invalid decision '%s' for application id=%d.", decision, app_id)
        raise ValueError(f"Invalid decision: {decision}. Must be 'APPROVED' or 'REJECTED'")

    app.status = ApplicationStatus.COMPLETED
    app.decision = decision_norm
    app.completed_at = datetime.now(timezone.utc)
    app.current_stage = "Approved" if decision_norm == ApplicationDecision.APPROVED.value else "Rejected"

    # Close all remaining open tasks
    open_tasks = db.query(Task).filter(
        Task.application_id == app_id,
        Task.status == TaskStatus.OPEN
    ).all()
    if open_tasks:
        logger.info(
            "Auto-closing %d open task(s) for application id=%d on decision.",
            len(open_tasks), app_id
        )
    for task in open_tasks:
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc)
        create_event(db, app_id, "TASK_COMPLETED", actor_id=actor_id, details=f"Task {task.task_type} completed via application decision ({decision_norm})")

    db.commit()
    db.refresh(app)

    actor_user = db.query(User).filter(User.id == actor_id).first() if actor_id else None
    actor_name = actor_user.name if actor_user else (app.claimed_by.name if app.claimed_by else "Underwriter")

    if decision_norm == ApplicationDecision.APPROVED.value:
        event_type = "APPLICATION_APPROVED"
        details = f"Application approved by {actor_name}"
    else:
        event_type = "APPLICATION_REJECTED"
        details = f"Application rejected by {actor_name}"

    create_event(db, app.id, event_type, actor_id=actor_id, details=details)
    logger.info(
        "Application id=%d decision=%s recorded. Actor: %s.",
        app_id, decision_norm, actor_name
    )
    return app


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

def get_tasks(db: Session) -> List[Task]:
    logger.info("Fetching all tasks.")
    tasks = db.query(Task).all()
    logger.info("Found %d tasks.", len(tasks))
    return tasks


def get_task(db: Session, task_id: int) -> Task:
    logger.info("Fetching task id=%d.", task_id)
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        logger.warning("Task id=%d not found.", task_id)
    return task


def complete_task(db: Session, task_id: int, actor_id: int = None):
    logger.info("Completing task id=%d (actor_id=%s).", task_id, actor_id)
    task = get_task(db, task_id)
    if not task:
        return None
    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    create_event(db, task.application_id, "TASK_COMPLETED", actor_id=actor_id, details=f"Task {task.task_type} completed")
    logger.info("Task id=%d completed (type=%s, application_id=%d).", task_id, task.task_type, task.application_id)
    return task


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def get_users(db: Session) -> List[User]:
    logger.info("Fetching all users.")
    users = db.query(User).all()
    logger.info("Found %d users.", len(users))
    return users


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------

def get_app_timeline(db: Session, app_id: int):
    logger.info("Fetching timeline for application id=%d.", app_id)
    events = (
        db.query(ApplicationEvent)
        .filter(ApplicationEvent.application_id == app_id)
        .order_by(ApplicationEvent.timestamp.asc())
        .all()
    )
    logger.info("Found %d timeline events for application id=%d.", len(events), app_id)
    return events
