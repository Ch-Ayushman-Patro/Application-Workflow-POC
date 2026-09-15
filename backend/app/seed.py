from datetime import datetime, timedelta, timezone
from app.database import SessionLocal, engine, Base
from app.models.all import User, Application, Task, ApplicationEvent, ApplicationStatus

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

    # Create Users (Admin -> Processor -> Underwriter -> Underwriting Manager)
    u_admin = User(name="Alice Admin", role="Admin")
    db.add(u_admin)
    db.commit()
    db.refresh(u_admin)

    u_proc = User(name="Bob Processor", role="Processor", manager_user_id=u_admin.id)
    db.add(u_proc)
    db.commit()
    db.refresh(u_proc)

    u_under = User(name="Charlie Underwriter", role="Underwriter", manager_user_id=u_proc.id)
    db.add(u_under)
    db.commit()
    db.refresh(u_under)

    u_mgr = User(name="Diana Manager", role="Underwriting Manager", manager_user_id=u_under.id)
    db.add(u_mgr)
    db.commit()
    
    now = datetime.now(timezone.utc)

    # Demo Data

    # APP-1001: OPEN, unclaimed, created 3 days ago -> should create assignment task
    app1 = Application(
        application_number="APP-1001",
        status=ApplicationStatus.OPEN,
        created_at=now - timedelta(days=3)
    )
    db.add(app1)

    # APP-1002: CLAIMED, claimed 1.5 days ago -> should create follow-up task
    app2 = Application(
        application_number="APP-1002",
        status=ApplicationStatus.CLAIMED,
        claimed_by_user_id=u_proc.id,
        current_role=u_proc.role,
        created_at=now - timedelta(days=2),
        claimed_at=now - timedelta(days=1.5)
    )
    db.add(app2)

    # APP-1003: CLAIMED, claimed 3 days ago -> should create follow-up + escalation task
    app3 = Application(
        application_number="APP-1003",
        status=ApplicationStatus.CLAIMED,
        claimed_by_user_id=u_under.id,
        current_role=u_under.role,
        created_at=now - timedelta(days=4),
        claimed_at=now - timedelta(days=3)
    )
    db.add(app3)

    # APP-1004: recently created, unclaimed -> should NOT create a task yet
    app4 = Application(
        application_number="APP-1004",
        status=ApplicationStatus.OPEN,
        created_at=now - timedelta(hours=5)
    )
    db.add(app4)

    # APP-1005: CLAIMED, recently claimed -> should NOT create a task yet
    app5 = Application(
        application_number="APP-1005",
        status=ApplicationStatus.CLAIMED,
        claimed_by_user_id=u_admin.id,
        current_role=u_admin.role,
        created_at=now - timedelta(days=1),
        claimed_at=now - timedelta(hours=2)
    )
    db.add(app5)

    # APP-1006: COMPLETED -> useful for analytics
    app6 = Application(
        application_number="APP-1006",
        status=ApplicationStatus.COMPLETED,
        claimed_by_user_id=u_proc.id,
        current_role=u_proc.role,
        created_at=now - timedelta(days=5),
        claimed_at=now - timedelta(days=4),
        completed_at=now - timedelta(days=1)
    )
    db.add(app6)
    db.commit()

    # Create Events
    apps = [app1, app2, app3, app4, app5, app6]
    for app in apps:
        db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CREATED", timestamp=app.created_at))
        if app.claimed_at:
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CLAIMED", actor_id=app.claimed_by_user_id, timestamp=app.claimed_at))
        if app.completed_at:
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_COMPLETED", timestamp=app.completed_at))
            
    db.commit()
    db.close()
    print("Database seeded successfully.")

if __name__ == "__main__":
    seed_db()

