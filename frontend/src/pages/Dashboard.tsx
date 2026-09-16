import { useState } from "react";
import { Link } from "react-router-dom";
import { useApplications, useTasks, useAnalyticsSummary } from "../hooks/useWorkflowQueries";
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
  ChevronRight,
  UserCheck,
  Shield,
  Briefcase
} from "lucide-react";
import { useRole } from "../context/RoleContext";

export default function Dashboard() {
  const { currentUser, currentRole, allUsers } = useRole();
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);

  // Cached server-state queries
  const { data: applications = [], isLoading: loadingApps } = useApplications();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();
  // STRICT REQUIREMENT: Only fetch analytics summary if currentRole is Admin
  const { data: summary = null } = useAnalyticsSummary({ enabled: currentRole === "Admin" });

  // Only show skeleton on initial load if cache is empty
  const loading = (loadingApps && applications.length === 0) || (loadingTasks && tasks.length === 0);

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

  // Determine team members reporting to current user (for Manager)
  const teamOfficerIds = allUsers.filter(u => u.manager_user_id === currentUser.id).map(u => u.id);

  // Global counts
  const allOpenTasks = tasks.filter(t => t.status === "OPEN");
  const unclaimedApps = applications.filter(a => a.status === "OPEN" && !a.claimed_by_user_id);
  const inProgressApps = applications.filter(a => a.status === "CLAIMED");
  const completedApps = applications.filter(a => a.status === "COMPLETED");

  // Filtered views by simulated perspective
  let displayApps = applications;
  let relevantTasks = allOpenTasks;
  let perspectiveTitle = "Supervisory Operations";
  let perspectiveSubtitle = `Global portfolio monitoring — tracking ${applications.length} applications and all queues.`;
  let roleIcon = <Shield className="w-5 h-5 text-purple-600" />;

  if (currentRole === "Claimed Officer") {
    displayApps = applications.filter(a => a.claimed_by_user_id === currentUser.id);
    relevantTasks = allOpenTasks.filter(t => 
      t.assigned_to_user_id === currentUser.id || 
      (t.task_type === "FOLLOW_UP" && applications.find(a => a.id === t.application_id)?.claimed_by_user_id === currentUser.id)
    );
    perspectiveTitle = `Officer Workspace (${currentUser.name})`;
    perspectiveSubtitle = `Active workload: ${displayApps.length} cases claimed by you, with ${relevantTasks.length} pending tasks.`;
    roleIcon = <UserCheck className="w-5 h-5 text-emerald-600" />;
  } else if (currentRole === "Manager") {
    displayApps = applications.filter(a => a.claimed_by_user_id && teamOfficerIds.includes(a.claimed_by_user_id));
    relevantTasks = allOpenTasks.filter(t => 
      t.task_type === "ESCALATION" || 
      (t.assigned_to_user_id && teamOfficerIds.includes(t.assigned_to_user_id)) ||
      t.assigned_to_user_id === currentUser.id
    );
    perspectiveTitle = `Manager Dashboard (${currentUser.name})`;
    perspectiveSubtitle = `Team oversight: monitoring ${teamOfficerIds.length} direct report officers and active escalations.`;
    roleIcon = <Briefcase className="w-5 h-5 text-blue-600" />;
  }

  // Urgent / Overdue cases in scope
  const targetAppsForUrgent = currentRole === "Admin" ? applications : displayApps;
  const urgentApps = targetAppsForUrgent
    .filter(app => app.status !== "COMPLETED")
    .map(app => ({ app, risk: getApplicationRisk(app) }))
    .filter(item => item.risk.level === "escalated" || item.risk.level === "at_risk" || item.risk.level === "attention")
    .sort((a, b) => {
      const order = { escalated: 3, at_risk: 2, attention: 1, normal: 0, completed: -1 };
      return order[b.risk.level] - order[a.risk.level];
    });

  const escalationTasks = relevantTasks.filter(t => t.task_type === "ESCALATION");
  const followUpTasks = relevantTasks.filter(t => t.task_type === "FOLLOW_UP");
  const assignmentTasks = relevantTasks.filter(t => t.task_type === "ASSIGNMENT");

  const processingHours = summary ? Number(summary.avg_processing_time_hours.toFixed(1)) : 0;
  const waitingHours = summary ? Number(summary.avg_waiting_time_hours.toFixed(1)) : 0;
  const totalTime = processingHours + waitingHours;
  const waitingPercent = totalTime > 0 ? Math.round((waitingHours / totalTime) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shrink-0 mt-0.5">
            {roleIcon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{perspectiveTitle}</h2>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-600 border border-slate-300">
                {currentRole}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {perspectiveSubtitle}
            </p>
          </div>
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

      {/* 4 Stat Cards based on Perspective */}
      {currentRole === "Admin" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New / Unclaimed</div>
            <div className="text-3xl font-bold text-amber-600">{unclaimedApps.length}</div>
            <div className="text-xs text-slate-500">Waiting for officer assignment</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</div>
            <div className="text-3xl font-bold text-indigo-600">{inProgressApps.length}</div>
            <div className="text-xs text-slate-500">Claimed across all officers</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Alerts</div>
            <div className="text-3xl font-bold text-rose-600">{urgentApps.length}</div>
            <div className="text-xs text-slate-500">{escalationTasks.length} manager escalations</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</div>
            <div className="text-3xl font-bold text-emerald-600">{completedApps.length}</div>
            <div className="text-xs text-slate-500">
              {applications.length > 0 ? Math.round((completedApps.length / applications.length) * 100) : 0}% completion rate
            </div>
          </div>
        </div>
      )}

      {currentRole === "Manager" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team In-Progress</div>
            <div className="text-3xl font-bold text-blue-600">
              {displayApps.filter(a => a.status === "CLAIMED").length}
            </div>
            <div className="text-xs text-slate-500">Claimed by your officers</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Overdue</div>
            <div className="text-3xl font-bold text-rose-600">{urgentApps.length}</div>
            <div className="text-xs text-slate-500">Cases past SLA limits</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Manager Escalations</div>
            <div className="text-3xl font-bold text-amber-600">{escalationTasks.length}</div>
            <div className="text-xs text-slate-500">Escalated to your desk</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Completed</div>
            <div className="text-3xl font-bold text-emerald-600">
              {displayApps.filter(a => a.status === "COMPLETED").length}
            </div>
            <div className="text-xs text-slate-500">Finalized by team</div>
          </div>
        </div>
      )}

      {currentRole === "Claimed Officer" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Claimed Cases</div>
            <div className="text-3xl font-bold text-emerald-600">
              {displayApps.filter(a => a.status === "CLAIMED").length}
            </div>
            <div className="text-xs text-slate-500">Active reviews on your desk</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Overdue Cases</div>
            <div className="text-3xl font-bold text-rose-600">{urgentApps.length}</div>
            <div className="text-xs text-slate-500">Exceeded standard SLA</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Follow-Up Tasks</div>
            <div className="text-3xl font-bold text-amber-600">{followUpTasks.length}</div>
            <div className="text-xs text-slate-500">Action items assigned to you</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Completed</div>
            <div className="text-3xl font-bold text-indigo-600">
              {displayApps.filter(a => a.status === "COMPLETED").length}
            </div>
            <div className="text-xs text-slate-500">Cases you resolved</div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Overdue / Urgent Cases in Scope */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {urgentApps.length > 0 ? (
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    {urgentApps.length} {currentRole === "Claimed Officer" ? "of your cases need" : "cases need"} attention
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    All {currentRole === "Claimed Officer" ? "your" : ""} cases are on track
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentRole === "Claimed Officer" 
                  ? "Your claimed cases that require prompt action" 
                  : "Cases in scope that have exceeded SLA time limits"}
              </p>
            </div>
            <Link to="/applications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {urgentApps.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No overdue cases in your queue</p>
              <p className="text-xs text-slate-400">All active applications are progressing within SLA targets.</p>
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
                      <span>{app.claimed_by?.name || 'Unclaimed'}</span>
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
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {currentRole === "Claimed Officer" ? "My Task Queue" : currentRole === "Manager" ? "Team Tasks & Escalations" : "Operational Task Queue"}
                </h3>
                <div className="text-[11px] text-slate-500">
                  {relevantTasks.length} open items in perspective
                </div>
              </div>
              <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100">
                <div>
                  <div className="text-xs font-bold text-rose-900">Manager Escalations</div>
                  <div className="text-[11px] text-rose-600">Escalated past SLA</div>
                </div>
                <span className="text-lg font-bold text-rose-700">{escalationTasks.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div>
                  <div className="text-xs font-bold text-amber-900">Officer Follow-Ups</div>
                  <div className="text-[11px] text-amber-600">SLA exceeded by Claimed Officer</div>
                </div>
                <span className="text-lg font-bold text-amber-700">{followUpTasks.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                <div>
                  <div className="text-xs font-bold text-blue-900">Intake Assignments</div>
                  <div className="text-[11px] text-blue-600">Cases waiting for assignment</div>
                </div>
                <span className="text-lg font-bold text-blue-700">{assignmentTasks.length}</span>
              </div>
              {relevantTasks.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2 justify-center">
                  <InboxIcon className="w-4 h-4" />
                  No pending tasks in this view
                </div>
              )}
            </div>
          </div>

          {/* Time Split Card (Admin Only) */}
          {currentRole === "Admin" && summary && (
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
      />
    </div>
  );
}
