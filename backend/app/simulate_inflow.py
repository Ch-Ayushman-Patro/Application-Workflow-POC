"""
CLI script to simulate incoming loan applications and trigger workflow SLA evaluations.
Run from backend directory with:
    python -m app.simulate_inflow [count]
Example:
    python -m app.simulate_inflow 50
"""
import sys
from app.database import SessionLocal
from app.services.generator import generate_random_cases

def main():
    count = 50
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            print(f"[!] Invalid count '{sys.argv[1]}', defaulting to 50.")
            count = 50

    print(f"\n[+] Simulating {count} loan applications with realistic SLA lifecycle aging...", flush=True)
    db = SessionLocal()
    try:
        result = generate_random_cases(db, count=count, run_workflow=True)
        app_nums = result.get("application_numbers", [])
        if app_nums:
            first_num = app_nums[0]
            last_num = app_nums[-1]
            print(f"[OK] Successfully created {result['cases_created']} new cases ({first_num} ... {last_num})", flush=True)
        else:
            print(f"[OK] Created {result['cases_created']} new cases.", flush=True)

        stats = result.get("workflow_stats")
        if stats:
            print("\nWorkflow Engine Execution:", flush=True)
            print(f"  - Applications Analyzed: {stats.get('applications_checked', 0)}", flush=True)
            print(f"  - New Tasks Created:     {stats.get('tasks_created', 0)}", flush=True)
            print(f"  - Escalations Created:   {stats.get('escalations_created', 0)}", flush=True)
            print(f"  - Existing Maintained:   {stats.get('tasks_already_existing', 0)}", flush=True)
        print("\nReady! View the updated dataset at http://localhost:5173\n", flush=True)
    finally:
        db.close()

if __name__ == "__main__":
    main()
