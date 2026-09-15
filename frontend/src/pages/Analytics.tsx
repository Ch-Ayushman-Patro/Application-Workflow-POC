import { useState, useEffect } from "react";
import { getAnalyticsSummary } from "../services/api";
import type { AnalyticsSummary } from "../types";
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
import { Badge } from "../components/ui/Badge";
import { 
  Clock, 
  ShieldAlert, 
  Flame
} from "lucide-react";

export default function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalyticsSummary()
      .then((data) => setSummary(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    const handleWorkflowRun = () => {
      getAnalyticsSummary().then(setSummary).catch(console.error);
    };
    window.addEventListener('workflow-run-completed', handleWorkflowRun);
    return () => window.removeEventListener('workflow-run-completed', handleWorkflowRun);
  }, []);

  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const processingHours = Number(summary.avg_processing_time_hours.toFixed(1));
  const waitingHours = Number(summary.avg_waiting_time_hours.toFixed(1));
  const totalHours = processingHours + waitingHours;
  const waitingPercentage = totalHours > 0 ? Math.round((waitingHours / totalHours) * 100) : 0;
  const processingPercentage = 100 - waitingPercentage;

  const comparisonData = [
    {
      name: "Active Human Work",
      hours: processingHours,
      color: "#4f46e5", // indigo-600
      description: "Direct underwriter & operator touch time"
    },
    {
      name: "Queue Waiting Time",
      hours: waitingHours,
      color: "#f59e0b", // amber-500
      description: "Idle time waiting for assignment or review"
    }
  ];

  const completionRate = summary.total_applications > 0
    ? Math.round((summary.completed_applications / summary.total_applications) * 100)
    : 0;

  const escalationRate = summary.total_applications > 0
    ? Math.round((summary.total_escalations / summary.total_applications) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Process Intelligence</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Diagnose pipeline friction, identify queue bottlenecks, and compare human work vs idle wait time.
        </p>
      </div>

      {/* Hero Storytelling Banner: The Pipeline Bottleneck Spotlight */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              Primary Pipeline Bottleneck
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Applications spend <span className="text-amber-400">{waitingPercentage}% of their lifecycle</span> waiting idle
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              The primary workflow friction point is centered in <strong className="text-white font-semibold">{summary.bottleneck_stage}</strong>. 
              While active processing requires an average of {processingHours} hours, cases remain waiting in queue for {waitingHours} hours before assignment and review completion.
            </p>
          </div>

          {/* Quick Metrics Badge Card */}
          <div className="shrink-0 p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-3 min-w-[220px]">
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Critical Stage</div>
              <div className="text-xl font-bold text-rose-400">{summary.bottleneck_stage}</div>
            </div>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Escalations</span>
              <span className="text-lg font-bold text-white">{summary.total_escalations}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Pending Actions</span>
              <span className="text-lg font-bold text-amber-400">{summary.pending_action}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Comparison: Processing Time vs Waiting Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recharts Bar Comparison */}
        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Human Processing vs. Waiting Time (Hours)
              </CardTitle>
              <CardDescription>
                Comparison of actual operator work duration versus idle queue latency
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
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
                    formatter={(value) => [`${value} Hours`, "Duration"]}
                    contentStyle={{ 
                      borderRadius: "12px", 
                      border: "1px solid #e2e8f0", 
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={64}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Insight Callout */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                <span>Active Touch: <strong>{processingHours}h</strong> ({processingPercentage}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <span>Idle Waiting: <strong>{waitingHours}h</strong> ({waitingPercentage}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Stage Health & SLA Hotspots */}
        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Pipeline Stages & SLA Latency Breakdown
              </CardTitle>
              <CardDescription>
                Where delays accumulate across deterministic workflow stages
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            {/* Stage 1 */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span className="text-xs font-bold text-slate-900">Intake & Assignment Stage</span>
                </div>
                <Badge variant="warning" size="sm">24h SLA Threshold</Badge>
              </div>
              <p className="text-[11px] text-slate-500 pl-7">
                Unclaimed applications generate automatic Admin tasks if stagnant for over 24 hours.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span className="text-xs font-bold text-rose-950">Underwriting Review (Active Bottleneck)</span>
                </div>
                <Badge variant="error" size="sm">Highest Latency</Badge>
              </div>
              <p className="text-[11px] text-rose-800/80 pl-7">
                Reviews exceeding 24 hours trigger Follow-Up tasks; reviews exceeding 48 hours trigger direct Manager Escalations.
              </p>
            </div>

            {/* Stage 3 */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span className="text-xs font-bold text-slate-900">Decision & Workflow Completion</span>
                </div>
                <Badge variant="success" size="sm">Resolved</Badge>
              </div>
              <p className="text-[11px] text-slate-500 pl-7">
                Full lifecycle audit history recorded upon case closure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume & Conversion Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Volume</div>
          <div className="text-2xl font-bold text-slate-900">{summary.total_applications}</div>
          <div className="text-[11px] text-slate-500">Applications in system</div>
        </Card>

        <Card className="p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completion Rate</div>
          <div className="text-2xl font-bold text-emerald-600">{completionRate}%</div>
          <div className="text-[11px] text-slate-500">{summary.completed_applications} of {summary.total_applications} completed</div>
        </Card>

        <Card className="p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Escalation Ratio</div>
          <div className="text-2xl font-bold text-rose-600">{escalationRate}%</div>
          <div className="text-[11px] text-slate-500">{summary.total_escalations} total manager escalations</div>
        </Card>

        <Card className="p-5 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Backlog</div>
          <div className="text-2xl font-bold text-indigo-600">{summary.open_applications + summary.claimed_applications}</div>
          <div className="text-[11px] text-slate-500">{summary.pending_action} actionable tasks open</div>
        </Card>
      </div>
    </div>
  );
}
