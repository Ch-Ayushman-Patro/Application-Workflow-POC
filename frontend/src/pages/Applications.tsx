import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  useApplications, 
  useUsers, 
  useClaimApplication, 
  useCompleteApplication, 
  useSimulateInflow 
} from "../hooks/useWorkflowQueries";
import type { Application } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { Card } from "../components/ui/Card";
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
  formatRelativeTime,
  formatApplicationAge
} from "../utils/formatters";
import { 
  Search, 
  UserCheck, 
  CheckCircle2, 
  ArrowUpRight,
  Layers,
  Sparkles
} from "lucide-react";
import { useRole } from "../context/RoleContext";

export default function Applications() {
  const { currentUser, currentRole } = useRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  
  const [claimTargetApp, setClaimTargetApp] = useState<Application | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");

  // Cached server-state queries
  const { data: applications = [], isLoading: loadingApps } = useApplications();
  const { data: users = [], isLoading: loadingUsers } = useUsers();

  // Targeted mutations
  const claimMutation = useClaimApplication();
  const completeMutation = useCompleteApplication();
  const simulateMutation = useSimulateInflow();

  const loading = (loadingApps && applications.length === 0) || (loadingUsers && users.length === 0);
  const simulating = simulateMutation.isPending;
  const actionLoading = claimMutation.isPending || completeMutation.isPending;

  const handleSimulate = async () => {
    try {
      await simulateMutation.mutateAsync({ count: 3, runWorkflow: true });
    } catch (err) {
      console.error("Failed to simulate inflow", err);
    }
  };

  const handleClaimSubmit = async () => {
    if (!claimTargetApp || !selectedUserId) return;
    try {
      await claimMutation.mutateAsync({ id: claimTargetApp.id, userId: Number(selectedUserId) });
      setClaimTargetApp(null);
      setSelectedUserId("");
    } catch (err) {
      console.error("Failed to claim application", err);
    }
  };

  const handleCompleteApp = async (appId: number) => {
    try {
      await completeMutation.mutateAsync(appId);
    } catch (err) {
      console.error("Failed to complete application", err);
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch = app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.claimed_by?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const risk = getApplicationRisk(app);
    let matchesStatus = true;
    if (statusFilter === "MY_CASES") {
      matchesStatus = app.claimed_by_user_id === currentUser.id;
    } else if (statusFilter === "UNCLAIMED") {
      matchesStatus = app.status === "OPEN" && !app.claimed_by_user_id;
    } else if (statusFilter === "IN_PROGRESS") {
      matchesStatus = app.status === "CLAIMED";
    } else if (statusFilter === "OVERDUE") {
      matchesStatus = risk.level === "escalated" || risk.level === "at_risk";
    } else if (statusFilter === "COMPLETED") {
      matchesStatus = app.status === "COMPLETED";
    }

    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: applications.length,
    myCases: applications.filter(a => a.claimed_by_user_id === currentUser.id).length,
    unclaimed: applications.filter(a => a.status === "OPEN" && !a.claimed_by_user_id).length,
    inProgress: applications.filter(a => a.status === "CLAIMED").length,
    overdue: applications.filter(a => {
      const r = getApplicationRisk(a);
      return r.level === "escalated" || r.level === "at_risk";
    }).length,
    completed: applications.filter(a => a.status === "COMPLETED").length,
  };

  const tabs = [
    { key: "ALL", label: `All (${counts.all})`, activeColor: "bg-slate-900 text-white" },
    ...(currentRole === "Claimed Officer" ? [{ key: "MY_CASES", label: `My Claimed (${counts.myCases})`, activeColor: "bg-emerald-600 text-white" }] : []),
    { key: "UNCLAIMED", label: `Unclaimed (${counts.unclaimed})`, activeColor: "bg-amber-600 text-white" },
    { key: "IN_PROGRESS", label: `In Progress (${counts.inProgress})`, activeColor: "bg-indigo-600 text-white" },
    { key: "OVERDUE", label: `Overdue (${counts.overdue})`, activeColor: "bg-rose-600 text-white" },
    { key: "COMPLETED", label: `Completed (${counts.completed})`, activeColor: "bg-emerald-600 text-white" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Applications</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            View and manage all loan applications in the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.key ? tab.activeColor : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-60">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search case # or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
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
              Try changing your filter or search query.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Claimed Officer</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.map((app) => {
                const risk = getApplicationRisk(app);
                const openAppTasks = (app.tasks || []).filter(t => t.status === "OPEN");
                const hasEscalation = openAppTasks.some(t => t.task_type === "ESCALATION");

                return (
                  <TableRow
                    key={app.id}
                    className={`hover:bg-slate-50 transition-colors ${hasEscalation ? "border-l-4 border-l-rose-400" : ""}`}
                  >
                    {/* Application */}
                    <TableCell>
                      <Link
                        to={`/applications/${app.id}`}
                        className="font-mono text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5"
                      >
                        {app.application_number}
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                      </Link>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {app.current_stage || "Intake"}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant={
                            app.status === "COMPLETED" ? "success" :
                            app.status === "CLAIMED" ? "info" :
                            "warning"
                          }
                          dot
                        >
                          {app.status === "OPEN" ? "UNCLAIMED" : app.status}
                        </Badge>
                        {app.status !== "COMPLETED" && (
                          <div className="text-[11px] text-slate-500">
                            Risk: <span className="font-medium text-slate-700">{risk.label}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Claimed Officer */}
                    <TableCell>
                      {app.claimed_by ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
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

                    {/* Age */}
                    <TableCell>
                      <div className="text-xs text-slate-700 font-medium">
                        {formatApplicationAge(app.created_at)} old
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {app.status === "COMPLETED" ? "Resolved" : formatRelativeTime(app.created_at)}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {app.status === "OPEN" && !app.claimed_by_user_id && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => {
                              setClaimTargetApp(app);
                              const claimable = users.filter((u) => u.role === "Claimed Officer");
                              if (currentRole === "Claimed Officer") {
                                setSelectedUserId(currentUser.id);
                              } else if (claimable.length > 0) {
                                setSelectedUserId(claimable[0].id);
                              } else if (users.length > 0) {
                                setSelectedUserId(users[0].id);
                              }
                            }}
                            icon={<UserCheck className="w-3 h-3" />}
                          >
                            {currentRole === "Claimed Officer" ? "Claim Case" : "Assign"}
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
                          <Button size="xs" variant="ghost">View</Button>
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

      {/* Claim Modal */}
      <Modal
        isOpen={!!claimTargetApp}
        onClose={() => setClaimTargetApp(null)}
        title="Assign Case to Claimed Officer"
        description={`Assign ${claimTargetApp?.application_number} to a Claimed Officer. The review SLA timer will begin immediately.`}
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
              Confirm Assignment
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Assign to Claimed Officer
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full text-sm bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {(users.filter((u) => u.role === "Claimed Officer").length > 0 
                ? users.filter((u) => u.role === "Claimed Officer") 
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
    </div>
  );
}
