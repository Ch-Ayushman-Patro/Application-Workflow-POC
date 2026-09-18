import { useMemo } from "react";
import { useRole } from "../context/RoleContext";
import { useApplications, useTasks } from "./useWorkflowQueries";
import type { Application, Task, User } from "../types";
import { isApplicationDelayed } from "../utils/formatters";

/**
 * UserScopeData — all derived user/team views computed from the shared server cache.
 *
 * Architecture: The backend returns ALL applications and tasks globally.
 * TanStack Query caches them under ['applications'] and ['tasks'].
 * This hook derives user-specific views from that shared cache — no extra
 * network requests are made. Switching personas is instant; derived values
 * recompute from the existing cache without triggering refetches.
 */
export interface UserScopeData {
  // ── Applications ─────────────────────────────────────────────────────────
  /** Apps claimed by the currently active user */
  myApplications: Application[];
  /** Apps claimed by any of the current user's direct reports (Manager view) */
  teamApplications: Application[];
  /** All applications (global — for Admin) */
  allApplications: Application[];
  /** Unclaimed OPEN applications */
  unclaimedApplications: Application[];

  // ── Tasks ────────────────────────────────────────────────────────────────
  /** OPEN tasks assigned directly to currentUser by user ID */
  myTasks: Task[];
  /** OPEN tasks assigned to currentUser's direct reports by user ID */
  teamTasks: Task[];
  /**
   * Tasks that require action from the currently simulated user.
   * For Admin: ASSIGNMENT tasks (role="Admin") plus any task directly assigned to currentUser.
   * Future Admin-specific task types can be added here without changing callers.
   */
  adminActionTasks: Task[];
  /** ESCALATION tasks assigned to currentUser */
  myEscalations: Task[];
  /** All OPEN tasks (global — for Admin full view) */
  allOpenTasks: Task[];

  // ── Derived Risk Views ───────────────────────────────────────────────────
  /** My applications that are at-risk or escalated */
  myDelayedApplications: Application[];
  /** Team applications that are at-risk or escalated */
  teamDelayedApplications: Application[];
  /** All non-completed apps that are at-risk or escalated (Admin) */
  allDelayedApplications: Application[];

  // ── Hierarchy ────────────────────────────────────────────────────────────
  /** IDs of users who directly report to currentUser */
  teamMemberIds: number[];
  /** Full User objects of currentUser's direct reports */
  teamMembers: User[];
  /** The user that currentUser reports to */
  myManager: User | undefined;

  // ── Loading ──────────────────────────────────────────────────────────────
  isLoading: boolean;
}

export function useUserScope(): UserScopeData {
  const { currentUser, currentRole, allUsers } = useRole();
  const { data: applications = [], isLoading: loadingApps } = useApplications();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  // ── Hierarchy (pure computation from allUsers, instant) ──────────────────
  const teamMemberIds = useMemo(
    () => allUsers.filter((u) => u.manager_user_id === currentUser.id).map((u) => u.id),
    [allUsers, currentUser.id]
  );

  const teamMembers = useMemo(
    () => allUsers.filter((u) => u.manager_user_id === currentUser.id),
    [allUsers, currentUser.id]
  );

  const myManager = useMemo(
    () =>
      currentUser.manager_user_id
        ? allUsers.find((u) => u.id === currentUser.manager_user_id)
        : undefined,
    [allUsers, currentUser.manager_user_id]
  );

  // ── Applications (derived from shared cache, never re-fetched) ───────────
  const allApplications = applications;

  const unclaimedApplications = useMemo(
    () =>
      applications
        .filter((a) => a.status === "OPEN" && !a.claimed_by_user_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [applications]
  );

  const myApplications = useMemo(
    () => applications.filter((a) => a.claimed_by_user_id === currentUser.id),
    [applications, currentUser.id]
  );

  const teamApplications = useMemo(
    () =>
      teamMemberIds.length > 0
        ? applications.filter(
            (a) => a.claimed_by_user_id !== null && teamMemberIds.includes(a.claimed_by_user_id!)
          )
        : [],
    [applications, teamMemberIds]
  );

  // ── Tasks (derived from shared cache) ───────────────────────────────────
  const openTasks = useMemo(() => tasks.filter((t) => t.status === "OPEN"), [tasks]);
  const allOpenTasks = openTasks;

  const myTasks = useMemo(
    () => openTasks.filter((t) => t.assigned_to_user_id === currentUser.id),
    [openTasks, currentUser.id]
  );

  const teamTasks = useMemo(
    () =>
      teamMemberIds.length > 0
        ? openTasks.filter(
            (t) =>
              t.assigned_to_user_id !== null &&
              t.assigned_to_user_id !== undefined &&
              teamMemberIds.includes(t.assigned_to_user_id)
          )
        : [],
    [openTasks, teamMemberIds]
  );

  /**
   * Admin action tasks: tasks that require action from the currently active Admin user.
   * This is user-oriented: includes ASSIGNMENT tasks (assigned_to_role === "Admin")
   * AND any task with assigned_to_user_id === currentUser.id (in Application Admin has
   * direct task assignments in future scenarios).
   */
  const adminActionTasks = useMemo(() => {
    if (currentRole !== "Admin") return [];
    return openTasks.filter(
      (t) =>
        t.assigned_to_role === "Admin" ||
        t.assigned_to_user_id === currentUser.id
    );
  }, [openTasks, currentRole, currentUser.id]);

  const myEscalations = useMemo(
    () => openTasks.filter((t) => t.task_type === "ESCALATION" && t.assigned_to_user_id === currentUser.id),
    [openTasks, currentUser.id]
  );

  // ── Risk views (derived) ─────────────────────────────────────────────────
  const sortByReviewTimeDesc = (a: Application, b: Application) => {
    const timeA = a.claimed_at ? new Date(a.claimed_at).getTime() : new Date(a.created_at).getTime();
    const timeB = b.claimed_at ? new Date(b.claimed_at).getTime() : new Date(b.created_at).getTime();
    return timeA - timeB;
  };

  const myDelayedApplications = useMemo(
    () => myApplications.filter(isApplicationDelayed).sort(sortByReviewTimeDesc),
    [myApplications]
  );

  const teamDelayedApplications = useMemo(
    () => teamApplications.filter(isApplicationDelayed).sort(sortByReviewTimeDesc),
    [teamApplications]
  );

  const allDelayedApplications = useMemo(
    () => applications.filter(isApplicationDelayed).sort(sortByReviewTimeDesc),
    [applications]
  );

  return {
    // Applications
    myApplications,
    teamApplications,
    allApplications,
    unclaimedApplications,
    // Tasks
    myTasks,
    teamTasks,
    adminActionTasks,
    myEscalations,
    allOpenTasks,
    // Risk
    myDelayedApplications,
    teamDelayedApplications,
    allDelayedApplications,
    // Hierarchy
    teamMemberIds,
    teamMembers,
    myManager,
    // Loading
    isLoading: (loadingApps && applications.length === 0) || (loadingTasks && tasks.length === 0),
  };
}

