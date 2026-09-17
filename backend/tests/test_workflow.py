import pytest
from datetime import datetime, timedelta, timezone

from app.database import engine, SessionLocal
from app.models.all import User, Application, Task, ApplicationStatus, TaskType
from app.workflow.rule_engine import WorkflowEngine

@pytest.fixture()
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection, join_transaction_mode="create_savepoint")
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

def test_workflow_engine_creates_assignment_task(db):
    now = datetime.now(timezone.utc)
    app = Application(
        application_number="TEST-ASSIGN-1",
        status=ApplicationStatus.OPEN,
        created_at=now - timedelta(days=2)
    )
    db.add(app)
    db.commit()

    engine = WorkflowEngine(db)
    stats = engine.evaluate_all()

    assert stats["tasks_created"] >= 1
    task = db.query(Task).filter(
        Task.application_id == app.id,
        Task.task_type == TaskType.ASSIGNMENT
    ).first()
    assert task is not None
    assert task.assigned_to_role == "Admin"
    
def test_workflow_engine_creates_followup_and_escalation(db):
    now = datetime.now(timezone.utc)
    u_admin = User(name="Test Admin", role="Admin")
    db.add(u_admin)
    db.commit()
    
    u_officer = User(name="Test Underwriter", role="Underwriter", manager_user_id=u_admin.id)
    db.add(u_officer)
    db.commit()

    app = Application(
        application_number="TEST-CLAIM-2",
        status=ApplicationStatus.CLAIMED,
        claimed_by_user_id=u_officer.id,
        current_role="Underwriter",
        created_at=now - timedelta(days=4),
        claimed_at=now - timedelta(days=3)
    )
    db.add(app)
    db.commit()

    engine = WorkflowEngine(db)
    stats = engine.evaluate_all()

    tasks = db.query(Task).filter(Task.application_id == app.id).all()
    types = [t.task_type for t in tasks]
    assert TaskType.FOLLOW_UP in types
    assert TaskType.ESCALATION in types

def test_claim_closes_assignment_task(db):
    from app.services.core import claim_application
    now = datetime.now(timezone.utc)
    app = Application(
        application_number="TEST-ASSIGN-CLOSE",
        status=ApplicationStatus.OPEN,
        created_at=now - timedelta(days=2)
    )
    db.add(app)
    db.commit()

    engine = WorkflowEngine(db)
    engine.evaluate_all()
    
    tasks = db.query(Task).filter(Task.application_id == app.id, Task.status == "OPEN").all()
    assert len(tasks) >= 1
    
    u_officer = User(name="Test Underwriter", role="Underwriter")
    db.add(u_officer)
    db.commit()
    
    claim_application(db, app.id, u_officer.id)
    
    tasks_after = db.query(Task).filter(Task.application_id == app.id, Task.status == "OPEN").all()
    assert len(tasks_after) == 0
    tasks_all = db.query(Task).filter(Task.application_id == app.id).all()
    assert len(tasks_all) >= 1
    assert all(t.status == "COMPLETED" for t in tasks_all)

def test_admin_does_not_escalate_to_self(db):
    now = datetime.now(timezone.utc)
    u_admin = User(name="Test Admin 2", role="Admin", manager_user_id=None)
    db.add(u_admin)
    db.commit()

    app = Application(
        application_number="TEST-CLAIM-ADMIN",
        status=ApplicationStatus.CLAIMED,
        claimed_by_user_id=u_admin.id,
        current_role="Admin",
        created_at=now - timedelta(days=4),
        claimed_at=now - timedelta(days=3)
    )
    db.add(app)
    db.commit()

    engine = WorkflowEngine(db)
    engine.evaluate_all()

    tasks = db.query(Task).filter(Task.application_id == app.id).all()
    types = [t.task_type for t in tasks]
    assert TaskType.FOLLOW_UP in types
    assert TaskType.ESCALATION not in types

def test_decide_application_approve(db):
    from app.services.core import decide_application, create_event
    now = datetime.now(timezone.utc)
    u_officer = User(name="Officer Bob", role="Underwriter")
    db.add(u_officer)
    db.commit()

    app = Application(
        application_number="TEST-DECIDE-APP",
        status=ApplicationStatus.CLAIMED,
        claimed_by_user_id=u_officer.id,
        current_role="Underwriter",
        current_stage="Underwriting Review",
        created_at=now - timedelta(days=3),
        claimed_at=now - timedelta(days=2)
    )
    db.add(app)
    db.commit()

    # Create an open task
    task = Task(
        application_id=app.id,
        task_type=TaskType.FOLLOW_UP,
        title="Follow up",
        description="Review case",
        assigned_to_user_id=u_officer.id,
        status="OPEN"
    )
    db.add(task)
    db.commit()

    # Decide APPROVE
    decided_app = decide_application(db, app.id, decision="APPROVED", actor_id=u_officer.id)
    assert decided_app.status == ApplicationStatus.COMPLETED
    assert decided_app.decision == "APPROVED"
    assert decided_app.current_stage == "Approved"
    assert decided_app.completed_at is not None

    # Verify task auto-closed
    db.refresh(task)
    assert task.status == "COMPLETED"

    # Verify timeline event
    from app.models.all import ApplicationEvent
    event = db.query(ApplicationEvent).filter(
        ApplicationEvent.application_id == app.id,
        ApplicationEvent.event_type == "APPLICATION_APPROVED"
    ).first()
    assert event is not None
    assert event.actor_id == u_officer.id
    assert "Officer Bob" in event.details

    # Workflow engine should skip decided application
    engine = WorkflowEngine(db)
    stats = engine.evaluate_all()
    tasks_after = db.query(Task).filter(Task.application_id == app.id, Task.status == "OPEN").all()
    assert len(tasks_after) == 0

def test_decide_application_reject(db):
    from app.services.core import decide_application
    now = datetime.now(timezone.utc)
    u_officer = User(name="Officer Charlie", role="Underwriter")
    db.add(u_officer)
    db.commit()

    app = Application(
        application_number="TEST-DECIDE-REJ",
        status=ApplicationStatus.CLAIMED,
        claimed_by_user_id=u_officer.id,
        current_role="Underwriter",
        current_stage="Underwriting Review",
        created_at=now - timedelta(days=2),
        claimed_at=now - timedelta(days=1)
    )
    db.add(app)
    db.commit()

    decided_app = decide_application(db, app.id, decision="REJECTED", actor_id=u_officer.id)
    assert decided_app.status == ApplicationStatus.COMPLETED
    assert decided_app.decision == "REJECTED"
    assert decided_app.current_stage == "Rejected"
    assert decided_app.completed_at is not None

    from app.models.all import ApplicationEvent
    event = db.query(ApplicationEvent).filter(
        ApplicationEvent.application_id == app.id,
        ApplicationEvent.event_type == "APPLICATION_REJECTED"
    ).first()
    assert event is not None
    assert event.actor_id == u_officer.id
    assert "Officer Charlie" in event.details


