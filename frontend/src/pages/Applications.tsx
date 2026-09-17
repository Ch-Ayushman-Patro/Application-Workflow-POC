import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useApplications,
  useUsers,
  useClaimApplication,
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
  formatElapsedTime,
  formatShortDate,
} from "../utils/formatters";
import {
  Search,
  UserCheck,
  ArrowUpRight,
  Layers,
  Filter,
  ArrowUpDown
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { isToday, isYesterday, isThisWeek, isThisMonth, parseISO, isSameDay } from "date-fns";

type TabKey = "all" | "unassigned" | "assignment_delayed" | "in_progress" | "delayed" | "approved" | "rejected" | "my_team" | "my_cases";

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
  
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc"|"desc">("desc");

  const [claimTargetApp, setClaimTargetApp] = useState<Application | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");

  // Server-state (global, cached)
  const { data: applications = [], isLoading: loadingApps } = useApplications();
  const { data: users = [], isLoading: loadingUsers } = useUsers();

  const claimMutation = useClaimApplication();

  const loading = (loadingApps && applications.length === 0) || (loadingUsers && users.length === 0);
  const actionLoading = claimMutation.isPending;

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

  // Base scope logic for tabs
  const getBaseSet = () => {
    if (currentRole === "Underwriter") return scope.myApplications;
    if (currentRole === "Manager") return scope.teamApplications;
    return applications;
  };
  
  const baseApps = getBaseSet();

  // ── Tab definitions + counts ─────────────────────────────────────────────
  
  const getAgeHours = (dateStr: string) => {
    const created = new Date(dateStr).getTime();
    return (Date.now() - created) / (1000 * 3600);
  };

  const c_unassigned = baseApps.filter((a) => a.status === "OPEN" && !a.claimed_by_user_id);
  const c_assignment_delayed = c_unassigned.filter((a) => getAgeHours(a.created_at) > 24);
  const c_in_progress = baseApps.filter((a) => a.status === "CLAIMED");
  const c_delayed = c_in_progress.filter((a) => a.claimed_at && getAgeHours(a.claimed_at) > 24);
  const c_approved = baseApps.filter((a) => a.status === "COMPLETED" && (a.decision === "APPROVED" || a.current_stage === "Approved" || (!a.decision && a.current_stage !== "Rejected")));
  const c_rejected = baseApps.filter((a) => a.status === "COMPLETED" && (a.decision === "REJECTED" || a.current_stage === "Rejected"));

  const tabs: TabDef[] = (() => {
    if (currentRole === "Underwriter") {
      return [
        { key: "my_cases", label: `My Applications (${baseApps.length})`, activeColor: "bg-indigo-600 text-white" },
        { key: "in_progress", label: `In Progress (${c_in_progress.length})`, activeColor: "bg-blue-600 text-white" },
        { key: "delayed", label: `Delayed (${c_delayed.length})`, activeColor: "bg-amber-600 text-white" },
        { key: "approved", label: `Approved (${c_approved.length})`, activeColor: "bg-emerald-600 text-white" },
        { key: "rejected", label: `Rejected (${c_rejected.length})`, activeColor: "bg-rose-600 text-white" },
      ];
    }
    if (currentRole === "Manager") {
      return [
        { key: "my_team", label: `My Team (${baseApps.length})`, activeColor: "bg-indigo-600 text-white" },
        { key: "in_progress", label: `In Progress (${c_in_progress.length})`, activeColor: "bg-blue-600 text-white" },
        { key: "delayed", label: `Delayed (${c_delayed.length})`, activeColor: "bg-amber-600 text-white" },
        { key: "approved", label: `Approved (${c_approved.length})`, activeColor: "bg-emerald-600 text-white" },
        { key: "rejected", label: `Rejected (${c_rejected.length})`, activeColor: "bg-rose-600 text-white" },
      ];
    }
    // Admin
    return [
      { key: "all", label: `All Apps (${applications.length})`, activeColor: "bg-slate-900 text-white" },
      { key: "unassigned", label: `Unassigned (${c_unassigned.length})`, activeColor: "bg-slate-600 text-white" },
      { key: "assignment_delayed", label: `Assignment Delayed (${c_assignment_delayed.length})`, activeColor: "bg-orange-600 text-white" },
      { key: "in_progress", label: `In Progress (${c_in_progress.length})`, activeColor: "bg-blue-600 text-white" },
      { key: "delayed", label: `Delayed (${c_delayed.length})`, activeColor: "bg-amber-600 text-white" },
      { key: "approved", label: `Approved (${c_approved.length})`, activeColor: "bg-emerald-600 text-white" },
      { key: "rejected", label: `Rejected (${c_rejected.length})`, activeColor: "bg-rose-600 text-white" },
    ];
  })();

  // ── Filter applications by active tab ────────────────────────────────────
  const tabFilteredApps = (() => {
    switch (activeTab) {
      case "my_cases":
      case "my_team":
      case "all":
        return baseApps;
      case "unassigned":
        return c_unassigned;
      case "assignment_delayed":
        return c_assignment_delayed;
      case "in_progress":
        return c_in_progress;
      case "delayed":
        return c_delayed;
      case "approved":
        return c_approved;
      case "rejected":
        return c_rejected;
      default:
        return baseApps;
    }
  })();

  // ── Date and Search Filters ──────────────────────────────────────────────
  const searchFilteredApps = tabFilteredApps.filter((app) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.application_number.toLowerCase().includes(q) ||
      (app.claimed_by?.name ?? "").toLowerCase().includes(q)
    );
  });
  
  const finalFilteredApps = searchFilteredApps.filter((app) => {
    if (dateFilter === "all") return true;
    const d = parseISO(app.created_at);
    if (dateFilter === "today") return isToday(d);
    if (dateFilter === "yesterday") return isYesterday(d);
    if (dateFilter === "this_week") return isThisWeek(d);
    if (dateFilter === "this_month") return isThisMonth(d);
    if (dateFilter === "custom" && customDate) {
      return isSameDay(d, parseISO(customDate));
    }
    return true;
  });

  // Sort by elapsed time (desc = oldest first = largest elapsed time)
  finalFilteredApps.sort((a, b) => {
    const aMs = new Date(a.created_at).getTime();
    const bMs = new Date(b.created_at).getTime();
    // Older date = smaller Ms. We want oldest first (largest elapsed) for desc
    return sortOrder === "desc" ? aMs - bMs : bMs - aMs;
  });

  // ── Header copy ──────────────────────────────────────────────────────────
  const pageTitle =
    currentRole === "Underwriter"
      ? `${currentUser.name.split(" ")[0]}'s Applications`
      : currentRole === "Manager"
      ? "My Team's Applications"
      : "All Applications";

  const pageSubtitle =
    currentRole === "Underwriter"
      ? `Manage your claimed applications.`
      : currentRole === "Manager"
      ? `Monitor your team's Applications.`
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                if (e.target.value !== "custom") setCustomDate("");
              }}
              className="pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date</option>
            </select>
          </div>
          
          {dateFilter === "custom" && (
            <div className="relative">
              <input 
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="pl-3 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:outline-none"
              />
            </div>
          )}
          
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
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : finalFilteredApps.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No applications found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? "Try changing your search query or date filter."
                : activeTab === "my_cases"
                ? "You haven't claimed any applications yet. Go to All Apps to claim one."
                : activeTab === "my_team"
                ? "None of your direct reports have applications in this view."
                : "Try changing the active tab filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Underwriter</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Claimed At</TableHead>
                  <TableHead>
                    <button 
                      onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                      className="flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Elapsed Time
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalFilteredApps.map((app) => {
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
                          {app.current_stage ?? "Claim Intake"}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              app.status === "COMPLETED"
                                ? (app.decision === "REJECTED" ? "error" : "success")
                                : app.status === "CLAIMED"
                                ? "info"
                                : "warning"
                            }
                            dot
                          >
                            {app.status === "OPEN" ? "UNASSIGNED" : (app.status === "COMPLETED" ? app.decision || "APPROVED" : app.status)}
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

                      {/* Submitted */}
                      <TableCell>
                        <div className="text-xs text-slate-700">
                          {formatShortDate(app.created_at)}
                        </div>
                      </TableCell>

                      {/* Claimed At */}
                      <TableCell>
                        <div className="text-xs text-slate-700">
                          {app.claimed_at ? formatShortDate(app.claimed_at) : "—"}
                        </div>
                      </TableCell>

                      {/* Elapsed Time */}
                      <TableCell>
                        <div className="text-xs text-slate-700 font-medium">
                          {formatElapsedTime(app.created_at)}
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
          </div>
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
