import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  isApplicationDelayed,
} from "../utils/formatters";
import {
  Search,
  UserCheck,
  ArrowUpRight,
  Layers,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  User,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { isToday, isYesterday, isThisWeek, isThisMonth, parseISO, isSameDay } from "date-fns";

type TabKey =
  | "all"
  | "unassigned"
  | "assignment_delayed"
  | "in_progress"
  | "delayed"
  | "approved"
  | "rejected"
  | "my_team"
  | "my_cases";

type SortKey =
  | "elapsed_desc"
  | "elapsed_asc"
  | "submitted_desc"
  | "submitted_asc"
  | "claimed_desc"
  | "claimed_asc"
  | "app_asc"
  | "app_desc";

interface TabDef {
  key: TabKey;
  label: string;
  activeColor: string;
}

export default function Applications() {
  const { currentUser, currentRole } = useRole();
  const scope = useUserScope();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const tabParam = searchParams.get("tab") as TabKey | null;
    if (tabParam) return tabParam;
    if (currentRole === "Underwriter") return "my_cases";
    if (currentRole === "Manager") return "my_team";
    return "all";
  });

  // Underwriter filter for Manager & Admin
  const [selectedUnderwriter, setSelectedUnderwriter] = useState<string>(() => {
    return searchParams.get("underwriter") || "all";
  });

  // Date & Sort filters
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("elapsed_desc");

  // Assignment Modal
  const [claimTargetApp, setClaimTargetApp] = useState<Application | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");

  // Server-state (global, cached)
  const { data: applications = [], isLoading: loadingApps } = useApplications();
  const { data: users = [], isLoading: loadingUsers } = useUsers();

  const claimMutation = useClaimApplication();

  const loading = (loadingApps && applications.length === 0) || (loadingUsers && users.length === 0);
  const actionLoading = claimMutation.isPending;

  // Sync role switch: reset underwriter filter if role is Underwriter
  useEffect(() => {
    if (currentRole === "Underwriter") {
      setSelectedUnderwriter("all");
    }
  }, [currentRole]);

  // Sync with searchParams if changed externally
  useEffect(() => {
    const underwriterParam = searchParams.get("underwriter");
    if (underwriterParam && underwriterParam !== selectedUnderwriter) {
      setSelectedUnderwriter(underwriterParam);
    }
  }, [searchParams]);

  // Handle updating underwriter filter & sync to search params
  const handleUnderwriterChange = (val: string) => {
    setSelectedUnderwriter(val);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val === "all") {
        next.delete("underwriter");
      } else {
        next.set("underwriter", val);
      }
      return next;
    });
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

  // Base scope logic for tabs
  const baseApps = useMemo(() => {
    if (currentRole === "Underwriter") return scope.myApplications;
    if (currentRole === "Manager") return scope.teamApplications;
    return applications;
  }, [currentRole, scope.myApplications, scope.teamApplications, applications]);

  // Available underwriters list for Admin vs Manager
  const availableUnderwriters = useMemo(() => {
    if (currentRole === "Manager") {
      if (scope.teamMembers.length > 0) return scope.teamMembers;
      return users.filter((u) => u.manager_user_id === currentUser.id);
    }
    if (currentRole === "Admin") {
      const uw = users.filter((u) => u.role === "Underwriter");
      return uw.length > 0 ? uw : users.filter((u) => u.role !== "Admin");
    }
    return [];
  }, [currentRole, scope.teamMembers, users, currentUser.id]);

  // ── Tab definitions + counts ─────────────────────────────────────────────
  const getAgeHours = (dateStr: string) => {
    const created = new Date(dateStr).getTime();
    return (Date.now() - created) / (1000 * 3600);
  };

  // Pre-filter by underwriter if Admin/Manager picked one
  const underwriterScopedApps = useMemo(() => {
    if (selectedUnderwriter === "all") return baseApps;
    if (selectedUnderwriter === "unassigned") {
      return baseApps.filter((a) => a.status === "OPEN" && !a.claimed_by_user_id);
    }
    return baseApps.filter((a) => String(a.claimed_by_user_id) === selectedUnderwriter);
  }, [baseApps, selectedUnderwriter]);

  const c_unassigned = underwriterScopedApps.filter((a) => a.status === "OPEN" && !a.claimed_by_user_id);
  const c_assignment_delayed = c_unassigned.filter((a) => getAgeHours(a.created_at) > 24);
  const c_in_progress = underwriterScopedApps.filter((a) => a.status === "CLAIMED");
  const c_delayed = underwriterScopedApps.filter(isApplicationDelayed);
  const c_approved = underwriterScopedApps.filter(
    (a) =>
      a.status === "COMPLETED" &&
      (a.decision === "APPROVED" || a.current_stage === "Approved" || (!a.decision && a.current_stage !== "Rejected"))
  );
  const c_rejected = underwriterScopedApps.filter(
    (a) => a.status === "COMPLETED" && (a.decision === "REJECTED" || a.current_stage === "Rejected")
  );

  const tabs: TabDef[] = useMemo(() => {
    if (currentRole === "Underwriter") {
      return [
        { key: "my_cases", label: `My Applications (${underwriterScopedApps.length})`, activeColor: "bg-indigo-600 text-white" },
        { key: "in_progress", label: `In Progress (${c_in_progress.length})`, activeColor: "bg-blue-600 text-white" },
        { key: "delayed", label: `Delayed (${c_delayed.length})`, activeColor: "bg-amber-600 text-white" },
        { key: "approved", label: `Approved (${c_approved.length})`, activeColor: "bg-emerald-600 text-white" },
        { key: "rejected", label: `Rejected (${c_rejected.length})`, activeColor: "bg-rose-600 text-white" },
      ];
    }
    if (currentRole === "Manager") {
      return [
        { key: "my_team", label: `My Team (${underwriterScopedApps.length})`, activeColor: "bg-indigo-600 text-white" },
        { key: "in_progress", label: `In Progress (${c_in_progress.length})`, activeColor: "bg-blue-600 text-white" },
        { key: "delayed", label: `Delayed (${c_delayed.length})`, activeColor: "bg-amber-600 text-white" },
        { key: "approved", label: `Approved (${c_approved.length})`, activeColor: "bg-emerald-600 text-white" },
        { key: "rejected", label: `Rejected (${c_rejected.length})`, activeColor: "bg-rose-600 text-white" },
      ];
    }
    // Admin
    return [
      { key: "all", label: `All Apps (${underwriterScopedApps.length})`, activeColor: "bg-slate-900 text-white" },
      { key: "unassigned", label: `Unassigned (${c_unassigned.length})`, activeColor: "bg-slate-600 text-white" },
      { key: "assignment_delayed", label: `Assignment Delayed (${c_assignment_delayed.length})`, activeColor: "bg-orange-600 text-white" },
      { key: "in_progress", label: `In Progress (${c_in_progress.length})`, activeColor: "bg-blue-600 text-white" },
      { key: "delayed", label: `Delayed (${c_delayed.length})`, activeColor: "bg-amber-600 text-white" },
      { key: "approved", label: `Approved (${c_approved.length})`, activeColor: "bg-emerald-600 text-white" },
      { key: "rejected", label: `Rejected (${c_rejected.length})`, activeColor: "bg-rose-600 text-white" },
    ];
  }, [
    currentRole,
    underwriterScopedApps.length,
    c_unassigned.length,
    c_assignment_delayed.length,
    c_in_progress.length,
    c_delayed.length,
    c_approved.length,
    c_rejected.length,
  ]);

  // ── Filter applications by active tab ────────────────────────────────────
  const tabFilteredApps = useMemo(() => {
    switch (activeTab) {
      case "my_cases":
      case "my_team":
      case "all":
        return underwriterScopedApps;
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
        return underwriterScopedApps;
    }
  }, [activeTab, underwriterScopedApps, c_unassigned, c_assignment_delayed, c_in_progress, c_delayed, c_approved, c_rejected]);

  // ── Search Filter ────────────────────────────────────────────────────────
  const searchFilteredApps = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredApps;
    const q = searchQuery.toLowerCase();
    return tabFilteredApps.filter(
      (app) =>
        app.application_number.toLowerCase().includes(q) ||
        (app.claimed_by?.name ?? "").toLowerCase().includes(q)
    );
  }, [tabFilteredApps, searchQuery]);

  // ── Date Filter ──────────────────────────────────────────────────────────
  const dateFilteredApps = useMemo(() => {
    if (dateFilter === "all") return searchFilteredApps;
    return searchFilteredApps.filter((app) => {
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
  }, [searchFilteredApps, dateFilter, customDate]);

  // ── Sorting Logic ────────────────────────────────────────────────────────
  const finalFilteredApps = useMemo(() => {
    const apps = [...dateFilteredApps];
    apps.sort((a, b) => {
      const aCreated = new Date(a.created_at).getTime();
      const bCreated = new Date(b.created_at).getTime();

      switch (sortKey) {
        case "elapsed_desc":
          // Longest elapsed time first = oldest submission date
          return aCreated - bCreated;
        case "elapsed_asc":
          // Shortest elapsed time first = newest submission date
          return bCreated - aCreated;
        case "submitted_desc":
          // Newest submission first
          return bCreated - aCreated;
        case "submitted_asc":
          // Oldest submission first
          return aCreated - bCreated;
        case "claimed_desc": {
          const aClaimed = a.claimed_at ? new Date(a.claimed_at).getTime() : 0;
          const bClaimed = b.claimed_at ? new Date(b.claimed_at).getTime() : 0;
          return bClaimed - aClaimed;
        }
        case "claimed_asc": {
          const aClaimed = a.claimed_at ? new Date(a.claimed_at).getTime() : Infinity;
          const bClaimed = b.claimed_at ? new Date(b.claimed_at).getTime() : Infinity;
          return aClaimed - bClaimed;
        }
        case "app_asc":
          return a.application_number.localeCompare(b.application_number);
        case "app_desc":
          return b.application_number.localeCompare(a.application_number);
        default:
          return aCreated - bCreated;
      }
    });
    return apps;
  }, [dateFilteredApps, sortKey]);

  // ── Toggle sort for column headers ───────────────────────────────────────
  const toggleSort = (field: "app" | "submitted" | "claimed" | "elapsed") => {
    if (field === "elapsed") {
      setSortKey((prev) => (prev === "elapsed_desc" ? "elapsed_asc" : "elapsed_desc"));
    } else if (field === "submitted") {
      setSortKey((prev) => (prev === "submitted_desc" ? "submitted_asc" : "submitted_desc"));
    } else if (field === "claimed") {
      setSortKey((prev) => (prev === "claimed_desc" ? "claimed_asc" : "claimed_desc"));
    } else if (field === "app") {
      setSortKey((prev) => (prev === "app_asc" ? "app_desc" : "app_asc"));
    }
  };

  const getSortIcon = (field: "app" | "submitted" | "claimed" | "elapsed") => {
    if (field === "elapsed") {
      if (sortKey === "elapsed_desc") return <ArrowDown className="w-3 h-3 text-indigo-600" />;
      if (sortKey === "elapsed_asc") return <ArrowUp className="w-3 h-3 text-indigo-600" />;
    }
    if (field === "submitted") {
      if (sortKey === "submitted_desc") return <ArrowDown className="w-3 h-3 text-indigo-600" />;
      if (sortKey === "submitted_asc") return <ArrowUp className="w-3 h-3 text-indigo-600" />;
    }
    if (field === "claimed") {
      if (sortKey === "claimed_desc") return <ArrowDown className="w-3 h-3 text-indigo-600" />;
      if (sortKey === "claimed_asc") return <ArrowUp className="w-3 h-3 text-indigo-600" />;
    }
    if (field === "app") {
      if (sortKey === "app_asc") return <ArrowUp className="w-3 h-3 text-indigo-600" />;
      if (sortKey === "app_desc") return <ArrowDown className="w-3 h-3 text-indigo-600" />;
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />;
  };

  // ── Selected underwriter label ───────────────────────────────────────────
  const selectedUnderwriterName = useMemo(() => {
    if (selectedUnderwriter === "all") return null;
    if (selectedUnderwriter === "unassigned") return "Unassigned";
    const found = users.find((u) => String(u.id) === selectedUnderwriter);
    return found ? found.name : "Underwriter";
  }, [selectedUnderwriter, users]);

  // ── Header copy ──────────────────────────────────────────────────────────
  const pageTitle =
    currentRole === "Underwriter"
      ? `${currentUser.name.split(" ")[0]}'s Applications`
      : currentRole === "Manager"
      ? "My Team's Applications"
      : "All Applications";

  const pageSubtitle =
    currentRole === "Underwriter"
      ? "Manage your claimed applications."
      : currentRole === "Manager"
      ? "Monitor and inspect your team's applications and assigned underwriters."
      : "View, assign, and manage all loan applications across the system.";

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
      <div className="space-y-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Tabs Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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

        {/* Controls Row: Underwriter Selector (Admin & Manager) + Date Filter + Sort Dropdown + Search */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Underwriter Section Filter for Admin and Manager */}
            {(currentRole === "Admin" || currentRole === "Manager") && (
              <div className="relative">
                <UserCheck className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedUnderwriter}
                  onChange={(e) => handleUnderwriterChange(e.target.value)}
                  className={`pl-8 pr-8 py-1.5 text-xs rounded-xl border focus:bg-white focus:border-indigo-400 focus:outline-none appearance-none cursor-pointer font-medium ${
                    selectedUnderwriter !== "all"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                  title="Filter by Underwriter"
                >
                  <option value="all">
                    {currentRole === "Admin" ? "All Underwriters" : "All Team Underwriters"}
                  </option>
                  {currentRole === "Admin" && (
                    <option value="unassigned">Unassigned Only</option>
                  )}
                  {availableUnderwriters.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submission Date Filter */}
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  if (e.target.value !== "custom") setCustomDate("");
                }}
                className={`pl-8 pr-8 py-1.5 text-xs rounded-xl border focus:bg-white focus:border-indigo-400 focus:outline-none appearance-none cursor-pointer font-medium ${
                  dateFilter !== "all"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
                title="Filter by Submission Date"
              >
                <option value="all">All Submission Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Date</option>
              </select>
            </div>

            {/* Custom Date Input */}
            {dateFilter === "custom" && (
              <div className="relative">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="pl-3 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:outline-none text-slate-700"
                />
              </div>
            )}

            {/* Active Underwriter Pill (if selected) */}
            {selectedUnderwriterName && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                <User className="w-3 h-3" />
                Underwriter: {selectedUnderwriterName}
                <button
                  onClick={() => handleUnderwriterChange("all")}
                  className="p-0.5 hover:bg-indigo-200 rounded-full cursor-pointer text-indigo-500 hover:text-indigo-800"
                  title="Clear underwriter filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Search Box */}
          <div className="relative sm:w-64 w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search app number or underwriter"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
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
                ? "Try changing your search query or filter options."
                : selectedUnderwriter !== "all"
                ? `No applications found for ${selectedUnderwriterName}. Try selecting All Underwriters.`
                : activeTab === "my_cases"
                ? "You haven't claimed any applications yet. Go to All Apps to claim one."
                : activeTab === "my_team"
                ? "None of your direct reports have applications in this view."
                : "Try changing the active tab or date filter."}
            </p>
            {selectedUnderwriter !== "all" && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleUnderwriterChange("all")}
                className="mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear Underwriter Filter
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Application column header (sortable) */}
                  <TableHead>
                    <button
                      onClick={() => toggleSort("app")}
                      className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer group font-semibold"
                      title="Sort by Application Number"
                    >
                      <span>Application</span>
                      {getSortIcon("app")}
                    </button>
                  </TableHead>

                  <TableHead>Status</TableHead>

                  {/* Underwriter section header */}
                  <TableHead>
                    <div className="flex items-center gap-1.5">
                      <span>Underwriter</span>
                      {selectedUnderwriter !== "all" && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block"
                          title={`Filtered: ${selectedUnderwriterName}`}
                        />
                      )}
                    </div>
                  </TableHead>

                  {/* Submitted column header (sortable) */}
                  <TableHead>
                    <button
                      onClick={() => toggleSort("submitted")}
                      className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer group font-semibold"
                      title="Sort by Submitted Date"
                    >
                      <span>Submitted</span>
                      {getSortIcon("submitted")}
                    </button>
                  </TableHead>

                  {/* Claimed At column header (sortable) */}
                  <TableHead>
                    <button
                      onClick={() => toggleSort("claimed")}
                      className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer group font-semibold"
                      title="Sort by Claimed Date"
                    >
                      <span>Claimed At</span>
                      {getSortIcon("claimed")}
                    </button>
                  </TableHead>

                  {/* Elapsed Time column header (sortable) */}
                  <TableHead>
                    <button
                      onClick={() => toggleSort("elapsed")}
                      className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer group font-semibold"
                      title="Sort by Elapsed Time (Duration)"
                    >
                      <span>Elapsed Time</span>
                      {getSortIcon("elapsed")}
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
                                ? app.decision === "REJECTED"
                                  ? "error"
                                  : "success"
                                : app.status === "CLAIMED"
                                ? "info"
                                : "warning"
                            }
                            dot
                          >
                            {app.status === "OPEN"
                              ? "UNASSIGNED"
                              : app.status === "COMPLETED"
                              ? app.decision || "APPROVED"
                              : app.status}
                          </Badge>
                          {app.status !== "COMPLETED" && (
                            <div className="text-[11px] text-slate-500">
                              Risk:{" "}
                              <span className="font-medium text-slate-700">{risk.label}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Underwriter Section */}
                      <TableCell>
                        {app.claimed_by ? (
                          (currentRole === "Admin" || currentRole === "Manager") ? (
                            <button
                              onClick={() => handleUnderwriterChange(String(app.claimed_by!.id))}
                              className={`flex items-center gap-2 p-1.5 -m-1.5 rounded-xl transition-all cursor-pointer text-left group ${
                                selectedUnderwriter === String(app.claimed_by.id)
                                  ? "bg-indigo-50 border border-indigo-200"
                                  : "hover:bg-slate-100"
                              }`}
                              title={`Click to filter only ${app.claimed_by.name}'s applications`}
                            >
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 group-hover:bg-indigo-200">
                                {app.claimed_by.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {app.claimed_by.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {app.claimed_by.role}
                                </div>
                              </div>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {app.claimed_by.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-900">
                                  {app.claimed_by.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {app.claimed_by.role}
                                </div>
                              </div>
                            </div>
                          )
                        ) : (
                          (currentRole === "Admin") ? (
                            <button
                              onClick={() => handleUnderwriterChange("unassigned")}
                              className="text-xs text-amber-700 font-medium bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 cursor-pointer transition-colors"
                              title="Click to filter all unassigned applications"
                            >
                              Unassigned
                            </button>
                          ) : (
                            <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Unassigned
                            </span>
                          )
                        )}
                      </TableCell>

                      {/* Submitted */}
                      <TableCell>
                        <div className="text-xs text-slate-700 font-medium">
                          {formatShortDate(app.created_at)}
                        </div>
                      </TableCell>

                      {/* Claimed At */}
                      <TableCell>
                        <div className="text-xs text-slate-700 font-medium">
                          {app.claimed_at ? formatShortDate(app.claimed_at) : "—"}
                        </div>
                      </TableCell>

                      {/* Elapsed Time */}
                      <TableCell>
                        <div className="text-xs text-slate-700 font-semibold">
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

      {/* Claim / Assign Modal */}
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
