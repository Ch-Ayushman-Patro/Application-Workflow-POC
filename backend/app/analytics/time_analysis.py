from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.all import Application, Task, ApplicationStatus, TaskType, ApplicationEvent
from datetime import datetime, timezone

def calculate_summary(db: Session):
    apps = db.query(Application).all()
    tasks = db.query(Task).all()
    
    total = len(apps)
    open_apps = sum(1 for a in apps if a.status == ApplicationStatus.OPEN)
    claimed = sum(1 for a in apps if a.status == ApplicationStatus.CLAIMED)
    completed = sum(1 for a in apps if a.status == ApplicationStatus.COMPLETED)
    
    pending_action = len([t for t in tasks if t.status == "OPEN"])
    total_escalations = sum(1 for t in tasks if t.task_type == TaskType.ESCALATION)
    
    total_human_processing = 0
    total_waiting = 0
    completed_apps_count = 0
    
    now = datetime.now(timezone.utc)
    
    stage_waiting = {}
    
    for app in apps:
        app_created = app.created_at
        if app_created.tzinfo is None:
            app_created = app_created.replace(tzinfo=timezone.utc)
            
        if app.status == ApplicationStatus.COMPLETED:
            completed_apps_count += 1
            app_completed = app.completed_at
            if app_completed.tzinfo is None:
                app_completed = app_completed.replace(tzinfo=timezone.utc)
            
            if app.claimed_at:
                app_claimed = app.claimed_at
                if app_claimed.tzinfo is None:
                    app_claimed = app_claimed.replace(tzinfo=timezone.utc)
                
                waiting = (app_claimed - app_created).total_seconds()
                processing = (app_completed - app_claimed).total_seconds()
                total_waiting += waiting
                total_human_processing += processing
                
                stage_waiting["Intake Queue"] = stage_waiting.get("Intake Queue", 0) + waiting
            else:
                waiting = (app_completed - app_created).total_seconds()
                total_waiting += waiting
                stage_waiting["Intake Queue"] = stage_waiting.get("Intake Queue", 0) + waiting

        else:
            # For open apps, estimate current waiting/processing
            if app.status == ApplicationStatus.OPEN:
                waiting = (now - app_created).total_seconds()
                total_waiting += waiting
                stage_waiting["Intake Queue"] = stage_waiting.get("Intake Queue", 0) + waiting
            elif app.status == ApplicationStatus.CLAIMED:
                app_claimed = app.claimed_at
                if app_claimed.tzinfo is None:
                    app_claimed = app_claimed.replace(tzinfo=timezone.utc)
                waiting = (app_claimed - app_created).total_seconds()
                processing = (now - app_claimed).total_seconds()
                total_waiting += waiting
                total_human_processing += processing
                
                stage_waiting["Intake Queue"] = stage_waiting.get("Intake Queue", 0) + waiting

    avg_processing = (total_human_processing / total) / 3600.0 if total > 0 else 0
    avg_waiting = (total_waiting / total) / 3600.0 if total > 0 else 0
    
    bottleneck_stage = "None"
    if stage_waiting:
        bottleneck_stage = max(stage_waiting, key=stage_waiting.get)
        
    return {
        "total_applications": total,
        "open_applications": open_apps,
        "claimed_applications": claimed,
        "completed_applications": completed,
        "pending_action": pending_action,
        "avg_processing_time_hours": avg_processing,
        "avg_waiting_time_hours": avg_waiting,
        "total_escalations": total_escalations,
        "bottleneck_stage": bottleneck_stage
    }

