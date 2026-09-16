import { useState } from "react";
import { Link } from "react-router-dom";
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
  TableCell 
} from "../components/ui/Table";
import { formatRelativeTime } from "../utils/formatters";
import { 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight,
  InboxIcon,
  Sparkles,
  Filter
} from "lucide-react";
import { useRole } from "../context/RoleContext";

// Simplified human-readable task type labels
const taskTypeLabel = (type: string) => {
  if (type === "ESCALATION") return "Escalation";
  if (type === "FOLLOW_UP") return "Follow Up";
  if (type === "ASSIGNMENT") return "Assignment";
  return type;
};

const taskTypeDescription = (type: string) => {
  if (type === "ESCALATION") return "This case has breached SLA (> 48h). Manager needs to step in.";
  if (type === "FOLLOW_UP") return "Claimed Officer review SLA reached (> 24h). Officer follow-up required.";
  if (type === "ASSIGNMENT") return "Unclaimed case sitting > 24h. Admin assignment needed.";
  return "";
};

export default function Tasks() {
  const { currentUser, currentRole } = useRole();
  const [activeTab, setActiveTab] = useState<string>("OPEN");
  const [scopeFilter, setScopeFilter] = useState<"MY_ROLE" | "ALL">("MY_ROLE");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Cached server-state query
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  // Targeted mutations
  const completeMutation = useCompleteTask();
  const simulateMutation = useSimulateInflow();

  const loading = loadingTasks && tasks.length === 0;
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

  const openTasks = tasks.filter(t => t.status === "OPEN");
  const completedTasks = tasks.filter(t => t.status === "COMPLETED");
  const escalations = openTasks.filter(t => t.task_type === "ESCALATION");

  const tabScopedTasks = activeTab === "OPEN" ? openTasks : completedTasks;

  const filteredTasks = tabScopedTasks.filter((t) => {
    if (scopeFilter === "ALL") return true;
    if (currentRole === "Claimed Officer") {
      return t.assigned_to_user_id === currentUser.id || t.assigned_to_role === "Claimed Officer";
    }
    if (currentRole === "Manager") {
      return t.task_type === "ESCALATION" || t.assigned_to_user_id === currentUser.id;
    }
    // Admin sees all open tasks by default
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Task Inbox</h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 border border-slate-300">
              Perspective: {currentRole}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            SLA action items, intake assignments, and manager escalations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {escalations.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              {escalations.length} urgent escalation{escalations.length > 1 ? 's' : ''}
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
            Open Tasks ({openTasks.length})
          </button>
          <button
            onClick={() => setActiveTab("COMPLETED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "COMPLETED" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Resolved ({completedTasks.length})
          </button>
        </div>

        <div className="flex items-center gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 text-xs">
          <span className="text-slate-400 flex items-center gap-1 text-[11px] font-medium mr-1">
            <Filter className="w-3 h-3" /> Scope:
          </span>
          <button
            onClick={() => setScopeFilter("MY_ROLE")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              scopeFilter === "MY_ROLE" 
                ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200" 
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            My Role ({currentRole})
          </button>
          <button
            onClick={() => setScopeFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              scopeFilter === "ALL" 
                ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200" 
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            All Operations
          </button>
        </div>
      </div>

      {/* Task Table */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            {activeTab === "OPEN" ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">No open tasks</p>
                <p className="text-xs text-slate-400">
                  Run the workflow engine to check if any cases need attention.
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
                <TableHead>Who</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const isEscalation = task.task_type === "ESCALATION";
                const isFollowUp = task.task_type === "FOLLOW_UP";
                const isDone = task.status === "COMPLETED";

                return (
                  <TableRow
                    key={task.id}
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

                    {/* What needs to happen */}
                    <TableCell>
                      <div className={`text-xs font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {taskTypeDescription(task.task_type)}
                      </div>
                    </TableCell>

                    {/* Case */}
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
                        {task.assigned_to?.name || task.assigned_to_role || "Admin"}
                      </div>
                      {task.assigned_to?.name && (
                        <div className="text-[10px] text-slate-500">{task.assigned_to_role}</div>
                      )}
                    </TableCell>

                    {/* When */}
                    <TableCell>
                      <div className="text-xs text-slate-600">
                        {formatRelativeTime(task.created_at)}
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      {!isDone ? (
                        <Button
                          size="xs"
                          variant={isEscalation ? "danger" : "primary"}
                          onClick={() => setSelectedTask(task)}
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
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Resolve Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title="Mark Task as Resolved"
        description={`Confirming this means the issue for Case #${selectedTask?.application_id} has been handled.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
              Cancel
            </Button>
            <Button
              variant={selectedTask?.task_type === 'ESCALATION' ? 'danger' : 'primary'}
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
            <div className={`p-4 rounded-2xl border ${
              selectedTask.task_type === 'ESCALATION'
                ? 'bg-rose-50 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={selectedTask.task_type === 'ESCALATION' ? 'error' : 'info'} dot>
                  {taskTypeLabel(selectedTask.task_type)}
                </Badge>
              </div>
              <p className="text-sm text-slate-700">
                {taskTypeDescription(selectedTask.task_type)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Assigned to: <strong>{selectedTask.assigned_to?.name || selectedTask.assigned_to_role || 'Admin'}</strong>
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
