import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  getApplication, 
  getTimeline, 
  claimApplication, 
  completeApplication, 
  getUsers,
  completeTask
} from "../services/api";
import type { Application, ApplicationEvent, User, Task } from "../types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { 
  getApplicationRisk, 
  getApplicationAgeHours, 
  formatDate, 
  formatRelativeTime,
  formatHoursToDaysAndHours
} from "../utils/formatters";
import { 
  ArrowLeft, 
  Clock, 
  UserCheck, 
  CheckCircle2, 
  ShieldAlert, 
  Activity,
  Check,
  Calendar
} from "lucide-react";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const appId = Number(id);

  const [application, setApplication] = useState<Application | null>(null);
  const [timeline, setTimeline] = useState<ApplicationEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Claim modal state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [actionLoading, setActionLoading] = useState(false);

  // Task resolution modal
  const [resolvingTask, setResolvingTask] = useState<Task | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const loadData = async () => {
    if (!appId) return;
    try {
      const [appData, timelineData, usersData] = await Promise.all([
        getApplication(appId),
        getTimeline(appId),
        getUsers()
      ]);
      setApplication(appData);
      setTimeline(timelineData);
      setUsers(usersData);
    } catch (err) {
      console.error("Failed to load application details", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleWorkflowRun = () => loadData();
    window.addEventListener('workflow-run-completed', handleWorkflowRun);
    return () => window.removeEventListener('workflow-run-completed', handleWorkflowRun);
  }, [appId]);

  const handleClaim = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    try {
      await claimApplication(appId, Number(selectedUserId));
      setIsClaimModalOpen(false);
      setSelectedUserId("");
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteApp = async () => {
    setActionLoading(true);
    try {
      await completeApplication(appId);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveTask = async () => {
    if (!resolvingTask) return;
    setActionLoading(true);
    try {
      await completeTask(resolvingTask.id);
      setResolvingTask(null);
      setResolutionNotes("");
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !application) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const risk = getApplicationRisk(application);
  const ageHours = getApplicationAgeHours(application.created_at);
  const openTasks = (application.tasks || []).filter(t => t.status === "OPEN");
  const completedTasks = (application.tasks || []).filter(t => t.status === "COMPLETED");

  const isClaimed = Boolean(application.claimed_by_user_id);
  const hasEscalation = openTasks.some(t => t.task_type === "ESCALATION");
  const hasFollowUp = openTasks.some(t => t.task_type === "FOLLOW_UP");
  const isCompleted = application.status === "COMPLETED";

  const journeySteps = [
    {
      label: "1. Intake Ingested",
      status: "completed" as const,
      timestamp: formatDate(application.created_at),
      desc: "Application received and queued"
    },
    {
      label: "2. Underwriting Assignment",
      status: isClaimed ? ("completed" as const) : ("current" as const),
      timestamp: application.claimed_at ? formatDate(application.claimed_at) : "Awaiting assignment",
      desc: application.claimed_by ? `Claimed by ${application.claimed_by.name}` : "Unclaimed in pool"
    },
    {
      label: "3. Workflow SLA Review",
      status: isCompleted ? ("completed" as const) : isClaimed ? ("current" as const) : ("upcoming" as const),
      timestamp: hasEscalation ? "Escalation SLA Triggered" : hasFollowUp ? "Follow-Up Dispatched" : "Active SLA Monitoring",
      desc: hasEscalation ? "Manager review required" : "Under review within SLA"
    },
    {
      label: "4. Workflow Decision",
      status: isCompleted ? ("completed" as const) : ("upcoming" as const),
      timestamp: application.completed_at ? formatDate(application.completed_at) : "Pending resolution",
      desc: isCompleted ? "Case successfully resolved" : "Final approval & closure"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          to="/applications"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Case Pipeline
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Case ID: #{application.id}</span>
        </div>
      </div>

      {/* Case Workspace Header Banner */}
      <div className="p-6 sm:p-7 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-mono text-2xl font-bold text-slate-900 tracking-tight">
                {application.application_number}
              </h2>
              <Badge variant={risk.badgeVariant} dot pulse={risk.level === "escalated"}>
                {risk.label}
              </Badge>
              <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
                Stage: {application.current_stage || application.current_role || "Intake"}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Created {formatDate(application.created_at)} ({formatRelativeTime(application.created_at)})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Pipeline Aging: <strong className="text-slate-700">{formatHoursToDaysAndHours(ageHours)}</strong>
              </span>
            </p>
          </div>

          {/* Contextual Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {application.status === "OPEN" && !application.claimed_by_user_id && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  const claimable = users.filter((u) => u.role === "Processor" || u.role === "Underwriter");
                  if (claimable.length > 0) setSelectedUserId(claimable[0].id);
                  else if (users.length > 0) setSelectedUserId(users[0].id);
                  setIsClaimModalOpen(true);
                }}
                icon={<UserCheck className="w-4 h-4" />}
              >
                Claim & Assign Case
              </Button>
            )}

            {application.status === "CLAIMED" && (
              <Button
                variant="success"
                size="md"
                onClick={handleCompleteApp}
                loading={actionLoading}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Complete Workflow
              </Button>
            )}

            {application.status === "COMPLETED" && (
              <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Workflow Successfully Completed
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Workflow Journey Visualizer */}
        <div className="pt-5 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Workflow Lifecycle Journey
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
            {journeySteps.map((step, idx) => {
              const isCurr = step.status === "current";
              const isDone = step.status === "completed";

              return (
                <div 
                  key={idx}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isCurr
                      ? hasEscalation 
                        ? "bg-rose-50/60 border-rose-300 ring-2 ring-rose-500/20" 
                        : "bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/20"
                      : isDone
                      ? "bg-slate-50/70 border-slate-200/80"
                      : "bg-white border-dashed border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900">{step.label}</span>
                    {isDone ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-3" />
                      </span>
                    ) : isCurr ? (
                      <span className={`w-2.5 h-2.5 rounded-full animate-ping ${hasEscalation ? "bg-rose-500" : "bg-indigo-600"}`} />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 truncate">{step.timestamp}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{step.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Case Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Work Column: Pending Tasks + Audit Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Tasks & Required Actions */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                  Active Operational Tasks ({openTasks.length})
                </CardTitle>
                <CardDescription>Tasks dispatched by deterministic workflow rules</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {openTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <span className="font-semibold text-slate-700">No Pending Tasks</span>
                  <span>This case has no outstanding follow-ups or escalations.</span>
                </div>
              ) : (
                openTasks.map((task) => (
                  <div 
                    key={task.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      task.task_type === 'ESCALATION'
                        ? 'bg-rose-50/50 border-rose-200'
                        : task.task_type === 'FOLLOW_UP'
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              task.task_type === 'ESCALATION' ? 'error' :
                              task.task_type === 'FOLLOW_UP' ? 'warning' : 'info'
                            }
                            dot
                            pulse={task.task_type === 'ESCALATION'}
                          >
                            {task.task_type}
                          </Badge>
                          <span className="text-xs font-semibold text-slate-900">{task.title}</span>
                        </div>
                        <p className="text-xs text-slate-600">{task.description}</p>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5">
                          <span>Assigned Role: <strong className="text-slate-700">{task.assigned_to_role || 'Admin'}</strong></span>
                          <span>•</span>
                          <span>Created {formatRelativeTime(task.created_at)}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={task.task_type === 'ESCALATION' ? 'danger' : 'primary'}
                        onClick={() => setResolvingTask(task)}
                      >
                        Resolve Task
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Audit Event Timeline */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" />
                  Chronological Workflow Audit Log
                </CardTitle>
                <CardDescription>Verified events recorded as this case progressed through the pipeline</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No events logged yet.</div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timeline.map((event) => {
                    const isClaim = event.event_type === "APPLICATION_CLAIMED";
                    const isTaskEvent = event.event_type.includes("TASK");
                    const isComplete = event.event_type === "APPLICATION_COMPLETED";

                    return (
                      <div key={event.id} className="relative group">
                        <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] ${
                          isComplete 
                            ? 'bg-emerald-600 text-white' 
                            : isTaskEvent
                            ? 'bg-amber-500 text-white'
                            : isClaim
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-600 text-white'
                        }`}>
                          {isComplete ? <Check className="w-2.5 h-2.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {event.event_type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatDate(event.timestamp)} ({formatRelativeTime(event.timestamp)})
                            </span>
                          </div>
                          {event.details && (
                            <p className="text-xs text-slate-600 font-medium leading-relaxed">
                              {event.details}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Details Column */}
        <div className="space-y-6">
          {/* Ownership & Assignment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Assigned Operator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {application.claimed_by ? (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {application.claimed_by.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{application.claimed_by.name}</div>
                    <div className="text-xs text-slate-500 font-medium">{application.claimed_by.role}</div>
                    <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Assigned Owner</div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2">
                  <div className="text-xs font-bold text-amber-900">Case Unclaimed</div>
                  <p className="text-[11px] text-amber-700">
                    This case is unassigned. The rules engine will dispatch an Assignment task if unclaimed for &gt; 24h.
                  </p>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => {
                      const claimable = users.filter((u) => u.role === "Processor" || u.role === "Underwriter");
                      if (claimable.length > 0) setSelectedUserId(claimable[0].id);
                      else if (users.length > 0) setSelectedUserId(users[0].id);
                      setIsClaimModalOpen(true);
                    }}
                    className="w-full"
                  >
                    Assign Now
                  </Button>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Current Workflow Role</span>
                  <span className="font-semibold text-slate-800">{application.current_role || "Underwriting"}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Current Stage</span>
                  <span className="font-semibold text-slate-800">{application.current_stage || "Intake"}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Completed Tasks</span>
                  <span className="font-semibold text-slate-800">{completedTasks.length} resolved</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SLA Performance & Elapsed Time Split (Requirement e) */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-sm">Elapsed Time Split & Bottlenecks</CardTitle>
                <CardDescription>Human work duration vs. wait time between tasks</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Calculated Split Metrics */}
              {(() => {
                const createdTime = new Date(application.created_at).getTime();
                const claimedTime = application.claimed_at ? new Date(application.claimed_at).getTime() : null;
                const endTime = application.completed_at ? new Date(application.completed_at).getTime() : Date.now();
                
                let waitHours = 0;
                let humanHours = 0;

                if (claimedTime) {
                  waitHours = Math.max(0, Number(((claimedTime - createdTime) / (1000 * 3600)).toFixed(1)));
                  humanHours = Math.max(0, Number(((endTime - claimedTime) / (1000 * 3600)).toFixed(1)));
                } else {
                  waitHours = Math.max(0, Number(((endTime - createdTime) / (1000 * 3600)).toFixed(1)));
                  humanHours = 0;
                }

                const totalCalcHours = Number((waitHours + humanHours).toFixed(1));
                const waitPct = totalCalcHours > 0 ? Math.round((waitHours / totalCalcHours) * 100) : 0;
                const humanPct = 100 - waitPct;

                return (
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Overall Elapsed Time</span>
                        <span className="font-mono font-bold text-slate-900">{formatHoursToDaysAndHours(totalCalcHours)}</span>
                      </div>

                      {/* Visual Ratio Bar */}
                      <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                        <div 
                          style={{ width: `${humanPct}%` }}
                          className="bg-indigo-600 h-full transition-all"
                          title={`Time spent by human: ${formatHoursToDaysAndHours(humanHours)} (${humanPct}%)`}
                        />
                        <div 
                          style={{ width: `${waitPct}%` }}
                          className="bg-amber-500 h-full transition-all"
                          title={`Wait time between tasks: ${formatHoursToDaysAndHours(waitHours)} (${waitPct}%)`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-indigo-700 font-medium">
                          Human Work: <strong>{formatHoursToDaysAndHours(humanHours)}</strong> ({humanPct}%)
                        </span>
                        <span className="text-amber-800 font-medium">
                          Wait Time: <strong>{formatHoursToDaysAndHours(waitHours)}</strong> ({waitPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
                      {waitPct > 50 ? (
                        <span>
                          <strong className="text-amber-900">Wait Time Dominant:</strong> This case spent {waitPct}% of its lifecycle waiting in queue before handover, identifying an intake/handover bottleneck.
                        </span>
                      ) : (
                        <span>
                          <strong className="text-indigo-900">Active Review Dominant:</strong> Human processing accounts for {humanPct}% of overall elapsed time.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span>Unclaimed SLA Threshold</span>
                  <span className="font-semibold text-slate-800">24 Hours (Admin Task)</span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span>Follow-Up SLA Threshold</span>
                  <span className="font-semibold text-slate-800">24 Hours (Claimed User)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Escalation SLA Threshold</span>
                  <span className="font-semibold text-rose-600">48 Hours (Manager Alert)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Claim Application Modal */}
      <Modal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title="Assign Case to Underwriter"
        description={`Assign application ${application.application_number} to begin review.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsClaimModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleClaim}
              loading={actionLoading}
            >
              Confirm Assignment
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Operator
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full text-sm bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              {users
                .filter((u) => u.role === "Processor" || u.role === "Underwriter")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Task Resolution Modal */}
      <Modal
        isOpen={!!resolvingTask}
        onClose={() => setResolvingTask(null)}
        title="Resolve Operational Task"
        description={`Complete ${resolvingTask?.task_type} task for application ${application.application_number}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResolvingTask(null)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleResolveTask}
              loading={actionLoading}
            >
              Mark Task Resolved
            </Button>
          </>
        }
      >
        {resolvingTask && (
          <div className="space-y-4 py-2">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
              <div className="font-bold text-slate-900">{resolvingTask.title}</div>
              <p className="text-slate-600">{resolvingTask.description}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Resolution Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Detail the action taken to clear this task or escalation..."
                className="w-full text-xs border border-slate-300 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
