import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.all import UserResponse
from app.services import core

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    logger.info("GET /users — listing all users.")
    return core.get_users(db)
