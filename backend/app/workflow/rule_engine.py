import logging
from sqlalchemy.orm import Session
from app.models.all import Application, Task, User, ApplicationStatus, TaskStatus, TaskType
from datetime import datetime, timezone
from app.services.core import create_event
import math

logger = logging.getLogger(__name__)


class WorkflowEngine:
    def __init__(self, db: Session):
        self.db = db

    def evaluate_all(self):
        applications = self.db.query(Application).filter(Application.status != ApplicationStatus.COMPLETED).all()
        stats = {
            "applications_checked": len(applications),
            "tasks_created": 0,
            "tasks_already_existing": 0,
            "escalations_created": 0
        }

        logger.info("WorkflowEngine: evaluating %d non-completed application(s).", len(applications))
        now = datetime.now(timezone.utc)

        for app in applications:
            logger.debug("Evaluating application id=%d (status=%s).", app.id, app.status)

            # Rule 1: OPEN + NOT CLAIMED + age > 1 day -> ASSIGNMENT task for Admin
            if app.status == ApplicationStatus.OPEN and not app.claimed_by_user_id:
                app_created = app.created_at
                if app_created.tzinfo is None:
                    app_created = app_created.replace(tzinfo=timezone.utc)
                age_days = (now - app_created).total_seconds() / 86400.0
                if age_days > 1.0:
                    logger.info(
                        "Rule 1 triggered: application id=%d is unclaimed and %.2f days old — creating ASSIGNMENT task.",
                        app.id, age_days
                    )
                    if self._create_task_if_not_exists(app.id, TaskType.ASSIGNMENT, "Admin"):
                        stats["tasks_created"] += 1
                    else:
                        stats["tasks_already_existing"] += 1

            # CLAIMED application rules
            elif app.status == ApplicationStatus.CLAIMED and app.claimed_by_user_id:
                claimed_at = app.claimed_at or app.created_at
                if claimed_at.tzinfo is None:
                    claimed_at = claimed_at.replace(tzinfo=timezone.utc)
                duration_days = (now - claimed_at).total_seconds() / 86400.0

                # Rule 2: CLAIMED + duration > 1 day -> FOLLOW_UP task for claimed user
                if duration_days > 1.0:
                    logger.info(
                        "Rule 2 triggered: application id=%d claimed %.2f days ago — creating FOLLOW_UP task.",
                        app.id, duration_days
                    )
                    if self._create_task_if_not_exists(app.id, TaskType.FOLLOW_UP, app.current_role or "Underwriter", app.claimed_by_user_id):
                        stats["tasks_created"] += 1
                    else:
                        stats["tasks_already_existing"] += 1

                # Rule 3: CLAIMED + duration > 2 days -> ESCALATION to manager/next role
                if duration_days > 2.0:
                    user = self.db.query(User).filter(User.id == app.claimed_by_user_id).first()
                    manager = None
                    if user and user.manager_user_id:
                        manager = self.db.query(User).filter(User.id == user.manager_user_id).first()

                    if not manager and user and user.role == "Admin":
                        # Suppress meaningless escalations back to Admin if they are the owner and have no manager
                        logger.debug(
                            "Rule 3 skipped: application id=%d owner is Admin with no manager — suppressing escalation.",
                            app.id
                        )
                    else:
                        role = manager.role if manager else "Admin"
                        assigned_to_user = manager.id if manager else None

                        logger.info(
                            "Rule 3 triggered: application id=%d claimed %.2f days ago — creating ESCALATION to '%s'.",
                            app.id, duration_days, role
                        )
                        if self._create_task_if_not_exists(app.id, TaskType.ESCALATION, role, assigned_to_user, escalation_level=1):
                            stats["tasks_created"] += 1
                            stats["escalations_created"] += 1
                        else:
                            stats["tasks_already_existing"] += 1

        logger.info(
            "WorkflowEngine complete: checked=%d created=%d existing=%d escalations=%d.",
            stats["applications_checked"],
            stats["tasks_created"],
            stats["tasks_already_existing"],
            stats["escalations_created"],
        )
        return stats

    def _create_task_if_not_exists(self, app_id: int, task_type: TaskType, role: str, user_id: int = None, escalation_level: int = 0) -> bool:
        # Check if open task of this type exists for this app
        existing = self.db.query(Task).filter(
            Task.application_id == app_id,
            Task.task_type == task_type,
            Task.status == TaskStatus.OPEN
        ).first()

        if existing:
            logger.debug(
                "Task type=%s already exists (id=%d) for application_id=%d — skipping creation.",
                task_type, existing.id, app_id
            )
            return False

        task = Task(
            application_id=app_id,
            task_type=task_type,
            title=f"{task_type.value} required",
            description=f"Auto-generated {task_type.value.lower()} task based on workflow rules.",
            assigned_to_user_id=user_id,
            assigned_to_role=role,
            status=TaskStatus.OPEN,
            escalation_level=escalation_level
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        logger.info(
            "Created task id=%d type=%s for application_id=%d assigned_to role='%s' user_id=%s.",
            task.id, task_type, app_id, role, user_id
        )

        create_event(
            self.db,
            app_id,
            "TASK_CREATED",
            details=f"Task {task_type.value} created for {role or 'User ' + str(user_id)}"
        )
        return True
