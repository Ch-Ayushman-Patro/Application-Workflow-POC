from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.analytics.trend_analysis import get_trends
from app.schemas.all import AnalyticsTrends

db = SessionLocal()
try:
    data = get_trends(db)
    print(AnalyticsTrends(**data))
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()

