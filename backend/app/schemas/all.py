from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.all import ApplicationStatus, TaskType, TaskStatus, ApplicationDecision

class UserBase(BaseModel):
    name: str
    role: str
    manager_user_id: Optional[int] = None

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True

class EventResponse(BaseModel):
    id: int
    application_id: int
    event_type: str
    timestamp: datetime
    actor_id: Optional[int] = None
    details: Optional[str] = None
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    application_id: int
    task_type: TaskType
    title: str
    description: str
    assigned_to_user_id: Optional[int] = None
    assigned_to_role: Optional[str] = None
    escalation_level: int = 0

class TaskResponse(TaskBase):
    id: int
    status: TaskStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    assigned_to: Optional[UserResponse] = None
    class Config:
        from_attributes = True

class ApplicationBase(BaseModel):
    application_number: str
    status: ApplicationStatus = ApplicationStatus.OPEN
    current_role: Optional[str] = None
    current_stage: Optional[str] = None
    decision: Optional[str] = None

class ApplicationResponse(ApplicationBase):
    id: int
    claimed_by_user_id: Optional[int] = None
    claimed_at: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    claimed_by: Optional[UserResponse] = None
    tasks: List[TaskResponse] = []
    class Config:
        from_attributes = True

class DecisionRequest(BaseModel):
    decision: str
    actor_id: Optional[int] = None

class WorkflowRunResponse(BaseModel):
    applications_checked: int
    tasks_created: int
    tasks_already_existing: int
    escalations_created: int

class AnalyticsSummary(BaseModel):
    total_applications: int
    open_applications: int
    claimed_applications: int
    completed_applications: int
    approved_applications: int = 0
    rejected_applications: int = 0
    pending_action: int
    avg_processing_time_hours: float
    avg_waiting_time_hours: float
    total_escalations: int
    bottleneck_stage: str

