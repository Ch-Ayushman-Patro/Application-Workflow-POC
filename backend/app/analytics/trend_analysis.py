import logging
from sqlalchemy.orm import Session
from app.models.all import Application, ApplicationStatus
from datetime import datetime, timezone, timedelta
import statistics

logger = logging.getLogger(__name__)

def get_trends(db: Session):
    apps = db.query(Application).all()
    now = datetime.now(timezone.utc)
    
    dates = [(now - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(6, -1, -1)]
    
    trend_data = {d: {
        "date": d,
        "submitted": 0,
        "approved": 0,
        "rejected": 0,
        "queue_waits": [],
        "review_hours": [],
        "delayed": 0,
        "escalated": 0
    } for d in dates}
    
    for a in apps:
        c_at = a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at
        d_str = c_at.strftime('%Y-%m-%d')
        if d_str in trend_data:
            trend_data[d_str]["submitted"] += 1
            
            if a.status == ApplicationStatus.OPEN:
                elapsed = (now - c_at).total_seconds() / 3600.0
                if elapsed > 24:
                    trend_data[d_str]["delayed"] += 1
                trend_data[d_str]["queue_waits"].append(elapsed)
            
            elif a.status == ApplicationStatus.CLAIMED:
                cl_at = a.claimed_at.replace(tzinfo=timezone.utc) if a.claimed_at and a.claimed_at.tzinfo is None else a.claimed_at
                if cl_at:
                    q_elapsed = (cl_at - c_at).total_seconds() / 3600.0
                    trend_data[d_str]["queue_waits"].append(q_elapsed)
                    
                    r_elapsed = (now - cl_at).total_seconds() / 3600.0
                    trend_data[d_str]["review_hours"].append(r_elapsed)
                    
                    if r_elapsed > 48:
                        trend_data[d_str]["escalated"] += 1
                        trend_data[d_str]["delayed"] += 1
                    elif r_elapsed > 24:
                        trend_data[d_str]["delayed"] += 1
                        
            elif a.status == ApplicationStatus.COMPLETED:
                if a.decision == "APPROVED":
                    trend_data[d_str]["approved"] += 1
                elif a.decision == "REJECTED":
                    trend_data[d_str]["rejected"] += 1
                
                cl_at = a.claimed_at.replace(tzinfo=timezone.utc) if a.claimed_at and a.claimed_at.tzinfo is None else a.claimed_at
                comp_at = a.completed_at.replace(tzinfo=timezone.utc) if a.completed_at and a.completed_at.tzinfo is None else a.completed_at
                if cl_at and comp_at:
                    q_elapsed = (cl_at - c_at).total_seconds() / 3600.0
                    r_elapsed = (comp_at - cl_at).total_seconds() / 3600.0
                    trend_data[d_str]["queue_waits"].append(q_elapsed)
                    trend_data[d_str]["review_hours"].append(r_elapsed)

    result = []
    for d in dates:
        data = trend_data[d]
        q_waits = data.pop("queue_waits")
        r_hours = data.pop("review_hours")
        
        data["avg_queue_wait_hours"] = statistics.mean(q_waits) if q_waits else 0
        data["avg_review_hours"] = statistics.mean(r_hours) if r_hours else 0
        result.append(data)
        
    return {"data": result}

