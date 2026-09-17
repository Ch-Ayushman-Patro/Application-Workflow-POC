import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  getApplications, 
  getApplication, 
  claimApplication, 
  completeApplication, 
  decideApplication,
  getTimeline, 
  getTasks, 
  completeTask, 
  getUsers, 
  runWorkflow, 
  simulateInflow, 
  resetAndSeed, 
  getAnalyticsSummary 
} from '../services/api';
import { queryClient, queryKeys, cacheConfig } from '../services/queryClient';

// ==========================================
// Centralized Query Hooks
// ==========================================

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: getApplications,
    ...cacheConfig.applications,
  });
}

export function useApplication(id?: number) {
  return useQuery({
    queryKey: queryKeys.application(id!),
    queryFn: () => getApplication(id!),
    enabled: typeof id === 'number' && !isNaN(id) && id > 0,
    ...cacheConfig.applicationDetail,
  });
}

export function useTimeline(id?: number) {
  return useQuery({
    queryKey: queryKeys.timeline(id!),
    queryFn: () => getTimeline(id!),
    enabled: typeof id === 'number' && !isNaN(id) && id > 0,
    ...cacheConfig.applicationDetail,
  });
}

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: getTasks,
    ...cacheConfig.tasks,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: getUsers,
    ...cacheConfig.users,
  });
}

/**
 * Analytics query - STRICTLY gated to Admin role via `enabled` parameter.
 * Non-admin roles should pass `enabled: false` to guarantee no HTTP call is ever made.
 */
export function useAnalyticsSummary(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: getAnalyticsSummary,
    enabled: isEnabled,
    ...cacheConfig.analytics,
  });
}

// ==========================================
// Targeted Mutation Hooks
// ==========================================

export function useClaimApplication() {
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) => claimApplication(id, userId),
    onSuccess: (_, variables) => {
      // Invalidate only the affected resources: application list, specific detail, timeline, and tasks
      queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      queryClient.invalidateQueries({ queryKey: queryKeys.application(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
}

export function useCompleteApplication() {
  return useMutation({
    mutationFn: (variables: { id: number; actorId?: number } | number) => {
      if (typeof variables === 'number') {
        return completeApplication(variables);
      }
      return completeApplication(variables.id, variables.actorId);
    },
    onSuccess: (_, variables) => {
      const id = typeof variables === 'number' ? variables : variables.id;
      // Invalidate applications, affected detail/timeline, tasks, and analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      queryClient.invalidateQueries({ queryKey: queryKeys.application(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

export function useDecideApplication() {
  return useMutation({
    mutationFn: ({ id, decision, actorId }: { id: number; decision: 'APPROVED' | 'REJECTED'; actorId?: number }) =>
      decideApplication(id, decision, actorId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      queryClient.invalidateQueries({ queryKey: queryKeys.application(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

export function useCompleteTask() {
  return useMutation({
    mutationFn: (variables: { id: number; actorId?: number } | number) => {
      if (typeof variables === 'number') {
        return completeTask(variables);
      }
      return completeTask(variables.id, variables.actorId);
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      if (task?.application_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.application(task.application_id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.timeline(task.application_id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

export function useRunWorkflow() {
  return useMutation({
    mutationFn: () => runWorkflow(),
    onSuccess: () => {
      // Prioritize list-level queries (applications, tasks, analytics)
      queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

export function useSimulateInflow() {
  return useMutation({
    mutationFn: ({ count = 3, runWorkflow = true }: { count?: number; runWorkflow?: boolean } = {}) => 
      simulateInflow(count, runWorkflow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

export function useResetAndSeed() {
  return useMutation({
    mutationFn: () => resetAndSeed(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

