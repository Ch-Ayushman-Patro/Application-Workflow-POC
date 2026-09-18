from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.analytics.insight_engine import get_insights

db = SessionLocal()
try:
    print(get_insights(db))
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()

