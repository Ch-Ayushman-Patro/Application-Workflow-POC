import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useApplications,
  useUsers,
  useClaimApplication,
  useCompleteApplication,
} from "../hooks/useWorkflowQueries";
import { useUserScope } from "../hooks/useUserScope";
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
  TableCell,
} from "../components/ui/Table";
import {
  getApplicationRisk,
  formatRelativeTime,
  formatApplicationAge,
} from "../utils/formatters";
import {
  Search,
  UserCheck,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { useRole } from "../context/RoleContext";

// ──────────────────────────────────────────────────────────────────────────────
// Tab configuration per role
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Tab key → application filter function
 *
 * Admin:    "all" (global) | "unclaimed" | "in_progress" | "overdue" | "completed"
 * Manager:  "my_team" (team apps) | "unclaimed" | "overdue" | "all" | "completed"
 * Underwriter: "my_cases" (only currentUser's) | "all" | "completed"
 * 
 * This ensures Underwriters cannot accidentally see each other's Applications in the
 * primary view without explicitly switching to "All Applications".
 */

type TabKey = "my_cases" | "my_team" | "all" | "unclaimed" | "in_progress" | "overdue" | "approved" | "rejected" | "completed";

interface TabDef {
  key: TabKey;
  label: string;
  activeColor: string;
}

export default function Applications() {
  const { currentUser, currentRole } = useRole();
  const scope = useUserScope();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (currentRole === "Underwriter") return "my_cases";
    if (currentRole === "Manager") return "my_team";
    return "all";
  });

  const [claimTargetApp, setClaimTargetApp] = useState<Application | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");

  // Server-state (global, cached)
  const { data: applications = [], isLoading: loadingApps } = useApplications();
  const { data: users = [], isLoading: loadingUsers } = useUsers();

  // Mutations
  const claimMutation = useClaimApplication();
  const completeMutation = useCompleteApplication();

  const loading = (loadingApps && applications.length === 0) || (loadingUsers && users.length === 0);
  const actionLoading = claimMutation.isPending || completeMutation.isPending;

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

  // ── Tab definitions + counts ─────────────────────────────────────────────
  const overdueCounts = applications.filter((a) => {
    const r = getApplicationRisk(a);
    return r.level === "escalated" || r.level === "at_risk";
  }).length;

  const approvedApps = applications.filter(
    (a) => a.status === "COMPLETED" && (a.decision === "APPROVED" || a.current_stage === "Approved" || (!a.decision && a.current_stage !== "Rejected"))
  );
  const rejectedApps = applications.filter(
    (a) => a.status === "COMPLETED" && (a.decision === "REJECTED" || a.current_stage === "Rejected")
  );

  const tabs: TabDef[] = (() => {
    if (currentRole === "Underwriter") {
      return [
        { key: "my_cases", label: `My Applications (${scope.myApplications.length})`, activeColor: "bg-indigo-600 text-white" },
        { key: "approved", label: `Approved (${approvedApps.length})`, activeColor: "bg-emerald-600 text-white" },
        { key: "rejected", label: `Rejected (${rejectedApps.length})`, activeColor: "bg-rose-600 text-white" },
      ];
    }
    if (currentRole === "Manager") {
      return [
        { key: "my_team", label: `My Team (${scope.teamApplications.length})`, activeColor: "bg-blue-600 text-white" },
        { key: "unclaimed", label: `Unclaimed (${scope.unclaimedApplications.length})`, activeColor: "bg-amber-600 text-white" },
        { key: "overdue", label: `Overdue (${overdueCounts})`, activeColor: "bg-rose-600 text-white" },
        { key: "approved", label: `Approved (${approvedApps.length})`, activeColor: "bg-emerald-600 text-white" },
        { key: "rejected", label: `Rejected (${rejectedApps.length})`, activeColor: "bg-rose-600 text-white" },
      ];
    }
    // Admin
    return [
      { key: "all", label: `All Applications (${applications.length})`, activeColor: "bg-slate-900 text-white" },
      { key: "unclaimed", label: `Unassigned (${scope.unclaimedApplications.length})`, activeColor: "bg-amber-600 text-white" },
      { key: "in_progress", label: `In Progress (${applications.filter((a) => a.status === "CLAIMED").length})`, activeColor: "bg-indigo-600 text-white" },
      { key: "overdue", label: `Overdue (${overdueCounts})`, activeColor: "bg-rose-600 text-white" },
      { key: "approved", label: `Approved (${approvedApps.length})`, activeColor: "bg-emerald-600 text-white" },
      { key: "rejected", label: `Rejected (${rejectedApps.length})`, activeColor: "bg-rose-600 text-white" },
    ];
  })();

  // ── Filter applications by active tab ────────────────────────────────────
  const tabBaseSet = (() => {
    switch (activeTab) {
      case "my_cases":
        return scope.myApplications;
      case "my_team":
        return scope.teamApplications;
      case "unclaimed":
        return scope.unclaimedApplications;
      case "in_progress":
        return applications.filter((a) => a.status === "CLAIMED");
      case "overdue":
        return applications.filter((a) => {
          const r = getApplicationRisk(a);
          return r.level === "escalated" || r.level === "at_risk";
        });
      case "approved":
        return approvedApps;
      case "rejected":
        return rejectedApps;
      case "completed":
        return applications.filter((a) => a.status === "COMPLETED");
      case "all":
      default:
        return applications;
    }
  })();

  const filteredApps = tabBaseSet.filter((app) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.application_number.toLowerCase().includes(q) ||
      (app.claimed_by?.name ?? "").toLowerCase().includes(q)
    );
  });

  // ── Header copy ──────────────────────────────────────────────────────────
  const pageTitle =
    currentRole === "Underwriter"
      ? `${currentUser.name.split(" ")[0]}'s Applications`
      : currentRole === "Manager"
      ? "Application Pipeline"
      : "All Applications";

  const pageSubtitle =
    currentRole === "Underwriter"
      ? `Manage your claimed applications. Switch to "All Applications" for full pipeline view.`
      : currentRole === "Manager"
      ? `Monitor your team's Applications and the overall application pipeline.`
      : "View and manage all loan applications across the system.";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{pageTitle}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{pageSubtitle}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.key ? tab.activeColor : "text-slate-600 hover:bg-slate-100"
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
            placeholder="Search application number or name..."
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
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No applications found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? "Try changing your search query."
                : activeTab === "my_cases"
                ? "You haven't claimed any applications yet. Go to All Applications to claim one."
                : activeTab === "my_team"
                ? "None of your direct reports have claimed applications yet."
                : "Try changing the active tab filter."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Underwriter</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.map((app) => {
                const risk = getApplicationRisk(app);

                return (
                  <TableRow
                    key={app.id}
                    className="hover:bg-slate-50 transition-colors"
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
                        {app.current_stage ?? "Intake"}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant={
                            app.status === "COMPLETED"
                              ? "success"
                              : app.status === "CLAIMED"
                              ? "info"
                              : "warning"
                          }
                          dot
                        >
                          {app.status === "OPEN" ? "UNCLAIMED" : app.status}
                        </Badge>
                        {app.status !== "COMPLETED" && (
                          <div className="text-[11px] text-slate-500">
                            Risk:{" "}
                            <span className="font-medium text-slate-700">{risk.label}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Underwriter */}
                    <TableCell>
                      {app.claimed_by ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {app.claimed_by.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-900">
                              {app.claimed_by.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {app.claimed_by.role}
                            </div>
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
                        {app.status === "COMPLETED"
                          ? "Resolved"
                          : formatRelativeTime(app.created_at)}
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
                              const claimable = users.filter((u) => u.role === "Underwriter");
                              if (currentRole === "Underwriter") {
                                setSelectedUserId(currentUser.id);
                              } else if (claimable.length > 0) {
                                setSelectedUserId(claimable[0].id);
                              } else if (users.length > 0) {
                                setSelectedUserId(users[0].id);
                              }
                            }}
                            icon={<UserCheck className="w-3 h-3" />}
                          >
                            {currentRole === "Underwriter" ? "Claim" : "Assign"}
                          </Button>
                        )}
                        <Link to={`/applications/${app.id}`}>
                          <Button size="xs" variant={app.status === "CLAIMED" ? "primary" : "ghost"}>
                            {app.status === "CLAIMED" ? "Review & Decide" : "View"}
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

      {/* Claim Modal */}
      <Modal
        isOpen={!!claimTargetApp}
        onClose={() => setClaimTargetApp(null)}
        title="Assign Application to Underwriter"
        description={`Assign ${claimTargetApp?.application_number} to an Underwriter. The review SLA timer begins immediately.`}
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
              Assign to Underwriter
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full text-sm bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
    </div>
  );
}
