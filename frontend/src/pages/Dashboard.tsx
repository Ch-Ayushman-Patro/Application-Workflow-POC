import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  getApplications, 
  getTasks, 
  getAnalyticsSummary 
} from "../services/api";
import type { Application, Task, AnalyticsSummary } from "../types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { WorkflowRunModal } from "../components/WorkflowRunModal";
import { 
  getApplicationRisk, 
  getApplicationAgeHours 
} from "../utils/formatters";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Play, 
  ArrowUpRight, 
  UserCheck, 
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  ArrowRight
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

    // Listen to global workflow run events
    const handleWorkflowRun = () => loadData();
    window.addEventListener('workflow-run-completed', handleWorkflowRun);
    return () => window.removeEventListener('workflow-run-completed', handleWorkflowRun);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Segment applications by risk and stage
  const openTasks = tasks.filter(t => t.status === "OPEN");
  const escalationTasks = openTasks.filter(t => t.task_type === "ESCALATION");
  const followUpTasks = openTasks.filter(t => t.task_type === "FOLLOW_UP");
  const assignmentTasks = openTasks.filter(t => t.task_type === "ASSIGNMENT");

  // Filter urgent applications needing attention right now
  const urgentApplications = applications
    .filter(app => app.status !== "COMPLETED")
    .map(app => ({
      app,
      risk: getApplicationRisk(app),
      ageHours: getApplicationAgeHours(app.created_at)
    }))
    .filter(item => item.risk.level === "escalated" || item.risk.level === "at_risk" || item.risk.level === "attention")
    .sort((a, b) => {
      // Prioritize escalated > at_risk > attention
      const order = { escalated: 3, at_risk: 2, attention: 1, normal: 0, completed: -1 };
      return order[b.risk.level] - order[a.risk.level];
    });

  // Pipeline stage breakdown
  const unclaimedApps = applications.filter(a => a.status === "OPEN" && !a.claimed_by_user_id);
  const inReviewApps = applications.filter(a => a.status === "CLAIMED");
  const completedApps = applications.filter(a => a.status === "COMPLETED");

  const processingHours = summary ? Number(summary.avg_processing_time_hours.toFixed(1)) : 0;
  const waitingHours = summary ? Number(summary.avg_waiting_time_hours.toFixed(1)) : 0;
  const totalTime = processingHours + waitingHours;
  const waitingPercent = totalTime > 0 ? Math.round((waitingHours / totalTime) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Top Operational Command Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              Live Pipeline Pulse
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {urgentApplications.length > 0 ? (
                <span>
                  <span className="text-rose-400">{urgentApplications.length} cases</span> require operational intervention
                </span>
              ) : (
                "All pipeline cases are within SLA thresholds"
              )}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Monitoring <strong>{applications.length} total applications</strong> across Underwriting and Operations. 
              {escalationTasks.length > 0 && (
                <span className="text-rose-300 font-medium"> {escalationTasks.length} critical manager escalations active.</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsRunModalOpen(true)}
              className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30"
              icon={<Play className="w-4 h-4 fill-current" />}
            >
              Run Orchestration Engine
            </Button>
            <Link to="/tasks">
              <Button variant="outline" size="lg" className="bg-slate-900/60 border-slate-700 text-black hover:bg-slate-800 hover:text-white">
                View Task Queue ({openTasks.length})
              </Button>
            </Link>
          </div>
        </div>

        {/* Pipeline Stage Funnel Strip */}
        <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>1. Unclaimed Intake</span>
              <Layers className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">{unclaimedApps.length}</div>
            <div className="text-[11px] text-amber-400 mt-0.5">
              {unclaimedApps.filter(a => getApplicationAgeHours(a.created_at) > 24).length} aging &gt; 24h
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>2. Active Review</span>
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">{inReviewApps.length}</div>
            <div className="text-[11px] text-indigo-300 mt-0.5">Claimed by Underwriters</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>3. At-Risk / Escalated</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{urgentApplications.length}</div>
            <div className="text-[11px] text-rose-300 mt-0.5">{escalationTasks.length} manager alerts</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>4. Successfully Completed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{completedApps.length}</div>
            <div className="text-[11px] text-emerald-300/80 mt-0.5">
              {applications.length > 0 ? Math.round((completedApps.length / applications.length) * 100) : 0}% completion rate
            </div>
          </div>
        </div>
      </div>

      {/* Primary Grid: Urgent Attention Cases + Task Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Urgent Attention Case Radar (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                Urgent Attention Radar
              </h3>
              <p className="text-xs text-slate-500">Cases requiring prompt action to prevent or resolve workflow SLA breaches</p>
            </div>
            <Link to="/applications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              View All Cases <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {urgentApplications.length === 0 ? (
            <Card className="p-8 text-center bg-white border-dashed">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">No Critical Bottlenecks</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                All active applications are moving smoothly through the pipeline without overdue escalation triggers.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {urgentApplications.slice(0, 5).map(({ app, risk, ageHours }) => (
                <div 
                  key={app.id} 
                  className={`p-4 rounded-2xl border transition-all duration-200 bg-white hover:shadow-md ${
                    risk.level === 'escalated' 
                      ? 'border-rose-300/80 bg-rose-50/20' 
                      : risk.level === 'at_risk' 
                      ? 'border-amber-300/80 bg-amber-50/20' 
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {app.application_number}
                        </span>
                        <Badge variant={risk.badgeVariant} dot pulse={risk.level === 'escalated'}>
                          {risk.label}
                        </Badge>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Age: {ageHours} hrs
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        {risk.reason}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>Current Stage: <strong className="text-slate-700">{app.current_role || 'Unassigned'}</strong></span>
                        <span>•</span>
                        <span>Assignee: <strong className="text-slate-700">{app.claimed_by?.name || 'Unclaimed'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/applications/${app.id}`}>
                        <Button variant="outline" size="sm" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                          Open Case
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick SLA Rule Logic Summary Card */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-900">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-indigo-950">Orchestration Automation Policies</h5>
              <p className="text-indigo-800/80 mt-0.5 leading-relaxed">
                Rules engine scans applications automatically: unclaimed cases &gt; 24h alert Admins; claimed reviews &gt; 24h dispatch Follow-Ups; cases &gt; 48h escalate to Department Managers.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Process Bottleneck & Task Breakdown */}
        <div className="space-y-6">
          {/* Bottleneck Spotlight Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-sm">Workflow Bottleneck Analysis</CardTitle>
                <CardDescription>Human work time vs. queue waiting time</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical Bottleneck Stage</div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-rose-600">
                    {summary?.bottleneck_stage || "Underwriting"}
                  </div>
                  <Badge variant="error">Highest Lag</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Applications experience the longest idle waiting time before or during this stage.
                </p>
              </div>

              {/* Waiting vs Processing Ratio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Pipeline Time Distribution</span>
                  <span className="font-bold text-amber-700">{waitingPercent}% Waiting Time</span>
                </div>
                {/* Visual Ratio Bar */}
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div 
                    style={{ width: `${100 - waitingPercent}%` }} 
                    className="bg-indigo-600 h-full transition-all"
                    title={`Active Processing: ${processingHours}h`}
                  />
                  <div 
                    style={{ width: `${waitingPercent}%` }} 
                    className="bg-amber-500 h-full transition-all"
                    title={`Waiting Time: ${waitingHours}h`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    Active Processing ({processingHours}h)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Waiting Idle ({waitingHours}h)
                  </span>
                </div>
              </div>

              <Link to="/analytics" className="block pt-2">
                <Button variant="ghost" size="sm" className="w-full text-indigo-600 justify-between">
                  <span>Explore Process Intelligence</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Operational Task Breakdown Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-sm">Actionable Task Queues</CardTitle>
                <CardDescription>{openTasks.length} pending items requiring action</CardDescription>
              </div>
              <Link to="/tasks">
                <span className="text-xs font-semibold text-indigo-600 hover:underline">View</span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-200/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                  <div>
                    <div className="text-xs font-bold text-rose-900">Escalation Tasks</div>
                    <div className="text-[11px] text-rose-700">Immediate manager intervention</div>
                  </div>
                </div>
                <span className="text-base font-bold text-rose-700">{escalationTasks.length}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <div>
                    <div className="text-xs font-bold text-amber-900">Follow-Up Tasks</div>
                    <div className="text-[11px] text-amber-700">Review time exceeds SLA</div>
                  </div>
                </div>
                <span className="text-base font-bold text-amber-700">{followUpTasks.length}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div>
                    <div className="text-xs font-bold text-blue-900">Assignment Tasks</div>
                    <div className="text-[11px] text-blue-700">Unclaimed applications</div>
                  </div>
                </div>
                <span className="text-base font-bold text-blue-700">{assignmentTasks.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Workflow Run Modal */}
      <WorkflowRunModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
