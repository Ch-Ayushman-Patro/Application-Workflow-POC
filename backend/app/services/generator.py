import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.all import User, Application, ApplicationStatus, ApplicationEvent
from app.workflow.rule_engine import WorkflowEngine

def generate_random_cases(db: Session, count: int = 3, run_workflow: bool = True):
    """
    Simulates incoming loan applications with diverse lifecycle states and ages.
    Triggers the workflow engine to evaluate SLA rules and create realistic tasks/escalations.
    """
    users = db.query(User).all()
    if not users:
        return {"cases_created": 0, "application_numbers": [], "workflow_stats": None}
    
    # Operational staff for assignments
    operational_users = [u for u in users if u.role in ["Processor", "Underwriter"]]
    if not operational_users:
        operational_users = users

    now = datetime.now(timezone.utc)
    
    # Determine the next available application number
    existing_apps = db.query(Application.application_number).all()
    existing_nums = set()
    for (num,) in existing_apps:
        if num and num.startswith("APP-"):
            try:
                existing_nums.add(int(num.split("-")[1]))
            except (ValueError, IndexError):
                pass
    
    next_num = max(existing_nums, default=1000) + 1
    
    # 5 realistic scenarios:
    # 1. UNCLAIMED_BREACH: sitting open > 24h -> triggers ASSIGNMENT task for Admin
    # 2. FOLLOW_UP_BREACH: claimed > 24h -> triggers FOLLOW_UP task for claimed user
    # 3. ESCALATION_BREACH: claimed > 48h -> triggers ESCALATION to Manager + FOLLOW_UP
    # 4. FRESH_OPEN: arrived recently -> healthy unclaimed
    # 5. FRESH_CLAIMED: claimed recently -> healthy in-progress
    scenarios = ["UNCLAIMED_BREACH", "FOLLOW_UP_BREACH", "ESCALATION_BREACH", "FRESH_OPEN", "FRESH_CLAIMED"]
    
    created_cases = []
    
    for i in range(count):
        # Rotate through the most interesting scenarios first
        scenario = scenarios[i % len(scenarios)]
        app_num = f"APP-{next_num}"
        next_num += 1
        
        if scenario == "UNCLAIMED_BREACH":
            age_days = random.uniform(1.3, 3.0)
            created_at = now - timedelta(days=age_days)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.OPEN,
                current_role="Intake Queue",
                current_stage="New Intake",
                created_at=created_at
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            db.add(ApplicationEvent(
                application_id=app.id,
                event_type="APPLICATION_CREATED",
                timestamp=created_at,
                details=f"Application submitted via portal ({age_days:.1f}d ago)"
            ))
            
        elif scenario == "FOLLOW_UP_BREACH":
            claimed_days = random.uniform(1.2, 1.8)
            created_days = claimed_days + random.uniform(0.5, 1.2)
            created_at = now - timedelta(days=created_days)
            claimed_at = now - timedelta(days=claimed_days)
            assignee = random.choice(operational_users)
            
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage=f"{assignee.role} Verification",
                created_at=created_at,
                claimed_at=claimed_at
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CREATED", timestamp=created_at))
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CLAIMED", actor_id=assignee.id, timestamp=claimed_at, details=f"Claimed by {assignee.name}"))
            
        elif scenario == "ESCALATION_BREACH":
            claimed_days = random.uniform(2.3, 4.0)
            created_days = claimed_days + random.uniform(0.8, 1.8)
            created_at = now - timedelta(days=created_days)
            claimed_at = now - timedelta(days=claimed_days)
            assignee = random.choice(operational_users)
            
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage="Detailed Credit Review",
                created_at=created_at,
                claimed_at=claimed_at
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CREATED", timestamp=created_at))
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CLAIMED", actor_id=assignee.id, timestamp=claimed_at, details=f"Claimed by {assignee.name}"))
            
        elif scenario == "FRESH_OPEN":
            created_at = now - timedelta(hours=random.uniform(1.0, 4.5))
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.OPEN,
                current_role="Intake Queue",
                current_stage="New Intake",
                created_at=created_at
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CREATED", timestamp=created_at, details="Fresh submission received"))
            
        else: # FRESH_CLAIMED
            created_at = now - timedelta(hours=random.uniform(3.0, 8.0))
            claimed_at = now - timedelta(hours=random.uniform(0.5, 2.0))
            assignee = random.choice(operational_users)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage=f"Active {assignee.role} Review",
                created_at=created_at,
                claimed_at=claimed_at
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CREATED", timestamp=created_at))
            db.add(ApplicationEvent(application_id=app.id, event_type="APPLICATION_CLAIMED", actor_id=assignee.id, timestamp=claimed_at, details=f"Assigned to {assignee.name}"))
            
        created_cases.append(app_num)
        
    db.commit()
    
    workflow_stats = None
    if run_workflow:
        engine = WorkflowEngine(db)
        workflow_stats = engine.evaluate_all()
        
    return {
        "cases_created": len(created_cases),
        "application_numbers": created_cases,
        "workflow_stats": workflow_stats
    }

