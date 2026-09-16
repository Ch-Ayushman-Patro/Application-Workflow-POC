"""
CLI script to simulate incoming loan applications and trigger workflow SLA evaluations.
Run from backend directory with:
    python -m app.simulate_inflow
"""
import sys
from app.database import SessionLocal
from app.services.generator import generate_random_cases

def main():
    count = 3
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            count = 3

    print(f"\n🚀 Simulating {count} incoming applications with SLA lifecycle aging...")
    db = SessionLocal()
    try:
        result = generate_random_cases(db, count=count, run_workflow=True)
        print(f"✅ Created {result['cases_created']} new cases: {', '.join(result['application_numbers'])}")
        
        stats = result.get('workflow_stats')
        if stats:
            print("\n📊 Workflow Engine Execution:")
            print(f"  • Applications Analyzed: {stats['applications_checked']}")
            print(f"  • New Tasks Created:     {stats['tasks_created']}")
            print(f"  • Escalations Created:   {stats['escalations_created']}")
            print(f"  • Existing Maintained:   {stats['tasks_already_existing']}")
        print("\n✨ Ready! Check the frontend at http://localhost:5173\n")
    finally:
        db.close()

if __name__ == "__main__":
    main()

