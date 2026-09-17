import { Link } from "react-router-dom";
import { useUserScope } from "../hooks/useUserScope";
import type { Application } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { getApplicationRisk, formatApplicationAge, formatRelativeTime } from "../utils/formatters";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  InboxIcon,
  ChevronRight,
  UserCheck,
  Shield,
  Briefcase,
  Users,
  TrendingUp,
} from "lucide-react";
import { useRole } from "../context/RoleContext";

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent = "slate",
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "slate" | "indigo" | "rose" | "emerald" | "amber";
}) {
  const colors = {
    slate: "text-slate-900",
    indigo: "text-indigo-600",
    rose: "text-rose-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-3xl font-bold ${colors[accent]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{children}</h3>
  );
}

function ApplicationRow({ app }: { app: Application }) {
  const risk = getApplicationRisk(app);
  const hasEscalation = (app.tasks || []).some((t) => t.status === "OPEN" && t.task_type === "ESCALATION");
  return (
    <Link
      to={`/applications/${app.id}`}
      className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        {hasEscalation && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />}
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-indigo-600 group-hover:text-indigo-800">
            {app.application_number}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {app.claimed_by?.name ?? "Unassigned"} · {formatApplicationAge(app.created_at)} old
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant={
            risk.level === "escalated"
              ? "error"
              : risk.level === "at_risk"
              ? "warning"
              : risk.level === "attention"
              ? "orange"
              : risk.level === "completed"
              ? "success"
              : "info"
          }
          size="sm"
        >
          {risk.label}
        </Badge>
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
      </div>
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin Dashboard — Global Command Center
// ──────────────────────────────────────────────────────────────────────────────

function AdminDashboard() {
  const { currentUser } = useRole();
  const scope = useUserScope();

  const inProgress = scope.allApplications.filter((a) => a.status === "CLAIMED").length;
  const completedCount = scope.allApplications.filter((a) => a.status === "COMPLETED").length;
  const completionRate =
    scope.allApplications.length > 0
      ? Math.round((completedCount / scope.allApplications.length) * 100)
      : 0;

  // Top urgent Applications — escalated first, then at-risk, then attention
  const urgentCases = scope.allOverdueApplications.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 shrink-0 mt-0.5">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {currentUser.name.split(" ")[0]}'s Command Center
              </h2>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                Admin
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Global pipeline overview - {scope.allApplications.length} applications tracked.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Applications" value={scope.allApplications.length} sub="In the system" />
        <KpiCard label="Unassigned" value={scope.unclaimedApplications.length} sub="Awaiting underwriter" accent={scope.unclaimedApplications.length > 0 ? "amber" : "slate"} />
        <KpiCard label="In Progress" value={inProgress} sub="Under review" accent="indigo" />
        <KpiCard label="Completion Rate" value={`${completionRate}%`} sub={`${completedCount} finished`} accent={completionRate >= 50 ? "emerald" : "rose"} />
      </div>

      {/* Needs My Attention */}
      <div>
        <SectionHeading>Needs My Attention</SectionHeading>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {/* Unassigned Applications */}
          {scope.adminActionTasks.length > 0 ? (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <InboxIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {scope.adminActionTasks.length} Application{scope.adminActionTasks.length > 1 ? "s" : ""} need underwriter assignment
                    </div>
                    <div className="text-xs text-slate-500">
                      Unclaimed for &gt;24 hours - ASSIGNMENT tasks pending
                    </div>
                  </div>
                </div>
                <Link to="/tasks">
                  <Button variant="outline" size="xs" icon={<ChevronRight className="w-3 h-3" />}>
                    View Tasks
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-slate-600">No assignment tasks pending - queue is clear.</span>
            </div>
          )}
        </div>
      </div>

      {/* Unassigned backlog */}
      {scope.unclaimedApplications.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Unassigned Backlog</SectionHeading>
            <Link to="/applications" className="text-xs text-indigo-600 hover:underline font-medium">
              View all →
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {scope.unclaimedApplications.slice(0, 4).map((app) => (
              <ApplicationRow key={app.id} app={app} />
            ))}
            {scope.unclaimedApplications.length > 4 && (
              <div className="px-4 py-3 text-xs text-slate-500 text-center">
                +{scope.unclaimedApplications.length - 4} more unassigned Applications
              </div>
            )}
          </div>
        </div>
      )}

      {/* Priority Applications */}
      {urgentCases.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Priority Applications</SectionHeading>
            <Link to="/applications?filter=OVERDUE" className="text-xs text-indigo-600 hover:underline font-medium">
              View all →
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {urgentCases.map((app) => (
              <ApplicationRow key={app.id} app={app} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Manager Dashboard — Team Oversight
// ──────────────────────────────────────────────────────────────────────────────

function ManagerDashboard() {
  const { currentUser } = useRole();
  const scope = useUserScope();

  const teamOverdueCount = scope.teamOverdueApplications.length;
  const allTeamTasks = [...scope.myTasks, ...scope.teamTasks];
  const teamEscalations = scope.allOpenTasks.filter(
    (t) => t.task_type === "ESCALATION" && t.assigned_to_user_id === currentUser.id
  );

  // Per-underwriter breakdown
  const underwriterStats = scope.teamMembers.map((underwriter) => {
    const underwriterApps = scope.allApplications.filter((a) => a.claimed_by_user_id === underwriter.id);
    const activeCases = underwriterApps.filter((a) => a.status === "CLAIMED");
    const overdueCases = underwriterApps.filter(
      (a) => a.status !== "COMPLETED" && getApplicationRisk(a).level !== "normal" && getApplicationRisk(a).level !== "completed"
    );
    const underwriterTasks = scope.allOpenTasks.filter((t) => t.assigned_to_user_id === underwriter.id);
    return { underwriter, activeCases, overdueCases, underwriterTasks };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 shrink-0 mt-0.5">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {currentUser.name.split(" ")[0]}'s Dashboard
              </h2>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                Manager
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {scope.teamMembers.length} direct report{scope.teamMembers.length !== 1 ? "s" : ""} · {scope.teamApplications.length} team Applications
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Team Applications" value={scope.teamApplications.length} sub="Active in pipeline" accent="indigo" />
        <KpiCard label="Team Overdue" value={teamOverdueCount} sub="Need intervention" accent={teamOverdueCount > 0 ? "rose" : "emerald"} />
        <KpiCard label="My Escalations" value={teamEscalations.length} sub="Assigned to me" accent={teamEscalations.length > 0 ? "rose" : "slate"} />
        <KpiCard label="Team Tasks" value={allTeamTasks.length} sub="Open action items" accent={allTeamTasks.length > 0 ? "amber" : "slate"} />
      </div>

      {/* My Escalations */}
      {teamEscalations.length > 0 && (
        <div>
          <SectionHeading>My Escalations</SectionHeading>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl divide-y divide-rose-100">
            {teamEscalations.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-rose-900">
                      {scope.allApplications.find((a) => a.id === task.application_id)?.application_number || `APP-${task.application_id}`} escalated
                    </div>
                    <div className="text-xs text-rose-600">
                      {task.assigned_to?.name ?? "Underwriter"} · {formatRelativeTime(task.created_at)}
                    </div>
                  </div>
                </div>
                <Link to={`/applications/${task.application_id}`}>
                  <Button variant="danger" size="xs">Review Application</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Underwriter Overview */}
      {underwriterStats.length > 0 && (
        <div>
          <SectionHeading>Team Overview</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {underwriterStats.map(({ underwriter, activeCases, overdueCases, underwriterTasks }) => (
              <div key={underwriter.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {underwriter.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{underwriter.name}</div>
                    <div className="text-[11px] text-slate-500">{underwriter.role}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-lg font-bold text-slate-900">{activeCases.length}</div>
                    <div className="text-[10px] text-slate-500">Active</div>
                  </div>
                  <div className={`rounded-xl p-2.5 ${overdueCases.length > 0 ? "bg-rose-50" : "bg-slate-50"}`}>
                    <div className={`text-lg font-bold ${overdueCases.length > 0 ? "text-rose-600" : "text-slate-900"}`}>
                      {overdueCases.length}
                    </div>
                    <div className="text-[10px] text-slate-500">Overdue</div>
                  </div>
                  <div className={`rounded-xl p-2.5 ${underwriterTasks.length > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
                    <div className={`text-lg font-bold ${underwriterTasks.length > 0 ? "text-amber-600" : "text-slate-900"}`}>
                      {underwriterTasks.length}
                    </div>
                    <div className="text-[10px] text-slate-500">Tasks</div>
                  </div>
                </div>
                {overdueCases.length > 0 && (
                  <Link to="/applications" className="block">
                    <Button variant="outline" size="xs" className="w-full" icon={<ChevronRight className="w-3 h-3" />}>
                      View Applications
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team overdue Applications */}
      {scope.teamOverdueApplications.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Team Applications Needing Attention</SectionHeading>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {scope.teamOverdueApplications.slice(0, 5).map((app) => (
              <ApplicationRow key={app.id} app={app} />
            ))}
          </div>
        </div>
      )}

      {scope.teamMembers.length === 0 && (
        <div className="py-12 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No direct reports found</p>
          <p className="text-xs text-slate-400">Team membership is determined by manager_user_id in the user directory.</p>
        </div>
      )}

    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Underwriter Dashboard — Personal Workspace
// ──────────────────────────────────────────────────────────────────────────────

function UnderwriterDashboard() {
  const { currentUser } = useRole();
  const scope = useUserScope();

  const completedMyCases = scope.allApplications.filter(
    (a) => a.claimed_by_user_id === currentUser.id && a.status === "COMPLETED"
  ).length;

  const myActiveCases = scope.myApplications.filter((a) => a.status === "CLAIMED");
  const followUpTasks = scope.myTasks.filter((t) => t.task_type === "FOLLOW_UP");
  const myRecentCompletions = scope.allApplications
    .filter((a) => a.claimed_by_user_id === currentUser.id && a.status === "COMPLETED" && a.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 shrink-0 mt-0.5">
          <UserCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {currentUser.name.split(" ")[0]}'s Workspace
            </h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
              Underwriter
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Your personal casework · {scope.myApplications.length} Applications claimed, {scope.myTasks.length} tasks pending.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="My Applications" value={scope.myApplications.length} sub="Total claimed" accent="indigo" />
        <KpiCard label="Active" value={myActiveCases.length} sub="Under review" accent={myActiveCases.length > 0 ? "indigo" : "slate"} />
        <KpiCard label="Overdue" value={scope.myOverdueApplications.length} sub="Need follow-up" accent={scope.myOverdueApplications.length > 0 ? "rose" : "emerald"} />
        <KpiCard label="Completed" value={completedMyCases} sub="Applications finished" accent="emerald" />
      </div>

      {/* Follow-ups needing action */}
      {followUpTasks.length > 0 && (
        <div>
          <SectionHeading>Needs Your Follow-Up</SectionHeading>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl divide-y divide-amber-100">
            {followUpTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-amber-900">
                      {scope.allApplications.find((a) => a.id === task.application_id)?.application_number || `APP-${task.application_id}`} — SLA follow-up required
                    </div>
                    <div className="text-xs text-amber-700">
                      Claimed review has exceeded 24h · {formatRelativeTime(task.created_at)}
                    </div>
                  </div>
                </div>
                <Link to={`/applications/${task.application_id}`}>
                  <Button variant="outline" size="xs">Open Application</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Active Applications */}
      {myActiveCases.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>My Active Applications</SectionHeading>
            <Link to="/applications" className="text-xs text-indigo-600 hover:underline font-medium">
              View all →
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {myActiveCases.slice(0, 5).map((app) => (
              <ApplicationRow key={app.id} app={app} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {scope.myApplications.length === 0 && scope.myTasks.length === 0 && (
        <div className="py-14 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
            <InboxIcon className="w-7 h-7 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No active Applications</p>
            <p className="text-xs text-slate-400 mt-1">
              Go to Application Pipeline to claim available applications.
            </p>
          </div>
          <Link to="/applications">
            <Button variant="outline" size="sm" icon={<TrendingUp className="w-3.5 h-3.5" />}>
              Browse Applications
            </Button>
          </Link>
        </div>
      )}

      {/* Recent completions */}
      {myRecentCompletions.length > 0 && (
        <div>
          <SectionHeading>Recently Completed</SectionHeading>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {myRecentCompletions.map((app) => (
              <Link
                key={app.id}
                to={`/applications/${app.id}`}
                className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-mono text-sm font-bold text-slate-700">{app.application_number}</div>
                    <div className="text-[11px] text-slate-400">
                      Completed {formatRelativeTime(app.completed_at)}
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Dashboard — Routes to the right persona view
// ──────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { currentRole } = useRole();
  const { isLoading } = useUserScope();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (currentRole === "Admin") return <AdminDashboard />;
  if (currentRole === "Manager") return <ManagerDashboard />;
  return <UnderwriterDashboard />;
}
