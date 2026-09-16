import { useState } from "react";
import { Link } from "react-router-dom";
import { useUserScope } from "../hooks/useUserScope";
import { useTasks, useCompleteTask, useSimulateInflow } from "../hooks/useWorkflowQueries";
import type { Task } from "../types";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/Table";
import { formatRelativeTime } from "../utils/formatters";
import {
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  InboxIcon,
  Sparkles,
  Filter,
} from "lucide-react";
import { useRole } from "../context/RoleContext";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const taskTypeLabel = (type: string) => {
  if (type === "ESCALATION") return "Escalation";
  if (type === "FOLLOW_UP") return "Follow Up";
  if (type === "ASSIGNMENT") return "Assignment";
  return type;
};

const taskTypeSLAContext = (type: string) => {
  if (type === "ESCALATION") return "Case breached 48h SLA — manager intervention required.";
  if (type === "FOLLOW_UP") return "Claimed review exceeded 24h SLA — officer follow-up needed.";
  if (type === "ASSIGNMENT") return "Case unclaimed for >24h — officer assignment required.";
  return "";
};

// ──────────────────────────────────────────────────────────────────────────────
// Scope toggle configuration per role
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Scopes available depend on the current role.
 * The key maps to a filter function over allTasks.
 *
 * Admin:
 *   "my_action"  → tasks that need MY attention (ASSIGNMENT to Admin + directly assigned to me)
 *   "all"        → all open tasks globally
 *
 * Manager:
 *   "my_tasks"   → tasks assigned directly to me (by user ID)
 *   "team_tasks" → tasks assigned to my direct reports (by user ID)
 *   "all"        → all open tasks (full visibility)
 *
 * Claimed Officer:
 *   "my_tasks"   → tasks assigned to ME specifically (assigned_to_user_id === currentUser.id)
 *                  NOT by role — Charlie never sees Bob's tasks
 *   "all"        → all open tasks (optional full view)
 */

type ScopeKey = "my_action" | "my_tasks" | "team_tasks" | "all";

interface ScopeOption {
  key: ScopeKey;
  label: string;
}

