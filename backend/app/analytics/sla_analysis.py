import logging
from sqlalchemy.orm import Session
from app.models.all import Application, ApplicationStatus, User
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

def get_sla(db: Session):
    apps = db.query(Application).all()
    now = datetime.now(timezone.utc)
    
    assignment_delayed_count = 0
    review_delayed_count = 0
    escalated_count = 0
    
    assignment_sla_excess_hours = 0
    review_sla_excess_hours = 0
    critical_excess_hours = 0
    
    delay_contributors = []
    
    users = {u.id: u.name for u in db.query(User).all()}
    
    for a in apps:
        c_at = a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at
        
        if a.status == ApplicationStatus.OPEN:
            elapsed = (now - c_at).total_seconds() / 3600.0
            if elapsed > 24:
                assignment_delayed_count += 1
                excess = elapsed - 24
                assignment_sla_excess_hours += excess
                delay_contributors.append({
                    "application_id": a.id,
                    "application_number": a.application_number,
                    "stage": "Assignment Queue",
                    "underwriter": None,
                    "elapsed_time_hours": elapsed,
                    "sla_excess_hours": excess,
                    "sla_state": "DELAYED"
                })
        elif a.status == ApplicationStatus.CLAIMED:
            cl_at = a.claimed_at.replace(tzinfo=timezone.utc) if a.claimed_at and a.claimed_at.tzinfo is None else a.claimed_at
            if cl_at:
                elapsed = (now - cl_at).total_seconds() / 3600.0
                if elapsed > 48:
                    escalated_count += 1
                    excess = elapsed - 24
                    critical_excess_hours += (elapsed - 48)
                    review_sla_excess_hours += excess
                    delay_contributors.append({
                        "application_id": a.id,
                        "application_number": a.application_number,
                        "stage": "Underwriting Review",
                        "underwriter": users.get(a.claimed_by_user_id),
                        "elapsed_time_hours": elapsed,
                        "sla_excess_hours": excess,
                        "sla_state": "ESCALATED"
                    })
                elif elapsed > 24:
                    review_delayed_count += 1
                    excess = elapsed - 24
                    review_sla_excess_hours += excess
                    delay_contributors.append({
                        "application_id": a.id,
                        "application_number": a.application_number,
                        "stage": "Underwriting Review",
                        "underwriter": users.get(a.claimed_by_user_id),
                        "elapsed_time_hours": elapsed,
                        "sla_excess_hours": excess,
                        "sla_state": "DELAYED"
                    })

    delay_contributors.sort(key=lambda x: x["sla_excess_hours"], reverse=True)

    return {
        "assignment_delayed_count": assignment_delayed_count,
        "review_delayed_count": review_delayed_count,
        "escalated_count": escalated_count,
        "assignment_sla_excess_hours": assignment_sla_excess_hours,
        "review_sla_excess_hours": review_sla_excess_hours,
        "critical_excess_hours": critical_excess_hours,
        "delay_contributors": delay_contributors[:10]
    }
