import logging
from sqlalchemy.orm import Session
from app.models.all import Application, Task, ApplicationStatus, TaskType
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

def get_overview(db: Session):
    apps = db.query(Application).all()
    
    total = len(apps)
    open_apps = 0
    claimed = 0
    completed = 0
    approved = 0
    rejected = 0
    unassigned = 0
    delayed = 0
    escalated = 0

    now = datetime.now(timezone.utc)

    for a in apps:
        if a.status == ApplicationStatus.OPEN:
            open_apps += 1
            if not a.claimed_by_user_id:
                unassigned += 1
            
            c_at = a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at
            if (now - c_at).total_seconds() > 24 * 3600:
                delayed += 1
                
        elif a.status == ApplicationStatus.CLAIMED:
            claimed += 1
            c_at = a.claimed_at.replace(tzinfo=timezone.utc) if a.claimed_at and a.claimed_at.tzinfo is None else a.claimed_at
            if c_at:
                seconds = (now - c_at).total_seconds()
                if seconds > 48 * 3600:
                    escalated += 1
                    delayed += 1
                elif seconds > 24 * 3600:
                    delayed += 1
                    
        elif a.status == ApplicationStatus.COMPLETED:
            completed += 1
            if a.decision == "APPROVED":
                approved += 1
            elif a.decision == "REJECTED":
                rejected += 1

    return {
        "total_applications": total,
        "active_applications": open_apps + claimed,
        "unassigned_applications": unassigned,
        "delayed_applications": delayed,
        "escalated_applications": escalated,
        "approved_applications": approved,
        "rejected_applications": rejected
    }