function getScopeOptions(role: string): ScopeOption[] {
  if (role === "Admin") {
    return [
      { key: "my_action", label: "Needs My Action" },
      { key: "all", label: "All Tasks" },
    ];
  }
  if (role === "Manager") {
    return [
      { key: "my_tasks", label: "My Tasks" },
      { key: "team_tasks", label: "Team Tasks" },
      { key: "all", label: "All Operations" },
    ];
  }
  // Claimed Officer
  return [
    { key: "my_tasks", label: "My Tasks" },
    { key: "all", label: "All Operations" },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// Task Row
// ──────────────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onResolve,
}: {
  task: Task;
  onResolve: (task: Task) => void;
}) {
  const isEscalation = task.task_type === "ESCALATION";
  const isFollowUp = task.task_type === "FOLLOW_UP";
  const isDone = task.status === "COMPLETED";

  return (
    <TableRow
      className={`transition-colors ${
        isDone
          ? "opacity-60 bg-slate-50/60"
          : isEscalation
          ? "bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-400"
          : isFollowUp
          ? "bg-amber-50/20 hover:bg-amber-50/50"
          : "hover:bg-slate-50"
      }`}
    >
      {/* Type */}
      <TableCell>
        <div className="flex items-center gap-2">
          {isEscalation && !isDone && (
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
          )}
          <Badge
            variant={isEscalation ? "error" : isFollowUp ? "warning" : "info"}
            dot
            pulse={isEscalation && !isDone}
          >
            {taskTypeLabel(task.task_type)}
          </Badge>
        </div>
      </TableCell>

      {/* What / SLA context */}
      <TableCell>
        <div
          className={`text-xs font-semibold ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}
        >
          {taskTypeSLAContext(task.task_type)}
        </div>
      </TableCell>

      {/* Case link */}
      <TableCell>
        <Link
          to={`/applications/${task.application_id}`}
          className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
        >
          Case #{task.application_id}
          <ArrowUpRight className="w-3 h-3 text-slate-400" />
        </Link>
      </TableCell>

      {/* Who */}
      <TableCell>
        <div className="text-xs font-semibold text-slate-800">
          {task.assigned_to?.name ?? task.assigned_to_role ?? "Admin"}
        </div>
        {task.assigned_to?.name && (
          <div className="text-[10px] text-slate-500">{task.assigned_to_role}</div>
        )}
      </TableCell>

      {/* When */}
      <TableCell>
        <div className="text-xs text-slate-600">{formatRelativeTime(task.created_at)}</div>
      </TableCell>

      {/* Action */}
      <TableCell className="text-right">
        {!isDone ? (
          <Button
            size="xs"
            variant={isEscalation ? "danger" : "primary"}
            onClick={() => onResolve(task)}
          >
            Resolve
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Done
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { currentUser, currentRole } = useRole();
  const scope = useUserScope();

  const [activeTab, setActiveTab] = useState<"OPEN" | "COMPLETED">("OPEN");
  const [selectedScope, setSelectedScope] = useState<ScopeKey>(() =>
    currentRole === "Admin" ? "my_action" : "my_tasks"
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Server-state (global)
  const { data: allTasks = [], isLoading: loadingTasks } = useTasks();
  const completeMutation = useCompleteTask();
  const simulateMutation = useSimulateInflow();

  const loading = loadingTasks && allTasks.length === 0;
  const completing = completeMutation.isPending;
  const simulating = simulateMutation.isPending;

  const handleSimulate = async () => {
    try {
      await simulateMutation.mutateAsync({ count: 3, runWorkflow: true });
    } catch (err) {
      console.error("Failed to simulate inflow", err);
    }
  };

  const handleComplete = async () => {
    if (!selectedTask) return;
    try {
      await completeMutation.mutateAsync(selectedTask.id);
      setSelectedTask(null);
    } catch (err) {
      console.error("Failed to complete task", err);
    }
  };

  // Tab split (open / completed are global regardless of scope)
  const openTasks = allTasks.filter((t) => t.status === "OPEN");
  const completedTasks = allTasks.filter((t) => t.status === "COMPLETED");

  // Scope filter — applied only to OPEN tasks; COMPLETED tab always shows global
  const scopedOpenTasks = (() => {
    switch (selectedScope) {
      case "my_action":
        return scope.adminActionTasks;
      case "my_tasks":
        return scope.myTasks;
      case "team_tasks":
        return scope.teamTasks;
      case "all":
      default:
        return openTasks;
    }
  })();

  const displayedTasks = activeTab === "OPEN" ? scopedOpenTasks : completedTasks;
  const escalationCount = openTasks.filter((t) => t.task_type === "ESCALATION").length;
  const scopeOptions = getScopeOptions(currentRole);

  // Scope-aware badge counts
  const scopeCounts: Partial<Record<ScopeKey, number>> = {
    my_action: scope.adminActionTasks.length,
    my_tasks: scope.myTasks.length,
    team_tasks: scope.teamTasks.length,
    all: openTasks.length,
  };

  // Titles
  const pageTitle =
    currentRole === "Admin"
      ? "Task Inbox"
      : currentRole === "Manager"
      ? "My Task Inbox"
      : `${currentUser.name.split(" ")[0]}'s Task Inbox`;

  const pageSubtitle =
    currentRole === "Admin"
      ? "SLA action items, assignment tasks, and escalation alerts."
      : currentRole === "Manager"
      ? "Escalations assigned to you and your team's pending tasks."
      : "Tasks assigned directly to you. Only your tasks appear in My Tasks.";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{pageTitle}</h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 border border-slate-300">
              {currentRole}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {escalationCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              {escalationCount} urgent escalation{escalationCount > 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulate}
            loading={simulating}
            icon={<Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Simulate Inflow (Demo)
          </Button>
        </div>
      </div>

      {/* Tabs & Scope Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("OPEN")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "OPEN" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Open ({openTasks.length})
          </button>
          <button
            onClick={() => setActiveTab("COMPLETED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "COMPLETED"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Resolved ({completedTasks.length})
          </button>
        </div>

        {activeTab === "OPEN" && (
          <div className="flex items-center gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 text-xs">
            <span className="text-slate-400 flex items-center gap-1 text-[11px] font-medium mr-1">
              <Filter className="w-3 h-3" /> Scope:
            </span>
            {scopeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSelectedScope(opt.key)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedScope === opt.key
                    ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {opt.label}
                {scopeCounts[opt.key] !== undefined && (
                  <span
                    className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      selectedScope === opt.key
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {scopeCounts[opt.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scope info banner for Officers */}
      {currentRole === "Claimed Officer" && selectedScope === "my_tasks" && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Showing only tasks assigned directly to <strong>{currentUser.name}</strong> — not all Claimed Officers.
        </div>
      )}

      {/* Task Table */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            {activeTab === "OPEN" ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">No open tasks in this scope</p>
                <p className="text-xs text-slate-400">
                  {selectedScope === "my_tasks"
                    ? `No tasks are currently assigned to ${currentUser.name}.`
                    : selectedScope === "my_action"
                    ? "No assignment tasks pending — the queue is clear."
                    : "Run the workflow engine to check if any cases need attention."}
                </p>
              </>
            ) : (
              <>
                <InboxIcon className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-700">No resolved tasks yet</p>
              </>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>What needs to happen</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedTasks.map((task) => (
                <TaskRow key={task.id} task={task} onResolve={setSelectedTask} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Resolve Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title="Mark Task as Resolved"
        description={`Confirm that the issue for Case #${selectedTask?.application_id} has been addressed.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
              Cancel
            </Button>
            <Button
              variant={selectedTask?.task_type === "ESCALATION" ? "danger" : "primary"}
              size="sm"
              onClick={handleComplete}
              loading={completing}
            >
              Mark as Resolved
            </Button>
          </>
        }
      >
        {selectedTask && (
          <div className="py-2 space-y-3">
            <div
              className={`p-4 rounded-2xl border ${
                selectedTask.task_type === "ESCALATION"
                  ? "bg-rose-50 border-rose-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={selectedTask.task_type === "ESCALATION" ? "error" : selectedTask.task_type === "FOLLOW_UP" ? "warning" : "info"}
                  dot
                >
                  {taskTypeLabel(selectedTask.task_type)}
                </Badge>
              </div>
              <p className="text-sm text-slate-700">{taskTypeSLAContext(selectedTask.task_type)}</p>
              <p className="text-xs text-slate-500 mt-2">
                Assigned to:{" "}
                <strong>
                  {selectedTask.assigned_to?.name ?? selectedTask.assigned_to_role ?? "Admin"}
                </strong>
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
