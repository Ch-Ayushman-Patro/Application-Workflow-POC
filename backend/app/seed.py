from datetime import datetime, timedelta, timezone
from app.database import SessionLocal, engine, Base
from app.models.all import User, Application, Task, ApplicationEvent, ApplicationStatus, UserRole
from app.workflow.rule_engine import WorkflowEngine

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing data safely respecting PostgreSQL foreign keys
    db.query(Task).delete()
    db.query(ApplicationEvent).delete()
    db.query(Application).delete()
    db.query(User).update({User.manager_user_id: None})
    db.query(User).delete()
    db.commit()

    # Create Users with organizational reporting hierarchy:
    # Admin -> Manager -> Claimed Officer
    u_admin = User(name="Alice Admin", role=UserRole.ADMIN.value)
    db.add(u_admin)
    db.commit()
    db.refresh(u_admin)

    u_mgr = User(name="Diana Manager", role=UserRole.MANAGER.value, manager_user_id=u_admin.id)
    db.add(u_mgr)
    db.commit()
    db.refresh(u_mgr)

    u_officer1 = User(name="Bob Officer", role=UserRole.CLAIMED_OFFICER.value, manager_user_id=u_mgr.id)
    db.add(u_officer1)
    db.commit()
    db.refresh(u_officer1)

    u_officer2 = User(name="Charlie Officer", role=UserRole.CLAIMED_OFFICER.value, manager_user_id=u_mgr.id)
    db.add(u_officer2)
    db.commit()
    db.refresh(u_officer2)
    
    now = datetime.now(timezone.utc)

    # 12 Diverse Demo Applications across all states & stages
    apps = [
        # APP-1001: OPEN, unclaimed 3 days ago -> triggers ASSIGNMENT for Admin
        Application(
            application_number="APP-1001",
            status=ApplicationStatus.OPEN,
            current_role="Admin",
            current_stage="Document Intake",
            created_at=now - timedelta(days=3)
        ),
        # APP-1002: CLAIMED by Bob Officer, 1.5 days ago -> triggers FOLLOW_UP
        Application(
            application_number="APP-1002",
            status=ApplicationStatus.CLAIMED,
            claimed_by_user_id=u_officer1.id,
            current_role=u_officer1.role,
            current_stage="Claimed Officer Review",
            created_at=now - timedelta(days=2.5),
            claimed_at=now - timedelta(days=1.5)
        ),
        # APP-1003: CLAIMED by Charlie Officer, 3 days ago -> triggers FOLLOW_UP + ESCALATION to Diana Manager
        Application(
            application_number="APP-1003",
            status=ApplicationStatus.CLAIMED,
            claimed_by_user_id=u_officer2.id,
            current_role=u_officer2.role,
            current_stage="Claimed Officer Review",
            created_at=now - timedelta(days=4.5),
            claimed_at=now - timedelta(days=3.0)
        ),
        # APP-1004: Fresh OPEN application (4 hours ago) -> Healthy
        Application(
            application_number="APP-1004",
            status=ApplicationStatus.OPEN,
            current_role="Admin",
            current_stage="New Intake Queue",
            created_at=now - timedelta(hours=4)
        ),
        # APP-1005: Fresh CLAIMED by Bob Officer (2 hours ago) -> Healthy
        Application(
            application_number="APP-1005",
            status=ApplicationStatus.CLAIMED,
            claimed_by_user_id=u_officer1.id,
            current_role=u_officer1.role,
            current_stage="Claimed Officer Review",
            created_at=now - timedelta(hours=8),
            claimed_at=now - timedelta(hours=2)
        ),
        # APP-1006: COMPLETED -> historical
        Application(
            application_number="APP-1006",
            status=ApplicationStatus.COMPLETED,
            claimed_by_user_id=u_officer1.id,
            current_role=u_officer1.role,
            current_stage="Completed",
            created_at=now - timedelta(days=5),
            claimed_at=now - timedelta(days=4),
            completed_at=now - timedelta(days=1)
        ),
        # APP-1007: OPEN, unclaimed 1.8 days ago -> triggers ASSIGNMENT for Admin
        Application(
            application_number="APP-1007",
            status=ApplicationStatus.OPEN,
            current_role="Admin",
            current_stage="Queue Triage",
            created_at=now - timedelta(days=1.8)
        ),
        # APP-1008: CLAIMED by Bob Officer, 2.7 days ago -> triggers FOLLOW_UP + ESCALATION to Diana Manager
        Application(
            application_number="APP-1008",
            status=ApplicationStatus.CLAIMED,
            claimed_by_user_id=u_officer1.id,
            current_role=u_officer1.role,
            current_stage="Claimed Officer Review",
            created_at=now - timedelta(days=3.5),
            claimed_at=now - timedelta(days=2.7)
        ),
        # APP-1009: CLAIMED by Charlie Officer, 1.4 days ago -> triggers FOLLOW_UP
        Application(
            application_number="APP-1009",
            status=ApplicationStatus.CLAIMED,
            claimed_by_user_id=u_officer2.id,
            current_role=u_officer2.role,
            current_stage="Claimed Officer Review",
            created_at=now - timedelta(days=2.2),
            claimed_at=now - timedelta(days=1.4)
        ),
        # APP-1010: COMPLETED -> historical
        Application(
            application_number="APP-1010",
            status=ApplicationStatus.COMPLETED,
            claimed_by_user_id=u_officer2.id,
            current_role=u_officer2.role,
            current_stage="Completed",
            created_at=now - timedelta(days=4),
            claimed_at=now - timedelta(days=3.2),
            completed_at=now - timedelta(days=1.8)
        ),
        # APP-1011: COMPLETED -> historical
        Application(
            application_number="APP-1011",
            status=ApplicationStatus.COMPLETED,
            claimed_by_user_id=u_admin.id,
            current_role=u_admin.role,
            current_stage="Completed",
            created_at=now - timedelta(days=6),
            claimed_at=now - timedelta(days=5.5),
            completed_at=now - timedelta(days=4.8)
        ),
        # APP-1012: Fresh OPEN application (1 hour ago) -> Healthy
        Application(
            application_number="APP-1012",
            status=ApplicationStatus.OPEN,
            current_role="Admin",
            current_stage="Direct Online Submission",
            created_at=now - timedelta(hours=1)
        ),
    ]

    for app in apps:
        db.add(app)
    db.commit()

    # Create Timeline Events for all seeded applications
    for app in apps:
        db.refresh(app)
        db.add(ApplicationEvent(
            application_id=app.id,
            event_type="APPLICATION_CREATED",
            timestamp=app.created_at,
            details=f"Application {app.application_number} submitted"
        ))
        if app.claimed_at:
            db.add(ApplicationEvent(
                application_id=app.id,
                event_type="APPLICATION_CLAIMED",
                actor_id=app.claimed_by_user_id,
                timestamp=app.claimed_at,
                details=f"Claimed by {app.claimed_by.name if app.claimed_by else 'Claimed Officer'}"
            ))
        if app.completed_at:
            db.add(ApplicationEvent(
                application_id=app.id,
                event_type="APPLICATION_COMPLETED",
                timestamp=app.completed_at,
                details=f"Application {app.application_number} finalized"
            ))
            
    db.commit()

    # Run workflow engine so SLA tasks and escalations are pre-populated
    workflow_engine = WorkflowEngine(db)
    stats = workflow_engine.evaluate_all()
    
    db.close()
    print(f"Database seeded successfully with 12 applications.")
    print(f"Workflow Engine initialized: {stats}")

if __name__ == "__main__":
    seed_db()
