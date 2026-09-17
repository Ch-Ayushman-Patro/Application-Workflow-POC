import { Link } from "react-router-dom";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";
import { 
  Clock, 
  ShieldAlert, 
  ArrowLeft, 
  UserCheck, 
  AlertTriangle, 
  ArrowUpRight, 
  Activity, 
  Inbox,
  Flame
} from "lucide-react";
import { formatHoursToDaysAndHours, formatApplicationAge, getApplicationRisk } from "../utils/formatters";
import { useRole } from "../context/RoleContext";
import { useAnalyticsSummary, useApplications, useTasks } from "../hooks/useWorkflowQueries";

export default function Analytics() {
  const { currentRole, switchRoleUser, allUsers } = useRole();
  const isAdmin = currentRole === "Admin";

  // STRICT ARCHITECTURAL RULE: Do NOT trigger analytics API request when currentRole is not Admin
  const { data: summary, isLoading: loadingSummary } = useAnalyticsSummary({ enabled: isAdmin });
  const { data: applications = [], isLoading: loadingApps } = useApplications();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  // If user is not Admin, display Access Restricted view and do NOT fetch analytics data
  if (!isAdmin) {
    const adminUser = allUsers.find((u) => u.role === "Admin");

    return (
      <div className="py-16 text-center max-w-lg mx-auto space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Restricted</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Process Intelligence, pipeline velocity metrics, and delay diagnostics are reserved exclusively for the <strong>Admin</strong> supervisory role.
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 text-left">
            <span className="font-semibold block mb-0.5">Demo Role Simulation Note:</span>
            This role restriction demonstrates role-tailored operational views. It is <strong>not</strong> an authentication or authorization security boundary.
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Return to Command Center
            </Button>
          </Link>
          {adminUser && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => switchRoleUser(adminUser.id)}
              icon={<UserCheck className="w-3.5 h-3.5" />}
            >
              Simulate as {adminUser.name} (Admin)
            </Button>
          )}
        </div>
      </div>
    );
  }

  const isLoading = (loadingSummary && !summary) || (loadingApps && applications.length === 0) || (loadingTasks && tasks.length === 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="py-16 text-center text-slate-500 text-sm">
        No analytics data available.
      </div>
    );
  }

  // ── 1. Pipeline Metrics ──────────────────────────────────────────────────
  const processingHours = Number(summary.avg_processing_time_hours.toFixed(1));
  const waitingHours = Number(summary.avg_waiting_time_hours.toFixed(1));
  const totalHours = processingHours + waitingHours;
  const waitingPercentage = totalHours > 0 ? Math.round((waitingHours / totalHours) * 100) : 0;
  const processingPercentage = 100 - waitingPercentage;

  const completionRate = summary.total_applications > 0
    ? Math.round((summary.completed_applications / summary.total_applications) * 100)
    : 0;

  const escalationRate = summary.total_applications > 0
    ? Math.round((summary.total_escalations / summary.total_applications) * 100)
    : 0;

  // ── 2. Where Applications Are Stuck (Stage Breakdown) ───────────────────────────
  const openUnclaimed = applications.filter(a => a.status === "OPEN" && !a.claimed_by_user_id);
  const claimedUnderReview = applications.filter(a => a.status === "CLAIMED");
  const openTasks = tasks.filter(t => t.status === "OPEN");
  const escalationTasks = openTasks.filter(t => t.task_type === "ESCALATION");
  const followUpTasks = openTasks.filter(t => t.task_type === "FOLLOW_UP");
  const assignmentTasks = openTasks.filter(t => t.task_type === "ASSIGNMENT");

  // Escalated Applications (unique application IDs)
  const escalatedAppIds = new Set(escalationTasks.map(t => t.application_id));
  const escalatedApps = applications.filter(a => escalatedAppIds.has(a.id));

  // ── 3. Why Are They Delayed (SLA Breach Rules) ───────────────────────────
  // Business SLA rules:
  // - Intake > 24h unassigned -> ASSIGNMENT task created
  // - Review > 24h claimed -> FOLLOW_UP task created
  // - Review > 48h claimed -> ESCALATION task created
  const slaBreachDetails = [
    {
      rule: "Intake > 24h (Unassigned)",
      count: assignmentTasks.length,
      impact: "Applications sitting without an assigned Underwriter.",
      severity: assignmentTasks.length > 0 ? "amber" : "neutral",
      action: "Assign to Underwriter"
    },
    {
      rule: "Review > 24h (Underwriter Delay)",
      count: followUpTasks.length,
      impact: "Underwriting review has stalled past the initial 24-hour SLA window.",
      severity: followUpTasks.length > 0 ? "amber" : "neutral",
      action: "Prompt underwriter follow-up"
    },
    {
      rule: "Review > 48h (Manager Escalation)",
      count: escalationTasks.length,
      impact: "Critical delay. Breached 48-hour SLA threshold requiring manager intervention.",
      severity: escalationTasks.length > 0 ? "rose" : "neutral",
      action: "Manager intervention required"
    }
  ];

  // ── 4. What Needs Attention (Actionable Applications) ───────────────────────────
  const atRiskApps = applications
    .filter(a => a.status !== "COMPLETED")
    .map(app => ({ app, risk: getApplicationRisk(app) }))
    .filter(item => item.risk.level === "escalated" || item.risk.level === "at_risk" || item.risk.level === "attention")
    .sort((a, b) => {
      const order = { escalated: 3, at_risk: 2, attention: 1, normal: 0, completed: -1 };
      return order[b.risk.level] - order[a.risk.level];
    });

  // ── 5. Bottleneck Analysis ───────────────────────────────────────────────
  const isQueueBottleneck = summary.bottleneck_stage === "Intake Queue" || summary.bottleneck_stage === "Unassigned";

  const bottleneckDescription = isQueueBottleneck
    ? "Applications are spending the longest accumulated time in the unassigned intake queue waiting for an underwriter to claim them."
    : summary.bottleneck_stage === "Underwriting Review"
    ? "Applications are spending the longest accumulated time under review by underwriters after being assigned."
    : `The highest accumulated delay is currently concentrated in the ${summary.bottleneck_stage} stage.`;

  const bottleneckCases = isQueueBottleneck
    ? openUnclaimed
    : claimedUnderReview;

  const chartData = [
    {
      name: "Human Review",
      hours: processingHours,
      color: "#4f46e5",
    },
    {
      name: "Queue Waiting",
      hours: waitingHours,
      color: "#f59e0b",
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Process Intelligence</h2>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
              Admin Supervisory
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Diagnose pipeline throughput, identify queue bottlenecks, and investigate why loan applications are breaching SLAs.
          </p>
        </div>
        <Link to="/applications">
          <Button variant="outline" size="sm" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
            View All Applications
          </Button>
        </Link>
      </div>

      {/* SECTION 1: Overall Pipeline Health */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          1. Overall Pipeline Health
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Volume</div>
            <div className="text-3xl font-bold text-slate-900">{summary.total_applications}</div>
            <div className="text-xs text-slate-500">Applications in system</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completion Rate</div>
            <div className="text-3xl font-bold text-emerald-600">{completionRate}%</div>
            <div className="text-xs text-slate-500">{summary.completed_applications} of {summary.total_applications} finalized</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Escalation Rate</div>
            <div className="text-3xl font-bold text-rose-600">{escalationRate}%</div>
            <div className="text-xs text-slate-500">{summary.total_escalations} manager escalations</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Backlog</div>
            <div className="text-3xl font-bold text-indigo-600">{summary.open_applications + summary.claimed_applications}</div>
            <div className="text-xs text-slate-500">{summary.pending_action} tasks awaiting action</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Where Applications Are Stuck */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          2. Where Are Applications Getting Stuck?
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Intake Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Inbox className="w-3.5 h-3.5 text-amber-500" />
                  Intake Queue
                </span>
                <Badge variant={openUnclaimed.length > 0 ? "warning" : "default"} size="sm">
                  {openUnclaimed.length} Unassigned
                </Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Submitted applications awaiting Underwriter assignment. Over 24h triggers an Admin assignment task.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Requires:</span>
              <span className="font-semibold text-slate-800">Underwriter Assignment</span>
            </div>
          </div>

          {/* Under Review */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  Underwriting Review
                </span>
                <Badge variant="info" size="sm">
                  {claimedUnderReview.length} In Progress
                </Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Applications currently claimed by underwriters. &gt;24h triggers underwriter follow-up; &gt;48h triggers manager escalation.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Requires:</span>
              <span className="font-semibold text-slate-800">Underwriter Decision / Approval</span>
            </div>
          </div>

          {/* Escalations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  Manager Escalations
                </span>
                <Badge variant={escalatedApps.length > 0 ? "error" : "success"} size="sm">
                  {escalatedApps.length} Escalated
                </Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Applications where SLA exceeded 48 hours without completion. Direct manager oversight active.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Requires:</span>
              <span className="font-semibold text-rose-700">Manager Intervention</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Why Are Applications Delayed (SLA Breach Breakdown) */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          3. Why Are They Delayed? (Workflow Rule Triggers)
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {slaBreachDetails.map((item, idx) => (
            <div key={idx} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">{item.rule}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    item.count > 0 && item.severity === "rose" 
                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                      : item.count > 0 && item.severity === "amber"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {item.count} Breach{item.count !== 1 ? "es" : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{item.impact}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400 font-medium hidden md:inline">Action: {item.action}</span>
                <Link to="/tasks">
                  <Button variant="outline" size="xs">
                    View Tasks
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: Primary Bottleneck & Actionable Delay Analysis */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          4. Primary Bottleneck Diagnosis
        </div>
        <div className="bg-linear-to-br from-slate-950 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-indigo-900/40 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                <Flame className="w-4 h-4" />
                Highest Accumulated Delay
              </div>
              <h3 className="text-xl sm:text-2xl font-bold">
                Stage Bottleneck: <span className="text-amber-300">{summary.bottleneck_stage}</span>
              </h3>
            </div>
            <span className="text-xs bg-white/10 px-2.5 py-1 rounded-lg font-medium text-slate-200 shrink-0">
              {bottleneckCases.length} Applications Affected
            </span>
          </div>
          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            {bottleneckDescription} This stage has accumulated the most idle waiting hours across the portfolio.
          </p>

          {/* Quick list of Applications in the bottleneck stage */}
          {bottleneckCases.length > 0 && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-xs font-semibold text-slate-300">Applications currently delayed in this stage:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {bottleneckCases.slice(0, 6).map(app => (
                  <Link
                    key={app.id}
                    to={`/applications/${app.id}`}
                    className="bg-white/5 hover:bg-white/10 transition-colors p-2.5 rounded-xl border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-indigo-300">{app.application_number}</div>
                      <div className="text-[11px] text-slate-400">{formatApplicationAge(app.created_at)} old</div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: Time Analysis in Plain Language & Chart */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          5. Active Work vs. Waiting Latency
        </div>
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Time Analysis Breakdown
              </CardTitle>
              <CardDescription>
                Comparison between active underwriting touch time and queue waiting latency.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plain language explanation */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2">
              <p>
                Across an average application lifecycle of <strong>{formatHoursToDaysAndHours(totalHours)}</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>
                  <strong className="text-indigo-700">{formatHoursToDaysAndHours(processingHours)} ({processingPercentage}%)</strong> is spent in active human processing (reviewing documents, underwriting, decisioning).
                </li>
                <li>
                  <strong className="text-amber-700">{formatHoursToDaysAndHours(waitingHours)} ({waitingPercentage}%)</strong> is spent idle in queues waiting for underwriter assignment or SLA escalation resolution.
                </li>
              </ul>
              <p className="text-[11px] text-slate-500 pt-1">
                Operational takeaway: Reducing queue idle time before assignment yields significantly faster turnaround than accelerating underwriter review speed.
              </p>
            </div>

            {/* Bar Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    formatter={(value) => [formatHoursToDaysAndHours(Number(value)), "Duration"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={80}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & Summary */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                <span>Active Touch Time: <strong>{formatHoursToDaysAndHours(processingHours)}</strong> ({processingPercentage}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span>Idle Waiting Latency: <strong>{formatHoursToDaysAndHours(waitingHours)}</strong> ({waitingPercentage}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 6: What Needs Immediate Attention */}
      {atRiskApps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              6. Actionable Applications Needing Attention ({atRiskApps.length})
            </div>
            <Link to="/applications" className="text-xs text-indigo-600 hover:underline font-medium">
              View in pipeline →
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {atRiskApps.slice(0, 5).map(({ app, risk }) => (
              <div key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/applications/${app.id}`}
                      className="font-mono text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                    >
                      {app.application_number}
                      <ArrowUpRight className="w-3 h-3 text-slate-400" />
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Stage: <span className="text-slate-700 font-medium">{app.current_stage || "Intake"}</span> · Owned by: <span className="text-slate-700 font-medium">{app.claimed_by?.name || "Unassigned"}</span> · {formatApplicationAge(app.created_at)} old
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={risk.badgeVariant} size="sm">
                    {risk.label}
                  </Badge>
                  <Link to={`/applications/${app.id}`}>
                    <Button size="xs" variant="outline">
                      Investigate
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
