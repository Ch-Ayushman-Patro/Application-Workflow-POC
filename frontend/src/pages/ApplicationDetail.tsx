import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  useApplication, 
  useTimeline, 
  useUsers, 
  useClaimApplication, 
  useCompleteApplication, 
  useCompleteTask 
} from "../hooks/useWorkflowQueries";
import type { Task } from "../types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { 
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
  Calendar,
  AlertTriangle,
  ArrowRight,
  Info
} from "lucide-react";
import { useRole } from "../context/RoleContext";

export default function ApplicationDetail() {
  const { currentUser, currentRole, allUsers } = useRole();
  const { id } = useParams<{ id: string }>();
  const appId = Number(id);

  // Cached server-state queries
  const { data: application, isLoading: loadingApp } = useApplication(appId);
  const { data: timeline = [] } = useTimeline(appId);
  const { data: users = [], isLoading: loadingUsers } = useUsers();

  // Targeted mutations
  const claimMutation = useClaimApplication();
  const completeAppMutation = useCompleteApplication();
  const completeTaskMutation = useCompleteTask();

  // Claim modal state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");

  // Task resolution modal
  const [resolvingTask, setResolvingTask] = useState<Task | null>(null);

  const actionLoading = claimMutation.isPending || completeAppMutation.isPending || completeTaskMutation.isPending;
  const loading = (loadingApp && !application) || (loadingUsers && users.length === 0);

  const handleClaim = async () => {
    if (!selectedUserId) return;
    try {
      await claimMutation.mutateAsync({ id: appId, userId: Number(selectedUserId) });
      setIsClaimModalOpen(false);
      setSelectedUserId("");
    } catch (err) {
      console.error("Failed to claim application", err);
    }
  };

  const handleCompleteApp = async () => {
    try {
      await completeAppMutation.mutateAsync(appId);
    } catch (err) {
      console.error("Failed to complete application", err);
    }
  };

  const handleResolveTask = async () => {
    if (!resolvingTask) return;
    try {
      await completeTaskMutation.mutateAsync(resolvingTask.id);
      setResolvingTask(null);
    } catch (err) {
      console.error("Failed to resolve task", err);
    }
  };

  if (loading || !application) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const ageHours = getApplicationAgeHours(application.created_at);
  const openTasks = (application.tasks || []).filter(t => t.status === "OPEN");
  const completedTasks = (application.tasks || []).filter(t => t.status === "COMPLETED");

  const escalationTask = openTasks.find(t => t.task_type === "ESCALATION");
  const followUpTask = openTasks.find(t => t.task_type === "FOLLOW_UP");

  const isCompleted = application.status === "COMPLETED";
  const isEscalated = Boolean(escalationTask);
  const isOverdue = Boolean(followUpTask);
  const isClaimed = Boolean(application.claimed_by_user_id);
  const isUnassigned = application.status === "OPEN" && !application.claimed_by_user_id;

  // ── Calculated Durations & SLAs ──────────────────────────────────────────
  const now = Date.now();
  const createdTime = new Date(application.created_at).getTime();
  const claimedTime = application.claimed_at ? new Date(application.claimed_at).getTime() : null;
  const completedTime = application.completed_at ? new Date(application.completed_at).getTime() : null;

  // Intake waiting time (from creation to claim or now)
  const intakeWaitHours = claimedTime 
    ? Math.max(0, Number(((claimedTime - createdTime) / (1000 * 3600)).toFixed(1)))
    : Math.max(0, Number(((now - createdTime) / (1000 * 3600)).toFixed(1)));

  // Review time (from claim to complete or now)
  const reviewDurationHours = claimedTime
    ? (completedTime 
        ? Math.max(0, Number(((completedTime - claimedTime) / (1000 * 3600)).toFixed(1)))
        : Math.max(0, Number(((now - claimedTime) / (1000 * 3600)).toFixed(1))))
    : 0;

  // ── Determine Current Concrete Case State ────────────────────────────────
  type CaseStateKey = "UNASSIGNED" | "IN_REVIEW" | "OVERDUE" | "ESCALATED" | "COMPLETED";

  const currentCaseState: CaseStateKey = isCompleted
    ? "COMPLETED"
    : isEscalated
    ? "ESCALATED"
    : isOverdue
    ? "OVERDUE"
    : isClaimed
    ? "IN_REVIEW"
    : "UNASSIGNED";

  // ── User Awareness & Action Permissions ──────────────────────────────────
  const isAdmin = currentRole === "Admin";
  const isAssignedOfficer = application.claimed_by_user_id === currentUser.id;
  const isEscalationRecipient = escalationTask?.assigned_to_user_id === currentUser.id;

  // Lookup assigned officer's manager
  const assignedOfficerUser = allUsers.find(u => u.id === application.claimed_by_user_id);
  const officerManager = assignedOfficerUser?.manager_user_id 
    ? allUsers.find(u => u.id === assignedOfficerUser.manager_user_id) 
    : undefined;

  // Lookup escalation recipient user (if escalation task exists)
  const escalationRecipientUser = escalationTask?.assigned_to_user_id
    ? allUsers.find(u => u.id === escalationTask.assigned_to_user_id)
    : officerManager || allUsers.find(u => u.role === "Manager");

  // Can the current user complete the case?
  // Only the assigned Underwriter or an Administrator can complete a case
  const canCompleteCase = isClaimed && !isCompleted && (isAssignedOfficer || isAdmin);

  // Can current user assign the case?
  // Business rule: Unassigned cases require Admin assignment
  const canAssignCase = isUnassigned && isAdmin;

  // ── Compact Journey Stepper Model ────────────────────────────────────────
  // Steps: Intake Ingested -> Underwriter Assignment -> Underwriting Review -> Case Decision
  const journeyMilestones = [
    {
      id: "intake",
      label: "1. Intake Ingested",
      status: "completed" as const,
      timestamp: formatDate(application.created_at),
      detail: "Application received and registered",
    },
    {
      id: "assignment",
      label: "2. Underwriter Assignment",
      status: isUnassigned ? ("current" as const) : ("completed" as const),
      timestamp: isClaimed ? formatDate(application.claimed_at) : `${formatHoursToDaysAndHours(intakeWaitHours)} in pool`,
      detail: isClaimed ? `Assigned to ${application.claimed_by?.name}` : "Pending Admin assignment",
    },
    {
      id: "review",
      label: "3. Underwriting Review",
      status: isCompleted 
        ? ("completed" as const) 
        : isClaimed 
        ? ("current" as const) 
        : ("upcoming" as const),
      timestamp: isCompleted 
        ? `${formatHoursToDaysAndHours(reviewDurationHours)} review time` 
        : isClaimed 
        ? `${formatHoursToDaysAndHours(reviewDurationHours)} in review`
        : "Awaiting assignment",
      detail: isCompleted 
        ? "Review finalized" 
        : isEscalated 
        ? "Escalated to Manager" 
        : isOverdue 
        ? "Follow-up required (>24h)" 
        : isClaimed 
        ? "Active review within SLA" 
        : "Starts once assigned",
    },
    {
      id: "decision",
      label: "4. Case Decision",
      status: isCompleted ? ("current" as const) : ("upcoming" as const),
      timestamp: isCompleted ? formatDate(application.completed_at) : "Pending resolution",
      detail: isCompleted ? "Case successfully closed" : "Final approval & closure",
    },
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

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Viewing as:</span>
          <span className="font-semibold text-slate-700">{currentUser.name}</span>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            {currentRole}
          </span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* 1. STATE-DRIVEN CONTEXTUAL ACTION BANNER                                       */}
      {/* Answers: Current State, Why, Who Owns, What Action Now, SLA, What Happens Next */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-xs transition-all ${
        currentCaseState === "ESCALATED"
          ? "bg-linear-to-br from-rose-50/90 via-white to-rose-50/40 border-rose-200"
          : currentCaseState === "OVERDUE"
          ? "bg-linear-to-br from-amber-50/90 via-white to-amber-50/40 border-amber-200"
          : currentCaseState === "UNASSIGNED"
          ? "bg-linear-to-br from-orange-50/90 via-white to-orange-50/40 border-orange-200"
          : currentCaseState === "COMPLETED"
          ? "bg-linear-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200"
          : "bg-linear-to-br from-indigo-50/90 via-white to-indigo-50/40 border-indigo-200"
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left Column: Context & State Diagnosis */}
          <div className="space-y-4 max-w-3xl">
            {/* Case Header & State Badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {application.application_number}
              </h1>

              {/* Explicit Current State Badge */}
              {currentCaseState === "UNASSIGNED" && (
                <Badge variant="orange" size="md" dot>
                  Needs Assignment
                </Badge>
              )}
              {currentCaseState === "IN_REVIEW" && (
                <Badge variant="info" size="md" dot>
                  Underwriting Review
                </Badge>
              )}
              {currentCaseState === "OVERDUE" && (
                <Badge variant="warning" size="md" dot pulse>
                  Review SLA Overdue (&gt;24h)
                </Badge>
              )}
              {currentCaseState === "ESCALATED" && (
                <Badge variant="error" size="md" dot pulse>
                  Manager Escalation Active (&gt;48h)
                </Badge>
              )}
              {currentCaseState === "COMPLETED" && (
                <Badge variant="success" size="md" dot>
                  Case Resolved & Closed
                </Badge>
              )}

              <span className="text-xs text-slate-500 font-medium bg-white/80 border border-slate-200 px-2.5 py-1 rounded-full">
                Stage: {application.current_stage || "Intake"}
              </span>
            </div>

            {/* Narrative State Explanation: Why it is in this state & What happens next */}
            <div className="space-y-2">
              {/* UNASSIGNED STATE */}
              {currentCaseState === "UNASSIGNED" && (
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-orange-950 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                    Application is waiting in the intake pool for underwriter assignment.
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Why:</strong> Submitted {formatRelativeTime(application.created_at)} and has been unassigned for <strong>{formatHoursToDaysAndHours(intakeWaitHours)}</strong>. 
                    {intakeWaitHours > 24 
                      ? " It has exceeded the 24-hour intake SLA threshold, generating an Admin assignment task."
                      : " It is currently within the 24-hour intake window."}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span><strong>What happens next:</strong> Once an Administrator assigns an Underwriter, the 24-hour Underwriting Review SLA begins immediately.</span>
                  </p>
                </div>
              )}

              {/* IN REVIEW (HEALTHY) STATE */}
              {currentCaseState === "IN_REVIEW" && (
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-indigo-950 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600 shrink-0" />
                    Underwriting Review in progress within normal SLA.
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Why:</strong> Claimed by <strong>{application.claimed_by?.name}</strong> {formatRelativeTime(application.claimed_at)}. 
                    Active review duration is <strong>{formatHoursToDaysAndHours(reviewDurationHours)}</strong> of the 24-hour target threshold.
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span><strong>What happens next:</strong> The Underwriter verifies documents and completes review. If unresolved after 24h, an SLA follow-up task is dispatched.</span>
                  </p>
                </div>
              )}

              {/* OVERDUE STATE */}
              {currentCaseState === "OVERDUE" && (
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    Underwriting Review has breached the 24-hour target SLA.
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Why:</strong> Case was claimed by <strong>{application.claimed_by?.name}</strong> on {formatDate(application.claimed_at)} ({formatHoursToDaysAndHours(reviewDurationHours)} ago). 
                    A <strong>FOLLOW_UP</strong> task was dispatched to prompt review progression.
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span><strong>What happens next:</strong> If the review is not completed or resolved before <strong>48 hours</strong>, the case will automatically escalate to Manager <strong>{officerManager?.name || "Diana Manager"}</strong>.</span>
                  </p>
                </div>
              )}

              {/* ESCALATED STATE */}
              {currentCaseState === "ESCALATED" && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-rose-950 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
                    Critical SLA Breach: Case escalated to Management.
                  </div>
                  <div className="p-3 bg-white/80 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span><strong>Case Owner:</strong> {application.claimed_by?.name || "Underwriter"}</span>
                      <span>•</span>
                      <span><strong>Escalation Recipient:</strong> {escalationRecipientUser?.name || "Manager"} (Manager)</span>
                      <span>•</span>
                      <span><strong>Threshold:</strong> 48 Hours SLA</span>
                    </div>
                    <p className="text-rose-700 pt-0.5">
                      <strong>Reason:</strong> Active review reached <strong>{formatHoursToDaysAndHours(reviewDurationHours)}</strong>, exceeding the mandatory 48-hour maximum resolution limit. Manager intervention is required.
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span><strong>What happens next:</strong> The Manager reviews the bottleneck, resolves the escalation task, or directs final case completion.</span>
                  </p>
                </div>
              )}

              {/* COMPLETED STATE */}
              {currentCaseState === "COMPLETED" && (
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-emerald-950 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Workflow successfully finalized and archived.
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Completed:</strong> {formatDate(application.completed_at)} ({formatRelativeTime(application.completed_at)}) by <strong>{application.claimed_by?.name || "Underwriter"}</strong>. 
                    Total lifecycle turnaround was <strong>{formatHoursToDaysAndHours(ageHours)}</strong> (active review took {formatHoursToDaysAndHours(reviewDurationHours)}).
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><strong>Status:</strong> Case is closed. No further operational actions are pending.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Time & SLA Metadata Strip */}
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200/60 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Submitted: <strong className="text-slate-700">{formatDate(application.created_at)}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Lifecycle Duration: <strong className="text-slate-700">{formatHoursToDaysAndHours(ageHours)}</strong>
              </span>
              {isClaimed && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                    In Review: <strong className="text-slate-700">{formatHoursToDaysAndHours(reviewDurationHours)}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Prominent Contextual Action Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 shrink-0 lg:w-72 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Required Action
              </div>

              {/* UNASSIGNED CASE ACTIONS */}
              {isUnassigned && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800">
                    Assign Underwriter
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {canAssignCase 
                      ? "Select an internal underwriter to take ownership of this file."
                      : "This case is awaiting assignment by an Administrator."}
                  </p>
                </div>
              )}

              {/* IN REVIEW & OVERDUE ACTIONS */}
              {(currentCaseState === "IN_REVIEW" || currentCaseState === "OVERDUE") && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800">
                    Complete Case Review
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {canCompleteCase
                      ? "Finalize decision and mark the case as resolved."
                      : `Under review by ${application.claimed_by?.name}. Only the assigned underwriter or Admin can complete this case.`}
                  </p>
                </div>
              )}

              {/* ESCALATED ACTIONS */}
              {currentCaseState === "ESCALATED" && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-rose-900">
                    Manager Intervention
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isEscalationRecipient || isAdmin
                      ? "Review the delay and resolve the open manager escalation task."
                      : `Assigned to Manager ${escalationRecipientUser?.name || "Diana Manager"} for resolution.`}
                  </p>
                </div>
              )}

              {/* COMPLETED STATUS */}
              {isCompleted && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Case Fully Resolved
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Decision logged on {formatDate(application.completed_at)}.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons (User-Aware) */}
            <div className="pt-2">
              {/* Admin Assignment Trigger */}
              {isUnassigned && canAssignCase && (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    const claimable = users.filter((u) => u.role === "Underwriter");
                    if (claimable.length > 0) {
                      setSelectedUserId(claimable[0].id);
                    } else if (users.length > 0) {
                      setSelectedUserId(users[0].id);
                    }
                    setIsClaimModalOpen(true);
                  }}
                  icon={<UserCheck className="w-4 h-4" />}
                >
                  Assign Case
                </Button>
              )}

              {isUnassigned && !canAssignCase && (
                <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center font-medium">
                  Requires Admin Role
                </div>
              )}

              {/* Complete Case Trigger */}
              {(currentCaseState === "IN_REVIEW" || currentCaseState === "OVERDUE") && canCompleteCase && (
                <Button
                  variant="success"
                  size="md"
                  className="w-full"
                  onClick={handleCompleteApp}
                  loading={actionLoading}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Complete Case
                </Button>
              )}

              {(currentCaseState === "IN_REVIEW" || currentCaseState === "OVERDUE") && !canCompleteCase && (
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  Owned by {application.claimed_by?.name}
                </div>
              )}

              {/* Escalated Action Trigger */}
              {currentCaseState === "ESCALATED" && (
                <div>
                  {escalationTask && (isEscalationRecipient || isAdmin) ? (
                    <Button
                      variant="danger"
                      size="md"
                      className="w-full"
                      onClick={() => setResolvingTask(escalationTask)}
                    >
                      Resolve Escalation
                    </Button>
                  ) : canCompleteCase ? (
                    <Button
                      variant="success"
                      size="md"
                      className="w-full"
                      onClick={handleCompleteApp}
                      loading={actionLoading}
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Complete Case
                    </Button>
                  ) : (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center font-medium">
                      Assigned to {escalationRecipientUser?.name || "Manager"}
                    </div>
                  )}
                </div>
              )}

              {/* Completed Notice */}
              {isCompleted && (
                <div className="text-[11px] text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 text-center font-semibold">
                  Archived
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* 2. COMPACT MILESTONE JOURNEY (Completed -> Current -> Next)                     */}
      {/* Current state is visually dominant; future stages are muted and secondary       */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Case Lifecycle Milestones
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Active Milestone: <strong className="text-slate-800">
              {journeyMilestones.find(m => m.status === "current")?.label || "Complete"}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          {journeyMilestones.map((step) => {
            const isCurr = step.status === "current";
            const isDone = step.status === "completed";

            return (
              <div 
                key={step.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCurr
                    ? isEscalated
                      ? "bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs"
                      : isOverdue
                      ? "bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs"
                      : isUnassigned
                      ? "bg-orange-50 border-orange-300 ring-2 ring-orange-500/20 shadow-xs"
                      : isCompleted
                      ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs"
                      : "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                    : isDone
                    ? "bg-slate-50 border-slate-200 text-slate-600"
                    : "bg-white border-dashed border-slate-200 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isCurr ? "text-slate-950" : isDone ? "text-slate-700" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                  {isDone ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-3" />
                    </span>
                  ) : isCurr ? (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-white text-slate-800 border border-slate-300 shadow-2xs shrink-0">
                      Current
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      Next
                    </span>
                  )}
                </div>
                <div className={`text-[11px] font-medium truncate ${isCurr ? "text-slate-800" : "text-slate-500"}`}>
                  {step.timestamp}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate leading-tight">
                  {step.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* 3. TWO-COLUMN WORKSPACE: Operational Tasks & Context                           */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Active Tasks + Chronological Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Operational Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-indigo-600" />
                    Active Operational Tasks ({openTasks.length})
                  </CardTitle>
                  <CardDescription>Action items dispatched by automated workflow SLA rules</CardDescription>
                </div>
                {openTasks.length > 0 && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Action Pending
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {openTasks.length === 0 ? (
                <div className="py-6 px-4 text-center rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-center justify-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-800">No Pending SLA Tasks</div>
                    <div className="text-[11px] text-slate-500">
                      {isCompleted 
                        ? "Case workflow has been completed successfully." 
                        : "Application is progressing normally within SLA thresholds."}
                    </div>
                  </div>
                </div>
              ) : (
                openTasks.map((task) => {
                  const isTaskEscalation = task.task_type === "ESCALATION";
                  const isTaskFollowUp = task.task_type === "FOLLOW_UP";
                  
                  // Can current user resolve this task?
                  const canResolveThisTask = 
                    isAdmin || 
                    task.assigned_to_user_id === currentUser.id ||
                    (isTaskFollowUp && isAssignedOfficer);

                  return (
                    <div 
                      key={task.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isTaskEscalation
                          ? "bg-rose-50/60 border-rose-200 shadow-2xs"
                          : isTaskFollowUp
                          ? "bg-amber-50/60 border-amber-200 shadow-2xs"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant={isTaskEscalation ? "error" : isTaskFollowUp ? "warning" : "info"}
                              dot
                              pulse={isTaskEscalation}
                            >
                              {task.task_type}
                            </Badge>
                            <span className="text-xs font-bold text-slate-900">{task.title}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5 flex-wrap">
                            <span>Assigned To: <strong className="text-slate-800">{task.assigned_to?.name || task.assigned_to_role || "Admin"}</strong></span>
                            <span>•</span>
                            <span>Raised {formatRelativeTime(task.created_at)}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {canResolveThisTask ? (
                            <Button
                              size="sm"
                              variant={isTaskEscalation ? "danger" : "primary"}
                              onClick={() => setResolvingTask(task)}
                            >
                              Resolve Task
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                              Assigned to {task.assigned_to?.name || task.assigned_to_role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Chronological Workflow Audit Log */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-slate-500" />
                  Chronological Workflow Audit Log
                </CardTitle>
                <CardDescription>Complete historical audit trail of events recorded as this case progressed</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No events logged yet.</div>
              ) : (
                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timeline.map((event) => {
                    const isClaim = event.event_type === "APPLICATION_CLAIMED";
                    const isTaskEvent = event.event_type.includes("TASK");
                    const isComplete = event.event_type === "APPLICATION_COMPLETED";

                    return (
                      <div key={event.id} className="relative group">
                        <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] ${
                          isComplete 
                            ? "bg-emerald-600 text-white" 
                            : isTaskEvent
                            ? "bg-amber-500 text-white"
                            : isClaim
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-600 text-white"
                        }`}>
                          {isComplete ? <Check className="w-2.5 h-2.5 stroke-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {event.event_type.replace(/_/g, " ")}
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

        {/* RIGHT COLUMN: Ownership, Assignment & SLA Metrics */}
        <div className="space-y-6">
          {/* Ownership & Assignment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ownership & Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {application.claimed_by ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {application.claimed_by.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{application.claimed_by.name}</div>
                      <div className="text-xs text-slate-500 font-medium">{application.claimed_by.role}</div>
                      <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Primary Case Owner</div>
                    </div>
                  </div>

                  {/* Reporting Manager (via hierarchy) */}
                  {officerManager && (
                    <div className="pt-2.5 border-t border-slate-200/70 text-xs flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Reports To:</span>
                      <span className="font-semibold text-slate-800">{officerManager.name} ({officerManager.role})</span>
                    </div>
                  )}

                  {/* Escalation target if applicable */}
                  {isEscalated && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-rose-900 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Escalated To Manager
                      </div>
                      <div className="text-rose-700 text-[11px]">
                        {escalationRecipientUser?.name || "Diana Manager"} is reviewing this case.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-center space-y-2">
                  <div className="text-xs font-bold text-orange-950">Unassigned in Intake Queue</div>
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    This loan application has not been claimed yet. {intakeWaitHours > 24 ? "It has exceeded the 24h intake SLA." : "Waiting for assignment."}
                  </p>
                  {canAssignCase && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => {
                        const claimable = users.filter((u) => u.role === "Underwriter");
                        if (claimable.length > 0) {
                          setSelectedUserId(claimable[0].id);
                        } else if (users.length > 0) {
                          setSelectedUserId(users[0].id);
                        }
                        setIsClaimModalOpen(true);
                      }}
                      className="w-full"
                    >
                      Assign Case Now
                    </Button>
                  )}
                </div>
              )}

              {/* Case Stage & Role Properties */}
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Current Workflow Role</span>
                  <span className="font-semibold text-slate-800">{application.current_role || "Underwriter"}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Workflow Stage</span>
                  <span className="font-semibold text-slate-800">{application.current_stage || "Intake"}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Resolved Tasks</span>
                  <span className="font-semibold text-slate-800">{completedTasks.length} tasks</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SLA Performance & Active Work vs Waiting Latency */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-sm">SLA Timing & Time Split</CardTitle>
                <CardDescription>Touch review time vs. queue latency</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Calculated Split Metrics */}
              {(() => {
                const totalCalcHours = Number((intakeWaitHours + reviewDurationHours).toFixed(1));
                const waitPct = totalCalcHours > 0 ? Math.round((intakeWaitHours / totalCalcHours) * 100) : 0;
                const humanPct = 100 - waitPct;

                return (
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Total Lifecycle Elapsed</span>
                        <span className="font-mono font-bold text-slate-900">{formatHoursToDaysAndHours(totalCalcHours)}</span>
                      </div>

                      {/* Visual Ratio Bar */}
                      <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                        <div 
                          style={{ width: `${humanPct}%` }}
                          className="bg-indigo-600 h-full transition-all"
                          title={`Time in Underwriting Review: ${formatHoursToDaysAndHours(reviewDurationHours)} (${humanPct}%)`}
                        />
                        <div 
                          style={{ width: `${waitPct}%` }}
                          className="bg-amber-500 h-full transition-all"
                          title={`Time in Intake Queue: ${formatHoursToDaysAndHours(intakeWaitHours)} (${waitPct}%)`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-indigo-700 font-medium">
                          Active Review: <strong>{formatHoursToDaysAndHours(reviewDurationHours)}</strong> ({humanPct}%)
                        </span>
                        <span className="text-amber-800 font-medium">
                          Queue Wait: <strong>{formatHoursToDaysAndHours(intakeWaitHours)}</strong> ({waitPct}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Explicit Deterministic SLA Thresholds */}
              <div className="space-y-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Intake Assignment SLA</span>
                  <span className={`font-semibold ${intakeWaitHours > 24 ? "text-amber-700" : "text-slate-800"}`}>
                    24 Hours {intakeWaitHours > 24 ? "(Breached)" : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Underwriter Follow-Up SLA</span>
                  <span className={`font-semibold ${reviewDurationHours > 24 ? "text-amber-700" : "text-slate-800"}`}>
                    24 Hours {reviewDurationHours > 24 ? "(Breached)" : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Manager Escalation SLA</span>
                  <span className={`font-semibold ${reviewDurationHours > 48 ? "text-rose-600" : "text-slate-800"}`}>
                    48 Hours {reviewDurationHours > 48 ? "(Escalated)" : ""}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* 4. MODALS: Case Assignment & Task Resolution                                   */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* Assign Case Modal */}
      <Modal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title="Assign Case to Underwriter"
        description={`Assign application ${application.application_number} to an internal Underwriter. The 24-hour review SLA timer begins upon assignment.`}
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
              Select Underwriter
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full text-sm bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              {(users.filter((u) => u.role === "Underwriter").length > 0
                ? users.filter((u) => u.role === "Underwriter")
                : users
              ).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Resolve Task Modal */}
      <Modal
        isOpen={!!resolvingTask}
        onClose={() => setResolvingTask(null)}
        title="Resolve Operational Task"
        description={`Confirming this action will resolve the ${resolvingTask?.task_type} task for application ${application.application_number}.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResolvingTask(null)}>
              Cancel
            </Button>
            <Button 
              variant={resolvingTask?.task_type === "ESCALATION" ? "danger" : "primary"}
              size="sm" 
              onClick={handleResolveTask}
              loading={actionLoading}
            >
              Mark Task as Resolved
            </Button>
          </>
        }
      >
        {resolvingTask && (
          <div className="space-y-4 py-2">
            <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
              resolvingTask.task_type === "ESCALATION"
                ? "bg-rose-50 border-rose-200"
                : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-center gap-2">
                <Badge variant={resolvingTask.task_type === "ESCALATION" ? "error" : "warning"} dot>
                  {resolvingTask.task_type}
                </Badge>
                <span className="font-bold text-slate-900">{resolvingTask.title}</span>
              </div>
              <p className="text-slate-600 leading-relaxed">{resolvingTask.description}</p>
              <div className="text-[11px] text-slate-500 pt-1">
                Assigned to: <strong>{resolvingTask.assigned_to?.name || resolvingTask.assigned_to_role}</strong>
              </div>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Resolving this task updates the case workflow and refreshes SLA metrics.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
