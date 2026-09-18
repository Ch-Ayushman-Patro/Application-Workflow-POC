import logging
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.all import (
    User,
    Application,
    ApplicationStatus,
    ApplicationEvent,
    UserRole,
)
from app.workflow.rule_engine import WorkflowEngine

logger = logging.getLogger(__name__)

# Deterministic scenario sequence designed for realistic distribution across:
# - Status: OPEN, CLAIMED, COMPLETED
# - SLA states: Fresh, Approaching SLA, Moderately Delayed, Escalated, Severely Delayed
# - Completed: Approved vs. Rejected with realistic intervals
# - Time: Recent (within 7-day trend window) and Historical (8-30 days ago)
BASE_SCENARIOS = [
    # Wave 1 (1-10): Broad initial cross-section across all lifecycle states
    "OPEN_FRESH",
    "CLAIMED_FRESH",
    "CLAIMED_REVIEW_DELAYED",
    "COMPLETED_APPROVED_RECENT",
    "OPEN_ASSIGNMENT_DELAYED_MODERATE",
    "CLAIMED_ESCALATED",
    "COMPLETED_REJECTED_RECENT",
    "CLAIMED_APPROACHING_SLA",
    "COMPLETED_APPROVED_HISTORICAL",
    "CLAIMED_SEVERELY_DELAYED",
    # Wave 2 (11-20): Expanding operational volume
    "OPEN_FRESH",
    "CLAIMED_FRESH",
    "COMPLETED_APPROVED_RECENT",
    "OPEN_APPROACHING_SLA",
    "CLAIMED_REVIEW_DELAYED",
    "COMPLETED_REJECTED_HISTORICAL",
    "CLAIMED_ESCALATED",
    "OPEN_ASSIGNMENT_DELAYED_SEVERE",
    "CLAIMED_FRESH",
    "COMPLETED_APPROVED_HISTORICAL",
    # Wave 3 (21-30): Mid-pipeline workload variation
    "CLAIMED_APPROACHING_SLA",
    "OPEN_FRESH",
    "COMPLETED_APPROVED_RECENT",
    "CLAIMED_REVIEW_DELAYED",
    "OPEN_ASSIGNMENT_DELAYED_MODERATE",
    "CLAIMED_FRESH",
    "COMPLETED_APPROVED_HISTORICAL",
    "CLAIMED_ESCALATED",
    "COMPLETED_REJECTED_RECENT",
    "CLAIMED_SEVERELY_DELAYED",
    # Wave 4 (31-40): Daily trend depth & historical completions
    "COMPLETED_APPROVED_RECENT",
    "CLAIMED_FRESH",
    "OPEN_APPROACHING_SLA",
    "CLAIMED_REVIEW_DELAYED",
    "COMPLETED_APPROVED_HISTORICAL",
    "OPEN_FRESH",
    "CLAIMED_ESCALATED",
    "COMPLETED_REJECTED_HISTORICAL",
    "CLAIMED_FRESH",
    "COMPLETED_APPROVED_RECENT",
    # Wave 5 (41-50): Full 50-case benchmark target
    "OPEN_ASSIGNMENT_DELAYED_MODERATE",
    "CLAIMED_APPROACHING_SLA",
    "COMPLETED_APPROVED_HISTORICAL",
    "CLAIMED_REVIEW_DELAYED",
    "OPEN_ASSIGNMENT_DELAYED_SEVERE",
    "COMPLETED_APPROVED_RECENT",
    "CLAIMED_FRESH",
    "COMPLETED_REJECTED_RECENT",
    "COMPLETED_APPROVED_RECENT",
    "COMPLETED_APPROVED_HISTORICAL",
]


def _choose_underwriter(
    scenario: str,
    case_idx: int,
    underwriters: List[User],
    rng: random.Random,
) -> User:
    """
    Distributes claimed and completed applications across underwriters deterministically.
    Produces a realistic ~58% / ~42% workload variance between Abhinav and Lakshay,
    giving Abhinav a slightly higher active case load and escalation count.
    """
    if not underwriters:
        raise ValueError("No underwriters available for assignment.")

    u_abhinav = next(
        (u for u in underwriters if "abhinav" in u.name.lower()), underwriters[0]
    )
    u_lakshay = next(
        (u for u in underwriters if "lakshay" in u.name.lower()), underwriters[-1]
    )

    if u_abhinav.id == u_lakshay.id and len(underwriters) > 1:
        u_lakshay = underwriters[1]

    # Assign escalations and heavy delays slightly more to Abhinav
    if scenario in ("CLAIMED_ESCALATED", "CLAIMED_SEVERELY_DELAYED"):
        return u_abhinav if (case_idx % 3 != 0) else u_lakshay
    elif scenario == "CLAIMED_REVIEW_DELAYED":
        return u_abhinav if (case_idx % 2 == 0) else u_lakshay
    else:
        # Standard ~60/40 rotation
        return u_abhinav if (case_idx % 5 in (0, 1, 3)) else u_lakshay


