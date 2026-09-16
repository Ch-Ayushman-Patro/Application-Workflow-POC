import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  getApplications, 
  getTasks, 
  getAnalyticsSummary 
} from "../services/api";
import type { Application, Task, AnalyticsSummary } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { WorkflowRunModal } from "../components/WorkflowRunModal";
import { 
  getApplicationRisk, 
  formatHoursToDaysAndHours,
  formatApplicationAge
} from "../utils/formatters";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Play, 
  ArrowUpRight,
  InboxIcon,
  ChevronRight
} from "lucide-react";

export default function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [appsData, tasksData, summaryData] = await Promise.all([
        getApplications(),
        getTasks(),
        getAnalyticsSummary()
      ]);
      setApplications(appsData);
      setTasks(tasksData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleWorkflowRun = () => loadData();
    window.addEventListener('workflow-run-completed', handleWorkflowRun);
    return () => window.removeEventListener('workflow-run-completed', handleWorkflowRun);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const openTasks = tasks.filter(t => t.status === "OPEN");
  const escalationTasks = openTasks.filter(t => t.task_type === "ESCALATION");
  const followUpTasks = openTasks.filter(t => t.task_type === "FOLLOW_UP");
  const assignmentTasks = openTasks.filter(t => t.task_type === "ASSIGNMENT");

  const unclaimedApps = applications.filter(a => a.status === "OPEN" && !a.claimed_by_user_id);
  const inProgressApps = applications.filter(a => a.status === "CLAIMED");
  const completedApps = applications.filter(a => a.status === "COMPLETED");

  const urgentApps = applications
    .filter(app => app.status !== "COMPLETED")
    .map(app => ({ app, risk: getApplicationRisk(app) }))
    .filter(item => item.risk.level === "escalated" || item.risk.level === "at_risk" || item.risk.level === "attention")
    .sort((a, b) => {
      const order = { escalated: 3, at_risk: 2, attention: 1, normal: 0, completed: -1 };
      return order[b.risk.level] - order[a.risk.level];
    });

  const processingHours = summary ? Number(summary.avg_processing_time_hours.toFixed(1)) : 0;
  const waitingHours = summary ? Number(summary.avg_waiting_time_hours.toFixed(1)) : 0;
  const totalTime = processingHours + waitingHours;
  const waitingPercent = totalTime > 0 ? Math.round((waitingHours / totalTime) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Tracking {applications.length} applications across your operations team.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setIsRunModalOpen(true)}
          icon={<Play className="w-4 h-4 fill-current" />}
        >
          Run Engine
        </Button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New / Unclaimed</div>
          <div className="text-3xl font-bold text-amber-600">{unclaimedApps.length}</div>
          <div className="text-xs text-slate-500">Waiting to be assigned</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</div>
          <div className="text-3xl font-bold text-indigo-600">{inProgressApps.length}</div>
          <div className="text-xs text-slate-500">Being actively worked on</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue</div>
          <div className="text-3xl font-bold text-rose-600">{urgentApps.length}</div>
          <div className="text-xs text-slate-500">{escalationTasks.length} manager alerts active</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</div>
          <div className="text-3xl font-bold text-emerald-600">{completedApps.length}</div>
          <div className="text-xs text-slate-500">
            {applications.length > 0 ? Math.round((completedApps.length / applications.length) * 100) : 0}% completion rate
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Overdue / Urgent Cases */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {urgentApps.length > 0 ? (
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    {urgentApps.length} cases need attention
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    All cases are on track
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cases that have exceeded their SLA time limits
              </p>
            </div>
            <Link to="/applications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {urgentApps.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No overdue cases right now</p>
              <p className="text-xs text-slate-400">All active applications are within time limits.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {urgentApps.slice(0, 5).map(({ app, risk }) => (
                <div key={app.id} className={`px-5 py-4 flex items-center justify-between gap-4 ${risk.level === 'escalated' ? 'bg-rose-50/40' : ''}`}>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900">{app.application_number}</span>
                      <Badge variant={risk.badgeVariant} dot pulse={risk.level === 'escalated'}>
                        {risk.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatApplicationAge(app.created_at)} old
                      </span>
                      <span>•</span>
                      <span>{app.claimed_by?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <Link to={`/applications/${app.id}`}>
                    <Button variant="outline" size="xs" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                      Open
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Task Summary + Time Split */}
        <div className="space-y-4">
          {/* Task Queue Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Task Queue</h3>
              <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100">
                <div>
                  <div className="text-xs font-bold text-rose-900">Manager Escalations</div>
                  <div className="text-[11px] text-rose-600">Needs immediate action</div>
                </div>
                <span className="text-lg font-bold text-rose-700">{escalationTasks.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div>
                  <div className="text-xs font-bold text-amber-900">Follow-Ups</div>
                  <div className="text-[11px] text-amber-600">SLA exceeded by officer</div>
                </div>
                <span className="text-lg font-bold text-amber-700">{followUpTasks.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                <div>
                  <div className="text-xs font-bold text-blue-900">Assignments</div>
                  <div className="text-[11px] text-blue-600">Cases waiting to be claimed</div>
                </div>
                <span className="text-lg font-bold text-blue-700">{assignmentTasks.length}</span>
              </div>
              {openTasks.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2 justify-center">
                  <InboxIcon className="w-4 h-4" />
                  No pending tasks
                </div>
              )}
            </div>
          </div>

          {/* Time Split Card */}
          {summary && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Where is the time going?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Average per application
                </p>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    style={{ width: `${100 - waitingPercent}%` }}
                    className="bg-indigo-500 h-full"
                    title={`Active work: ${processingHours}h`}
                  />
                  <div
                    style={{ width: `${waitingPercent}%` }}
                    className="bg-amber-400 h-full"
                    title={`Waiting: ${waitingHours}h`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                    Work ({formatHoursToDaysAndHours(processingHours)})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Waiting ({formatHoursToDaysAndHours(waitingHours)} — {waitingPercent}%)
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                Bottleneck stage: <strong className="text-slate-800">{summary.bottleneck_stage}</strong>
              </p>
              <Link to="/analytics" className="block text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                See full analytics →
              </Link>
            </div>
          )}
        </div>
      </div>

      <WorkflowRunModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
