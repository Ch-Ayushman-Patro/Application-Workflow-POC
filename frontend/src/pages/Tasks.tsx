import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTasks, completeTask } from "../services/api";
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
import { formatDate, formatRelativeTime } from "../utils/formatters";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  ArrowUpRight 
} from "lucide-react";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [completing, setCompleting] = useState(false);

  const loadTasks = async () => {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();

    const handleWorkflowRun = () => loadTasks();
    window.addEventListener('workflow-run-completed', handleWorkflowRun);
    return () => window.removeEventListener('workflow-run-completed', handleWorkflowRun);
  }, []);

  const handleComplete = async () => {
    if (!selectedTask) return;
    setCompleting(true);
    try {
      await completeTask(selectedTask.id);
      setSelectedTask(null);
      setResolutionNotes("");
      await loadTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(task.application_id).includes(searchQuery);

    let matchesTab = true;
    if (activeTab === "ESCALATION") {
      matchesTab = task.task_type === "ESCALATION" && task.status === "OPEN";
    } else if (activeTab === "FOLLOW_UP") {
      matchesTab = task.task_type === "FOLLOW_UP" && task.status === "OPEN";
    } else if (activeTab === "ASSIGNMENT") {
      matchesTab = task.task_type === "ASSIGNMENT" && task.status === "OPEN";
    } else if (activeTab === "COMPLETED") {
      matchesTab = task.status === "COMPLETED";
    } else if (activeTab === "OPEN") {
      matchesTab = task.status === "OPEN";
    }

    return matchesSearch && matchesTab;
  });

  const openTasks = tasks.filter(t => t.status === "OPEN");
  const escalations = openTasks.filter(t => t.task_type === "ESCALATION");
  const followUps = openTasks.filter(t => t.task_type === "FOLLOW_UP");
  const assignments = openTasks.filter(t => t.task_type === "ASSIGNMENT");
  const completed = tasks.filter(t => t.status === "COMPLETED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Operational Workbox</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Actionable tasks, SLA warnings, and manager escalations dispatched by workflow engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {escalations.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              {escalations.length} Escalations Pending
            </span>
          )}
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "ALL"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Items ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab("ESCALATION")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ESCALATION"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-rose-700 bg-rose-50 hover:bg-rose-100"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Escalations ({escalations.length})
          </button>
          <button
            onClick={() => setActiveTab("FOLLOW_UP")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "FOLLOW_UP"
                ? "bg-amber-600 text-white shadow-2xs"
                : "text-amber-800 bg-amber-50 hover:bg-amber-100"
            }`}
          >
            Follow-Ups ({followUps.length})
          </button>
          <button
            onClick={() => setActiveTab("ASSIGNMENT")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "ASSIGNMENT"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
            }`}
          >
            Assignments ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab("COMPLETED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "COMPLETED"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Completed ({completed.length})
          </button>
        </div>

        <div className="relative sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search task, rule, or case #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Task Queue Table */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No tasks in this view</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All tasks for this criteria are currently caught up and cleared.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority & Type</TableHead>
                <TableHead>Trigger Reason / Title</TableHead>
                <TableHead>Target Case</TableHead>
                <TableHead>Assigned Role / User</TableHead>
                <TableHead>Created & Aging</TableHead>
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
                        ? "opacity-60 bg-slate-50/40"
                        : isEscalation
                        ? "bg-rose-50/30 hover:bg-rose-50/60"
                        : isFollowUp
                        ? "bg-amber-50/20 hover:bg-amber-50/50"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isEscalation && !isDone && (
                          <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
                        )}
                        <Badge
                          variant={
                            isEscalation ? "error" : isFollowUp ? "warning" : "info"
                          }
                          dot
                          pulse={isEscalation && !isDone}
                        >
                          {task.task_type}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-0.5">
                        <div className={`text-xs font-bold ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {task.title}
                        </div>
                        <p className="text-[11px] text-slate-500 max-w-md line-clamp-1">
                          {task.description}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Link
                        to={`/applications/${task.application_id}`}
                        className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                      >
                        Case #{task.application_id}
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                      </Link>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-semibold text-slate-800">
                        {task.assigned_to_role || "Admin"}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {task.assigned_to?.name || "Queue assignment"}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatRelativeTime(task.created_at)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatDate(task.created_at)}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      {!isDone ? (
                        <Button
                          size="xs"
                          variant={isEscalation ? "danger" : "primary"}
                          onClick={() => setSelectedTask(task)}
                        >
                          Resolve Task
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolved
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

      {/* Task Completion Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title="Resolve Operational Task"
        description={`Perform resolution for task #${selectedTask?.id} on Case #${selectedTask?.application_id}`}
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
              Confirm Task Resolution
            </Button>
          </>
        }
      >
        {selectedTask && (
          <div className="space-y-4 py-2">
            <div className={`p-4 rounded-2xl border ${
              selectedTask.task_type === 'ESCALATION'
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={selectedTask.task_type === 'ESCALATION' ? 'error' : 'info'} dot>
                  {selectedTask.task_type}
                </Badge>
                <span className="text-xs font-bold">{selectedTask.title}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedTask.description}
              </p>
              <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200/60">
                Assigned Role: <strong>{selectedTask.assigned_to_role || 'Admin'}</strong> • Case #{selectedTask.application_id}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Resolution Comments
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Document resolution action (e.g. reviewed applicant documents, unblocked manager approval)..."
                className="w-full text-xs border border-slate-300 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
