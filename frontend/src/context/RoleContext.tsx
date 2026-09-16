import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import type { User, UserRole } from "../types";
import { useUsers } from "../hooks/useWorkflowQueries";
import { queryClient, queryKeys } from "../services/queryClient";

/**
 * DEMO ROLE SIMULATION ONLY:
 * This context simulates different organizational roles (Admin, Manager, Claimed Officer)
 * for testing and demonstration purposes.
 * It is NOT an authentication or authorization system and does not enforce security boundaries.
 */

interface RoleContextType {
  currentUser: User;
  currentRole: UserRole;
  allUsers: User[];
  /** IDs of users whose manager_user_id === currentUser.id */
  teamMemberIds: number[];
  /** The User object that currentUser reports to (if any) */
  myManager: User | undefined;
  setCurrentUser: (user: User) => void;
  switchRoleUser: (userId: number) => void;
  refreshUsers: () => Promise<void>;
}

const DEFAULT_USERS: User[] = [
  { id: 25, name: "Alice Admin", role: "Admin" },
  { id: 26, name: "Diana Manager", role: "Manager", manager_user_id: 25 },
  { id: 27, name: "Bob Officer", role: "Claimed Officer", manager_user_id: 26 },
  { id: 28, name: "Charlie Officer", role: "Claimed Officer", manager_user_id: 26 },
];

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const STORAGE_KEY = "flowpulse_demo_simulated_user_id";

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Leverage TanStack Query for users directory (cached for 15 minutes, no loop)
  const { data: fetchedUsers } = useUsers();

  const effectiveUsers: User[] = useMemo(() => {
    return fetchedUsers && fetchedUsers.length > 0 ? fetchedUsers : DEFAULT_USERS;
  }, [fetchedUsers]);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  const currentUser = useMemo(() => {
    if (selectedUserId) {
      const match = effectiveUsers.find((u) => u.id === selectedUserId);
      if (match) return match;
    }
    return effectiveUsers.find((u) => u.role === "Admin") || effectiveUsers[0];
  }, [selectedUserId, effectiveUsers]);

  const handleSetCurrentUser = useCallback((user: User) => {
    setSelectedUserId(user.id);
    localStorage.setItem(STORAGE_KEY, String(user.id));
  }, []);

  const switchRoleUser = useCallback((userId: number) => {
    const target = effectiveUsers.find((u) => u.id === userId);
    if (target) {
      handleSetCurrentUser(target);
    }
  }, [effectiveUsers, handleSetCurrentUser]);

  const refreshUsers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.users });
  }, []);

  const currentRole: UserRole = (currentUser.role as UserRole) || "Admin";

  // ── Derived hierarchy ─────────────────────────────────────────────────────
  const teamMemberIds = useMemo(
    () => effectiveUsers.filter((u) => u.manager_user_id === currentUser.id).map((u) => u.id),
    [effectiveUsers, currentUser.id]
  );

  const myManager = useMemo(
    () =>
      currentUser.manager_user_id
        ? effectiveUsers.find((u) => u.id === currentUser.manager_user_id)
        : undefined,
    [effectiveUsers, currentUser.manager_user_id]
  );

  const contextValue = useMemo(() => ({
    currentUser,
    currentRole,
    allUsers: effectiveUsers,
    teamMemberIds,
    myManager,
    setCurrentUser: handleSetCurrentUser,
    switchRoleUser,
    refreshUsers,
  }), [currentUser, currentRole, effectiveUsers, teamMemberIds, myManager, handleSetCurrentUser, switchRoleUser, refreshUsers]);

  return (
    <RoleContext.Provider value={contextValue}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
};
