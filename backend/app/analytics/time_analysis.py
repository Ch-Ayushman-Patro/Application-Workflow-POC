import logging
from sqlalchemy.orm import Session
from app.models.all import Application, ApplicationStatus
from datetime import datetime, timezone
import statistics

logger = logging.getLogger(__name__)

def get_time(db: Session):
    apps = db.query(Application).all()
    now = datetime.now(timezone.utc)
    
    total_elapsed = []
    queue_wait = []
    review_duration = []

    for a in apps:
        c_at = a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at
        
        if a.claimed_at:
            cl_at = a.claimed_at.replace(tzinfo=timezone.utc) if a.claimed_at.tzinfo is None else a.claimed_at
            queue_wait.append((cl_at - c_at).total_seconds() / 3600.0)
            
            if a.status == ApplicationStatus.COMPLETED and a.completed_at:
                comp_at = a.completed_at.replace(tzinfo=timezone.utc) if a.completed_at.tzinfo is None else a.completed_at
                review_duration.append((comp_at - cl_at).total_seconds() / 3600.0)
                total_elapsed.append((comp_at - c_at).total_seconds() / 3600.0)
            else:
                review_duration.append((now - cl_at).total_seconds() / 3600.0)
                total_elapsed.append((now - c_at).total_seconds() / 3600.0)
        else:
            if a.status == ApplicationStatus.COMPLETED and a.completed_at:
                comp_at = a.completed_at.replace(tzinfo=timezone.utc) if a.completed_at.tzinfo is None else a.completed_at
                queue_wait.append((comp_at - c_at).total_seconds() / 3600.0)
                total_elapsed.append((comp_at - c_at).total_seconds() / 3600.0)
            else:
                queue_wait.append((now - c_at).total_seconds() / 3600.0)
                total_elapsed.append((now - c_at).total_seconds() / 3600.0)

    avg_total = statistics.mean(total_elapsed) if total_elapsed else 0
    avg_queue = statistics.mean(queue_wait) if queue_wait else 0
    avg_rev = statistics.mean(review_duration) if review_duration else 0
    
    sum_queue = sum(queue_wait)
    sum_rev = sum(review_duration)
    total_time_sum = sum_queue + sum_rev
    
    q_pct = (sum_queue / total_time_sum * 100) if total_time_sum > 0 else 0
    r_pct = (sum_rev / total_time_sum * 100) if total_time_sum > 0 else 0

    return {
        "avg_total_elapsed_hours": avg_total,
        "avg_queue_wait_hours": avg_queue,
        "avg_review_duration_hours": avg_rev,
        "queue_waiting_percentage": q_pct,
        "active_review_percentage": r_pct
    }
