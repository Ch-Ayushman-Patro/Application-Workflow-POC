# Application Workflow Monitor POC

This is a proof-of-concept (POC) demonstrating an Application Workflow Monitoring, Task Creation, and Escalation system. It is designed to be deterministic (rule-based) in its first iteration, but architecturally prepared for a future Agentic AI workflow engine.

## Architecture

The system uses a modern web stack:

- **Backend**: Python, FastAPI, Pydantic, SQLAlchemy, Neon DB (PostgreSQL)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Recharts

### Workflow Rules Implemented

1. **Assignment Task**: If an application is OPEN and NOT CLAIMED for > 1 day, create an ASSIGNMENT task for an Admin.
2. **Follow-up Task**: If an application has been CLAIMED by an Underwriter for > 1 day, create a FOLLOW_UP task for that underwriter.
3. **Escalation Task**: If an application has been CLAIMED for > 2 days, create an ESCALATION task for that underwriter's designated Manager (determined via `manager_user_id`).

- *Idempotency*: Ensures that duplicate tasks are not created if one already exists for a specific application and rule.

### Role Model & Organizational Hierarchy

The platform uses a standardized 3-tier organizational hierarchy:

$$
\text{Admin} \longrightarrow \text{Manager} \longrightarrow \text{Underwriter}
$$

- **Admin** (e.g. Alice Admin): Supervisory/administrative user. Monitors applications, full portfolio health, and handles unclaimed assignment tasks.
- **Manager** (e.g. Diana Manager): Supervises underwriters, monitors team cases, and resolves manager escalations.
- **Underwriter** (e.g. Bob Underwriter, Charlie Underwriter): Internal employees who claim and process loan applications.

> **DEMO ROLE SIMULATION DISCLAIMER**: The frontend Role Switcher is strictly a demonstration feature allowing quick persona simulation across Admin, Manager, and Underwriter perspectives. It is **not** an authentication or authorization system and does not enforce security boundaries.

## Database Configuration (Neon DB)

The application uses **Neon DB** (Serverless PostgreSQL).

1. Copy `.env.example` to `.env` (or configure your `.env` in the root folder):
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and configure your Neon connection string:
   ```env
   DATABASE_URL=postgresql://username:password@ep-your-instance.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Run the database migrations & seed:
   ```bash
   cd backend
   python -m app.seed
   ```

## Getting Started

Follow the instructions below to run the POC locally.

### 1. Run the Backend (API + Neon DB)

Open a terminal and navigate to the backend directory:

```bash
cd backend
python -m venv .venv

# Activate the virtual environment
# Windows:
.\.venv\Scripts\activate
# Mac/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database with demo data
python -m app.seed

# Run the backend server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000/api`

### 2. Run the Frontend (React UI)

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The UI will be available at `http://localhost:5173` (or the port Vite outputs).

## Demo Walkthrough

1. Open the **Dashboard** in the React app. You'll see KPI cards and Workflow Alerts indicating applications that have been untouched or stalled based on their mock timestamps.
2. Click **"Run Workflow"**. The backend rule engine evaluates all applications against Neon DB. You will see a success message indicating how many tasks/escalations were created.
3. Check the **Tasks** page. You will see newly generated tasks for assignments, follow-ups, and escalations.
4. Go to **Applications** -> click an App ID to view its details.
5. In the **Application Detail** page, view the Timeline history. You can claim open applications or complete them here.
6. Check the **Analytics** page to see Average Processing vs. Waiting times and bottleneck identification.

## Tests

Unit tests run against the database using isolated transaction savepoints:

```bash
cd backend
python -m pytest tests/
```
