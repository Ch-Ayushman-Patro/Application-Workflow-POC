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
import { Clock } from "lucide-react";

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Understand how long cases take, and where the delays are happening.
        </p>
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
            {waitingPercentage}% of the time, cases are just{""}
            <span className="text-amber-400">sitting and waiting</span>
          </h3>
          <p className="text-sm text-slate-300">
            Only {processingPercentage}% of the total lifecycle involves actual human work. The rest is idle time in queues.
            The biggest bottleneck is the <strong className="text-white">{summary.bottleneck_stage}</strong> stage.
          </p>
        </div>
        <div className="shrink-0 grid grid-cols-2 gap-3 text-center">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-indigo-300">{processingHours}h</div>
            <div className="text-xs text-slate-400 mt-1">Avg. work time</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-400">{waitingHours}h</div>
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
                  formatter={(value) => [`${value} hours`, "Duration"]}
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
              <span>Human work: <strong>{processingHours}h</strong> ({processingPercentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span>Waiting idle: <strong>{waitingHours}h</strong> ({waitingPercentage}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
