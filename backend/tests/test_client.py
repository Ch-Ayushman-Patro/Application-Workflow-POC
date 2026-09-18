from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
response = client.get("/api/analytics/trends")
print(response.status_code)
print(response.text)

response = client.get("/api/analytics/insights")
print(response.status_code)
print(response.text)

