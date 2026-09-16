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
import { Skeleton } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";
import { Clock, ShieldAlert, ArrowLeft, UserCheck } from "lucide-react";
import { formatHoursToDaysAndHours } from "../utils/formatters";
import { useRole } from "../context/RoleContext";
import { useAnalyticsSummary } from "../hooks/useWorkflowQueries";

export default function Analytics() {
  const { currentRole, switchRoleUser, allUsers } = useRole();
  const isAdmin = currentRole === "Admin";

  // STRICT REQUIREMENT: Do NOT trigger analytics API request when currentRole is not Admin
  const { data: summary, isLoading } = useAnalyticsSummary({ enabled: isAdmin });

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
            Process Intelligence, queue latency split, and bottleneck analysis are reserved exclusively for the <strong>Admin</strong> perspective.
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 text-left">
            <span className="font-semibold block mb-0.5">Demo Role Simulation Note:</span>
            This role restriction is designed to demonstrate role-tailored views. It is <strong>not</strong> an authentication or authorization security boundary.
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

  if (isLoading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
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

  const chartData = [
    {
      name: "Actively worked on",
      hours: processingHours,
      color: "#4f46e5",
    },
    {
      name: "Sitting idle / waiting",
      hours: waitingHours,
      color: "#f59e0b",
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Process Intelligence</h2>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
              Admin View
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Understand how long cases take, and where the queue delays are accumulating.
          </p>
        </div>
      </div>

      {/* Key Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cases</div>
          <div className="text-3xl font-bold text-slate-900">{summary.total_applications}</div>
          <div className="text-xs text-slate-500">In the system</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</div>
          <div className="text-3xl font-bold text-emerald-600">{completionRate}%</div>
          <div className="text-xs text-slate-500">{summary.completed_applications} of {summary.total_applications} finished</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Escalation Rate</div>
          <div className="text-3xl font-bold text-rose-600">{escalationRate}%</div>
          <div className="text-xs text-slate-500">{summary.total_escalations} manager alerts</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Backlog</div>
          <div className="text-3xl font-bold text-indigo-600">{summary.open_applications + summary.claimed_applications}</div>
          <div className="text-xs text-slate-500">{summary.pending_action} tasks still open</div>
        </div>
      </div>

      {/* Main Insight Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Key Finding</p>
          <h3 className="text-xl sm:text-2xl font-bold">
            {waitingPercentage}% of the time, cases are just{" "}
            <span className="text-amber-400">sitting and waiting</span>
          </h3>
          <p className="text-sm text-slate-300">
            Only {processingPercentage}% of the total lifecycle involves active human touch time. The rest is idle time in queues.
            The primary bottleneck is <strong className="text-white">{summary.bottleneck_stage}</strong>.
          </p>
        </div>
        <div className="shrink-0 grid grid-cols-2 gap-3 text-center">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-indigo-300">{formatHoursToDaysAndHours(processingHours)}</div>
            <div className="text-xs text-slate-400 mt-1">Avg. work time</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-400">{formatHoursToDaysAndHours(waitingHours)}</div>
            <div className="text-xs text-slate-400 mt-1">Avg. wait time</div>
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Active Work vs. Waiting Time (Average Hours per Case)
            </CardTitle>
            <CardDescription>
              How much time is actually spent working on a case vs. sitting unattended in a queue?
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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

          {/* Legend */}
          <div className="flex items-center justify-center gap-8 pt-4 border-t border-slate-100 mt-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
              <span>Human work: <strong>{formatHoursToDaysAndHours(processingHours)}</strong> ({processingPercentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span>Waiting idle: <strong>{formatHoursToDaysAndHours(waitingHours)}</strong> ({waitingPercentage}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
