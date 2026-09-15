import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getApplications, getUsers, claimApplication, completeApplication } from "../services/api";
import type { Application, User } from "../types";
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
import { 
  getApplicationRisk, 
  getApplicationAgeHours, 
  formatDate 
} from "../utils/formatters";
import { 
  Search, 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  ArrowUpRight, 
  CheckCircle2, 
  Layers 
} from "lucide-react";

export default function Applications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  
  // Claim modal state
  const [claimTargetApp, setClaimTargetApp] = useState<Application | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      const [appsData, usersData] = await Promise.all([
        getApplications(),
        getUsers()
      ]);
      setApplications(appsData);
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleWorkflowRun = () => loadData();
    window.addEventListener('workflow-run-completed', handleWorkflowRun);
    return () => window.removeEventListener('workflow-run-completed', handleWorkflowRun);
  }, []);

  const handleClaimSubmit = async () => {
    if (!claimTargetApp || !selectedUserId) return;
    setActionLoading(true);
    try {
      await claimApplication(claimTargetApp.id, Number(selectedUserId));
      setClaimTargetApp(null);
      setSelectedUserId("");
      await loadData();
    } catch (err) {
      console.error("Failed to claim application", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteApp = async (appId: number) => {
    setActionLoading(true);
    try {
      await completeApplication(appId);
      await loadData();
    } catch (err) {
      console.error("Failed to complete application", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter applications
  const filteredApps = applications.filter((app) => {
    const matchesSearch = app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.claimed_by?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const risk = getApplicationRisk(app);

    let matchesStatus = true;
    if (statusFilter === "UNCLAIMED") {
      matchesStatus = app.status === "OPEN" && !app.claimed_by_user_id;
    } else if (statusFilter === "CLAIMED") {
      matchesStatus = app.status === "CLAIMED";
    } else if (statusFilter === "ESCALATED") {
      matchesStatus = risk.level === "escalated" || risk.level === "at_risk";
    } else if (statusFilter === "COMPLETED") {
      matchesStatus = app.status === "COMPLETED";
    }

    let matchesRole = true;
    if (roleFilter !== "ALL") {
      matchesRole = app.current_role === roleFilter;
    }

    return matchesSearch && matchesStatus && matchesRole;
  });

  const counts = {
    all: applications.length,
    unclaimed: applications.filter(a => a.status === "OPEN" && !a.claimed_by_user_id).length,
    claimed: applications.filter(a => a.status === "CLAIMED").length,
    escalated: applications.filter(a => {
      const r = getApplicationRisk(a);
      return r.level === "escalated" || r.level === "at_risk";
    }).length,
    completed: applications.filter(a => a.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Case Pipeline</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor, assign, and track lifecycle progression of financial applications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Total Cases:</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 font-mono font-bold text-xs text-slate-800">
            {applications.length}
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === "ALL" 
                ? "bg-slate-900 text-white shadow-2xs" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Cases ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter("UNCLAIMED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === "UNCLAIMED" 
                ? "bg-amber-600 text-white shadow-2xs" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Unclaimed ({counts.unclaimed})
          </button>
          <button
            onClick={() => setStatusFilter("CLAIMED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === "CLAIMED" 
                ? "bg-indigo-600 text-white shadow-2xs" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            In Review ({counts.claimed})
          </button>
          <button
            onClick={() => setStatusFilter("ESCALATED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === "ESCALATED" 
                ? "bg-rose-600 text-white shadow-2xs" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            At Risk / Escalated ({counts.escalated})
          </button>
          <button
            onClick={() => setStatusFilter("COMPLETED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === "COMPLETED" 
                ? "bg-emerald-600 text-white shadow-2xs" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Completed ({counts.completed})
          </button>
        </div>

        {/* Search & Role Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search case # or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="Underwriting">Underwriting</option>
            <option value="Operations">Operations</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Main Table or Card Grid */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No applications found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No cases match the selected filter criteria or search query.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case Identifier</TableHead>
                <TableHead>Workflow Stage</TableHead>
                <TableHead>Risk / Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Aging / Duration</TableHead>
                <TableHead>Active Tasks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.map((app) => {
                const risk = getApplicationRisk(app);
                const ageHours = getApplicationAgeHours(app.created_at);
                const openAppTasks = (app.tasks || []).filter(t => t.status === "OPEN");
                const hasEscalation = openAppTasks.some(t => t.task_type === "ESCALATION");

                return (
                  <TableRow 
                    key={app.id} 
                    className={`hover:bg-slate-50/70 transition-colors ${
                      hasEscalation ? "bg-rose-50/20" : ""
                    }`}
                  >
                    <TableCell>
                      <div className="space-y-0.5">
                        <Link 
                          to={`/applications/${app.id}`}
                          className="font-mono text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5"
                        >
                          {app.application_number}
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </Link>
                        <div className="text-[11px] text-slate-500">
                          Created {formatDate(app.created_at)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span className="font-semibold text-xs text-slate-800">
                          {app.current_stage || app.current_role || "Intake"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 pl-4">
                        Role: {app.current_role || "Unassigned"}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={risk.badgeVariant} dot pulse={risk.level === "escalated"}>
                        {risk.label}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {app.claimed_by ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                            {app.claimed_by.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-900">{app.claimed_by.name}</div>
                            <div className="text-[10px] text-slate-500">{app.claimed_by.role}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Unassigned
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-slate-700 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {ageHours} hrs
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {app.status === "COMPLETED" ? "Resolved" : "In queue"}
                      </div>
                    </TableCell>

                    <TableCell>
                      {openAppTasks.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {hasEscalation && (
                            <span className="p-1 rounded-full bg-rose-100 text-rose-600">
                              <AlertTriangle className="w-3 h-3 animate-pulse" />
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-800">
                            {openAppTasks.length} {openAppTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {app.status === "OPEN" && !app.claimed_by_user_id && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => {
                              setClaimTargetApp(app);
                              if (users.length > 0) setSelectedUserId(users[0].id);
                            }}
                            icon={<UserCheck className="w-3 h-3" />}
                          >
                            Claim
                          </Button>
                        )}

                        {app.status === "CLAIMED" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleCompleteApp(app.id)}
                            icon={<CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          >
                            Complete
                          </Button>
                        )}

                        <Link to={`/applications/${app.id}`}>
                          <Button size="xs" variant="ghost">
                            View Case
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Claim Application Modal */}
      <Modal
        isOpen={!!claimTargetApp}
        onClose={() => setClaimTargetApp(null)}
        title="Assign & Claim Case"
        description={`Assign application ${claimTargetApp?.application_number} to an Underwriting team member.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setClaimTargetApp(null)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleClaimSubmit}
              loading={actionLoading}
            >
              Confirm Claim
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
            Select the operator who will assume responsibility for this case. The workflow SLA timer will initiate upon assignment.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Assignee
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full text-sm bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
