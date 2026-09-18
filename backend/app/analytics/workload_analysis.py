import logging
from sqlalchemy.orm import Session
from app.models.all import Application, ApplicationStatus, User
from datetime import datetime, timezone
import statistics

logger = logging.getLogger(__name__)

def get_workload(db: Session):
    apps = db.query(Application).all()
    now = datetime.now(timezone.utc)
    
    underwriters_data = {}
    users = {u.id: u.name for u in db.query(User).all() if u.role.lower() == "underwriter"}
    
    for uid, name in users.items():
        underwriters_data[uid] = {
            "user_id": uid,
            "name": name,
            "active_applications": 0,
            "delayed_applications": 0,
            "escalated_applications": 0,
            "review_hours_list": [],
            "oldest_active_review_hours": None
        }
        
    for a in apps:
        if a.claimed_by_user_id and a.claimed_by_user_id in underwriters_data:
            uid = a.claimed_by_user_id
            cl_at = a.claimed_at.replace(tzinfo=timezone.utc) if a.claimed_at and a.claimed_at.tzinfo is None else a.claimed_at
            if not cl_at:
                continue
                
            if a.status == ApplicationStatus.CLAIMED:
                underwriters_data[uid]["active_applications"] += 1
                elapsed = (now - cl_at).total_seconds() / 3600.0
                underwriters_data[uid]["review_hours_list"].append(elapsed)
                
                if elapsed > 48:
                    underwriters_data[uid]["escalated_applications"] += 1
                    underwriters_data[uid]["delayed_applications"] += 1
                elif elapsed > 24:
                    underwriters_data[uid]["delayed_applications"] += 1
                    
                oldest = underwriters_data[uid]["oldest_active_review_hours"]
                if oldest is None or elapsed > oldest:
                    underwriters_data[uid]["oldest_active_review_hours"] = elapsed
                    
            elif a.status == ApplicationStatus.COMPLETED and a.completed_at:
                comp_at = a.completed_at.replace(tzinfo=timezone.utc) if a.completed_at.tzinfo is None else a.completed_at
                elapsed = (comp_at - cl_at).total_seconds() / 3600.0
                underwriters_data[uid]["review_hours_list"].append(elapsed)

    result = []
    for uid, data in underwriters_data.items():
        rev_list = data["review_hours_list"]
        avg_rev = statistics.mean(rev_list) if rev_list else 0
        
        result.append({
            "user_id": data["user_id"],
            "name": data["name"],
            "active_applications": data["active_applications"],
            "delayed_applications": data["delayed_applications"],
            "escalated_applications": data["escalated_applications"],
            "avg_review_hours": avg_rev,
            "oldest_active_review_hours": data["oldest_active_review_hours"]
        })
        
    result.sort(key=lambda x: x["active_applications"], reverse=True)
    
    return {"underwriters": result}
