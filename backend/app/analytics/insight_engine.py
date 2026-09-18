import logging
from sqlalchemy.orm import Session
from app.analytics.overview_analysis import get_overview
from app.analytics.time_analysis import get_time
from app.analytics.sla_analysis import get_sla

logger = logging.getLogger(__name__)

def get_insights(db: Session):
    overview = get_overview(db)
    time_data = get_time(db)
    sla_data = get_sla(db)
    
    insights = []
    primary_bottleneck = None
    
    assignment_excess = sla_data["assignment_sla_excess_hours"]
    review_excess = sla_data["review_sla_excess_hours"]
    
    if assignment_excess > 0 or review_excess > 0:
        if assignment_excess >= review_excess:
            primary_bottleneck = {
                "type": "BOTTLENECK",
                "severity": "HIGH" if assignment_excess > 48 else "MEDIUM",
                "stage": "Assignment Queue",
                "message": "Assignment Queue is the primary bottleneck.",
                "evidence": f"{sla_data['assignment_delayed_count']} applications unassigned beyond the 24h SLA threshold.",
                "affected_count": sla_data["assignment_delayed_count"],
                "target_url": "/applications?tab=delayed"
            }
        else:
            total_review_delayed = sla_data["review_delayed_count"] + sla_data["escalated_count"]
            primary_bottleneck = {
                "type": "BOTTLENECK",
                "severity": "HIGH" if sla_data["escalated_count"] > 0 or review_excess > 48 else "MEDIUM",
                "stage": "Underwriting Review",
                "message": "Underwriting Review is the primary bottleneck.",
                "evidence": f"{sla_data['escalated_count']} applications currently escalated beyond the 48h review threshold." if sla_data["escalated_count"] > 0 else f"{total_review_delayed} applications in review beyond the 24h SLA threshold.",
                "affected_count": total_review_delayed,
                "target_url": "/applications?tab=escalated" if sla_data["escalated_count"] > 0 else "/applications?tab=delayed"
            }
            
    if sla_data["escalated_count"] > 0:
        insights.append({
            "type": "SLA_BREACH",
            "severity": "HIGH",
            "message": f"{sla_data['escalated_count']} applications have breached the 48h critical SLA.",
            "evidence": f"These applications have been in review for over 48 hours.",
            "affected_count": sla_data["escalated_count"],
            "target_url": "/applications?tab=escalated"
        })
        
    if overview["unassigned_applications"] > 0:
        insights.append({
            "type": "EFFICIENCY",
            "severity": "MEDIUM",
            "message": f"There are {overview['unassigned_applications']} unassigned applications waiting for intake.",
            "evidence": "Assigning these quickly will improve overall lifecycle time.",
            "affected_count": overview["unassigned_applications"],
            "target_url": "/applications"
        })
        
    return {
        "primary_bottleneck": primary_bottleneck,
        "insights": insights
    }

