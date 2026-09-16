import { QueryClient } from '@tanstack/react-query';

/**
 * FlowPulse Central QueryClient
 * - Configured with in-memory caching (not localStorage).
 * - Avoids automatic refetch on window focus to prevent sudden background flashes during demo walkthroughs.
 * - Stale times provide a smooth, instant navigation experience without loading spinners when returning to fresh views.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Standardized Query Keys
 */
export const queryKeys = {
  applications: ['applications'] as const,
  application: (id: number) => ['application', id] as const,
  timeline: (id: number) => ['timeline', id] as const,
  tasks: ['tasks'] as const,
  users: ['users'] as const,
  analytics: ['analytics'] as const,
};

/**
 * Stale time (freshness) and Garbage Collection (retention) policies
 */
export const cacheConfig = {
  applications: {
    staleTime: 45 * 1000, // 45s: fresh during fast navigation across pipeline & command center
    gcTime: 5 * 60 * 1000,
  },
  applicationDetail: {
    staleTime: 45 * 1000, // 45s: prevents detail flicker
    gcTime: 5 * 60 * 1000,
  },
  tasks: {
    staleTime: 45 * 1000, // 45s: shared between sidebar badge and tasks page
    gcTime: 5 * 60 * 1000,
  },
  analytics: {
    staleTime: 90 * 1000, // 1.5 min: executive overview metrics
    gcTime: 10 * 60 * 1000,
  },
  users: {
    staleTime: 15 * 60 * 1000, // 15 min: organizational directory is mostly static
    gcTime: 30 * 60 * 1000,
  },
};