def generate_random_cases(
    db: Session,
    count: int = 50,
    run_workflow: bool = True,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Generates a deterministic but varied dataset of loan applications with realistic
    lifecycle states, varied creation and claim times (spread across 7-30 days),
    realistic underwriter distribution, and valid audit events.

    Optionally runs the WorkflowEngine so SLA tasks and escalations are evaluated
    deterministically using the application's actual rules.

    Returns:
      {
        "cases_created": count,
        "application_numbers": [...],
        "workflow_stats": { ... }
      }
    """
    logger.info("generate_random_cases: requested count=%d, seed=%d", count, seed)

    users = db.query(User).all()
    if not users:
        logger.warning("No users found in database — cannot generate applications.")
        return {"cases_created": 0, "application_numbers": [], "workflow_stats": None}

    # Identify operational underwriters (Abhinav, Lakshay)
    underwriters = [u for u in users if u.role == UserRole.UNDERWRITER.value]
    if not underwriters:
        logger.warning("No underwriter users found; falling back to non-admin users.")
        underwriters = [u for u in users if u.role != UserRole.ADMIN.value]
    if not underwriters:
        underwriters = users

    # Dedicated PRNG instance for complete reproducibility
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)

    # Determine next available application number
    existing_apps = db.query(Application.application_number).all()
    existing_nums = set()
    for (num,) in existing_apps:
        if num and num.startswith("APP-"):
            try:
                existing_nums.add(int(num.split("-")[1]))
            except (ValueError, IndexError):
                pass

    next_num = max(existing_nums, default=1000) + 1
    logger.info("Starting application generation from APP-%d", next_num)

    created_cases = []

    for i in range(count):
        scenario = BASE_SCENARIOS[i % len(BASE_SCENARIOS)]
        app_num = f"APP-{next_num + i}"

        # Jitter minutes and seconds so timestamps are varied and realistic
        min_jitter = rng.randint(4, 56)
        sec_jitter = rng.randint(6, 54)

        # Build application according to its scenario profile
        if scenario == "OPEN_FRESH":
            # Submitted 1.5 - 15h ago, within SLA
            age_hours = rng.uniform(1.5, 15.0)
            created_at = now - timedelta(
                hours=age_hours, minutes=min_jitter, seconds=sec_jitter
            )
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.OPEN,
                current_role=None,
                current_stage=rng.choice(
                    ["New Intake Queue", "Document Intake", "Direct Online Submission"]
                ),
                created_at=created_at,
                claimed_by_user_id=None,
                claimed_at=None,
                completed_at=None,
                decision=None,
            )
            assignee = None

        elif scenario == "OPEN_APPROACHING_SLA":
            # Submitted 18.5 - 23.5h ago, near 24h assignment threshold
            age_hours = rng.uniform(18.5, 23.5)
            created_at = now - timedelta(
                hours=age_hours, minutes=min_jitter, seconds=sec_jitter
            )
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.OPEN,
                current_role=None,
                current_stage=rng.choice(
                    ["Queue Triage", "Intake Verification", "Document Intake"]
                ),
                created_at=created_at,
                claimed_by_user_id=None,
                claimed_at=None,
                completed_at=None,
                decision=None,
            )
            assignee = None

        elif scenario == "OPEN_ASSIGNMENT_DELAYED_MODERATE":
            # Unassigned 26 - 44h (1.1 - 1.8 days), SLA breached -> triggers ASSIGNMENT task
            age_hours = rng.uniform(26.0, 44.0)
            created_at = now - timedelta(
                hours=age_hours, minutes=min_jitter, seconds=sec_jitter
            )
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.OPEN,
                current_role=None,
                current_stage=rng.choice(["Document Intake", "Queue Triage"]),
                created_at=created_at,
                claimed_by_user_id=None,
                claimed_at=None,
                completed_at=None,
                decision=None,
            )
            assignee = None

        elif scenario == "OPEN_ASSIGNMENT_DELAYED_SEVERE":
            # Unassigned 50 - 96h (2.1 - 4.0 days), severe assignment backlog
            age_hours = rng.uniform(50.0, 96.0)
            created_at = now - timedelta(
                hours=age_hours, minutes=min_jitter, seconds=sec_jitter
            )
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.OPEN,
                current_role=None,
                current_stage=rng.choice(
                    ["Priority Intake Queue", "Document Verification"]
                ),
                created_at=created_at,
                claimed_by_user_id=None,
                claimed_at=None,
                completed_at=None,
                decision=None,
            )
            assignee = None

        elif scenario == "CLAIMED_FRESH":
            # Claimed 1.5 - 14h ago, comfortably within 24h review SLA
            review_hours = rng.uniform(1.5, 14.0)
            queue_hours = rng.uniform(2.0, 16.0)
            claimed_at = now - timedelta(
                hours=review_hours, minutes=min_jitter, seconds=sec_jitter
            )
            created_at = claimed_at - timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage=rng.choice(
                    ["Underwriting Review", "Initial Document Review", "Eligibility Check"]
                ),
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=None,
                decision=None,
            )

        elif scenario == "CLAIMED_APPROACHING_SLA":
            # Claimed 18.5 - 23.8h ago, approaching 24h SLA review threshold
            review_hours = rng.uniform(18.5, 23.8)
            queue_hours = rng.uniform(3.0, 20.0)
            claimed_at = now - timedelta(
                hours=review_hours, minutes=min_jitter, seconds=sec_jitter
            )
            created_at = claimed_at - timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage=rng.choice(
                    ["Credit Assessment", "Financial Verification"]
                ),
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=None,
                decision=None,
            )

        elif scenario == "CLAIMED_REVIEW_DELAYED":
            # Claimed 25.5 - 45.0h ago (>24h review duration) -> triggers FOLLOW_UP task
            review_hours = rng.uniform(25.5, 45.0)
            queue_hours = rng.uniform(4.0, 24.0)
            claimed_at = now - timedelta(
                hours=review_hours, minutes=min_jitter, seconds=sec_jitter
            )
            created_at = claimed_at - timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage=rng.choice(
                    ["Underwriting Review", "Risk Assessment", "Income Verification"]
                ),
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=None,
                decision=None,
            )

        elif scenario == "CLAIMED_ESCALATED":
            # Claimed 49.5 - 70.0h ago (>48h review duration) -> triggers ESCALATION to Manager + FOLLOW_UP
            review_hours = rng.uniform(49.5, 70.0)
            queue_hours = rng.uniform(6.0, 36.0)
            claimed_at = now - timedelta(
                hours=review_hours, minutes=min_jitter, seconds=sec_jitter
            )
            created_at = claimed_at - timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage=rng.choice(
                    ["Senior Underwriting Review", "Exception Review", "Risk Assessment"]
                ),
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=None,
                decision=None,
            )

        elif scenario == "CLAIMED_SEVERELY_DELAYED":
            # Claimed 75.0 - 135.0h ago (3.1 - 5.6 days), severe bottleneck case
            review_hours = rng.uniform(75.0, 135.0)
            queue_hours = rng.uniform(8.0, 48.0)
            claimed_at = now - timedelta(
                hours=review_hours, minutes=min_jitter, seconds=sec_jitter
            )
            created_at = claimed_at - timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.CLAIMED,
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage=rng.choice(
                    ["Compliance Hold", "Legal Review", "Special Assets Review"]
                ),
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=None,
                decision=None,
            )

        elif scenario == "COMPLETED_APPROVED_RECENT":
            # Completed within last 7 days (trend chart)
            created_days_ago = rng.uniform(2.5, 6.5)
            queue_hours = rng.uniform(2.0, 18.0)
            review_hours = rng.uniform(6.0, 36.0)
            created_at = now - timedelta(
                days=created_days_ago, minutes=min_jitter, seconds=sec_jitter
            )
            claimed_at = created_at + timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            completed_at = claimed_at + timedelta(
                hours=review_hours, minutes=rng.randint(5, 30)
            )
            if completed_at >= now:
                completed_at = now - timedelta(hours=rng.uniform(1.0, 4.0))
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.COMPLETED,
                decision="APPROVED",
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage="Approved",
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=completed_at,
            )

        elif scenario == "COMPLETED_APPROVED_HISTORICAL":
            # Historical completed 7.5 - 28 days ago
            created_days_ago = rng.uniform(7.5, 28.0)
            queue_hours = rng.uniform(4.0, 36.0)
            review_hours = rng.uniform(8.0, 48.0)
            created_at = now - timedelta(
                days=created_days_ago, minutes=min_jitter, seconds=sec_jitter
            )
            claimed_at = created_at + timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            completed_at = claimed_at + timedelta(
                hours=review_hours, minutes=rng.randint(5, 30)
            )
            if completed_at >= now:
                completed_at = now - timedelta(hours=rng.uniform(2.0, 8.0))
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.COMPLETED,
                decision="APPROVED",
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage="Approved",
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=completed_at,
            )

        elif scenario == "COMPLETED_REJECTED_RECENT":
            # Completed rejected within last 7 days
            created_days_ago = rng.uniform(2.5, 6.5)
            queue_hours = rng.uniform(2.0, 16.0)
            review_hours = rng.uniform(4.0, 28.0)
            created_at = now - timedelta(
                days=created_days_ago, minutes=min_jitter, seconds=sec_jitter
            )
            claimed_at = created_at + timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            completed_at = claimed_at + timedelta(
                hours=review_hours, minutes=rng.randint(5, 30)
            )
            if completed_at >= now:
                completed_at = now - timedelta(hours=rng.uniform(1.0, 4.0))
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.COMPLETED,
                decision="REJECTED",
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage="Rejected",
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=completed_at,
            )

        else:  # COMPLETED_REJECTED_HISTORICAL
            # Historical rejected 8.0 - 30 days ago
            created_days_ago = rng.uniform(8.0, 30.0)
            queue_hours = rng.uniform(4.0, 30.0)
            review_hours = rng.uniform(6.0, 44.0)
            created_at = now - timedelta(
                days=created_days_ago, minutes=min_jitter, seconds=sec_jitter
            )
            claimed_at = created_at + timedelta(
                hours=queue_hours, minutes=rng.randint(5, 30)
            )
            completed_at = claimed_at + timedelta(
                hours=review_hours, minutes=rng.randint(5, 30)
            )
            if completed_at >= now:
                completed_at = now - timedelta(hours=rng.uniform(2.0, 8.0))
            assignee = _choose_underwriter(scenario, i, underwriters, rng)
            app = Application(
                application_number=app_num,
                status=ApplicationStatus.COMPLETED,
                decision="REJECTED",
                claimed_by_user_id=assignee.id,
                current_role=assignee.role,
                current_stage="Rejected",
                created_at=created_at,
                claimed_at=claimed_at,
                completed_at=completed_at,
            )

        # Add application and flush to retrieve primary key id without round-trip commit
        db.add(app)
        db.flush()

        # Create corresponding timeline events
        # 1. APPLICATION_CREATED
        db.add(
            ApplicationEvent(
                application_id=app.id,
                event_type="APPLICATION_CREATED",
                timestamp=app.created_at,
                actor_id=None,
                details=f"Application {app.application_number} submitted via portal",
            )
        )

        # 2. APPLICATION_CLAIMED (if claimed)
        if app.claimed_at and app.claimed_by_user_id:
            actor_name = assignee.name if assignee else "Underwriter"
            db.add(
                ApplicationEvent(
                    application_id=app.id,
                    event_type="APPLICATION_CLAIMED",
                    actor_id=app.claimed_by_user_id,
                    timestamp=app.claimed_at,
                    details=f"Claimed by {actor_name} for underwriting review",
                )
            )

        # 3. APPLICATION_APPROVED / APPLICATION_REJECTED (if completed)
        if app.status == ApplicationStatus.COMPLETED and app.completed_at:
            actor_name = assignee.name if assignee else "Underwriter"
            if app.decision == "APPROVED":
                db.add(
                    ApplicationEvent(
                        application_id=app.id,
                        event_type="APPLICATION_APPROVED",
                        actor_id=app.claimed_by_user_id,
                        timestamp=app.completed_at,
                        details=f"Application {app.application_number} approved by {actor_name}",
                    )
                )
            elif app.decision == "REJECTED":
                db.add(
                    ApplicationEvent(
                        application_id=app.id,
                        event_type="APPLICATION_REJECTED",
                        actor_id=app.claimed_by_user_id,
                        timestamp=app.completed_at,
                        details=f"Application {app.application_number} rejected by {actor_name}",
                    )
                )

        created_cases.append(app_num)
        logger.debug("Created application %s (%s)", app_num, scenario)

    db.commit()
    logger.info("Successfully created and committed %d applications", len(created_cases))

    # Evaluate workflow rules to generate SLA tasks and escalations
    workflow_stats = None
    if run_workflow:
        logger.info("Evaluating workflow engine for all active applications...")
        engine = WorkflowEngine(db)
        workflow_stats = engine.evaluate_all()
        logger.info("WorkflowEngine evaluation complete: %s", workflow_stats)

    return {
        "cases_created": len(created_cases),
        "application_numbers": created_cases,
        "workflow_stats": workflow_stats,
    }
