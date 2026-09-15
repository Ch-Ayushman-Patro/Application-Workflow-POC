import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class ApplicationStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLAIMED = "CLAIMED"
    COMPLETED = "COMPLETED"

class TaskType(str, enum.Enum):
    ASSIGNMENT = "ASSIGNMENT"
    FOLLOW_UP = "FOLLOW_UP"
    ESCALATION = "ESCALATION"

class TaskStatus(str, enum.Enum):
    OPEN = "OPEN"
    COMPLETED = "COMPLETED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    role = Column(String)
    manager_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    application_number = Column(String, unique=True, index=True)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.OPEN)
    claimed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    current_role = Column(String, nullable=True)
    current_stage = Column(String, nullable=True)
    
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    claimed_by = relationship("User", foreign_keys=[claimed_by_user_id])
    tasks = relationship("Task", back_populates="application")
    events = relationship("ApplicationEvent", back_populates="application")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    task_type = Column(Enum(TaskType))
    title = Column(String)
    description = Column(String)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to_role = Column(String, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.OPEN)
    escalation_level = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    application = relationship("Application", back_populates="tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])

class ApplicationEvent(Base):
    __tablename__ = "application_events"
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    event_type = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    details = Column(String, nullable=True)

    application = relationship("Application", back_populates="events")
    actor = relationship("User")

