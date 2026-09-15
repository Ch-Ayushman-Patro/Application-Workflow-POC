import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { getAnalyticsSummary, runWorkflow, getApplications } from "../services/api";
import { AnalyticsSummary, Application } from "../types";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const loadData = () => {
    getAnalyticsSummary().then(setSummary);
    getApplications().then(setApps);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunWorkflow = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await runWorkflow();
      setResult(res);
      loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  if (!summary) return <div>Loading...</div>;

  const alerts = apps.filter(app => app.status !== "COMPLETED").map(app => {
    const age = (new Date().getTime() - new Date(app.created_at).getTime()) / (1000 * 3600 * 24);
    if (app.status === "OPEN" && age > 1) {
      return { id: app.id, app: app.application_number, msg: `Unclaimed for ${formatDistanceToNow(new Date(app.created_at))}`, action: "Assignment required" };
    }
    if (app.status === "CLAIMED" && app.claimed_at) {
      const claimedAge = (new Date().getTime() - new Date(app.claimed_at).getTime()) / (1000 * 3600 * 24);
      if (claimedAge > 2) return { id: app.id, app: app.application_number, msg: `With ${app.current_role} for ${formatDistanceToNow(new Date(app.claimed_at))}`, action: "Escalation required" };
      if (claimedAge > 1) return { id: app.id, app: app.application_number, msg: `With ${app.current_role} for ${formatDistanceToNow(new Date(app.claimed_at))}`, action: "Follow-up required" };
    }
    return null;
  }).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Overview</h2>
        <button
          onClick={handleRunWorkflow}
          disabled={isRunning}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? "Running..." : "Run Workflow"}
        </button>
      </div>

      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          Workflow completed: Checked {result.applications_checked} apps. Created {result.tasks_created} tasks ({result.escalations_created} escalations). {result.tasks_already_existing} tasks already existed.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Total Applications</h3>
          <p className="text-3xl font-bold mt-2">{summary.total_applications}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Open / Unclaimed</h3>
          <p className="text-3xl font-bold mt-2 text-yellow-600">{summary.open_applications}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Pending Action (Tasks)</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">{summary.pending_action}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-bold mb-4">Workflow Alerts</h3>
        {alerts.length === 0 ? (
          <p className="text-gray-500">No alerts at this time.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert: any, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded">
                <div>
                  <Link to={`/applications/${alert.id}`} className="font-medium text-red-700 hover:underline">{alert.app}</Link>
                  <span className="text-red-600 ml-2">- {alert.msg}</span>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                  {alert.action}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

