import { format, formatDistanceToNow } from 'date-fns';
import type { Application } from '../types';

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'MMM d, yyyy · h:mm a');
  } catch {
    return dateString;
  }
}

export function formatShortDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'MMM d, h:mm a');
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

export function getApplicationAgeHours(createdAt: string): number {
  try {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.round((now - created) / (1000 * 60 * 60)));
  } catch {
    return 0;
  }
}

export function getApplicationRisk(app: Application): {
  level: 'normal' | 'attention' | 'at_risk' | 'escalated' | 'completed';
  label: string;
  badgeVariant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'orange';
  reason: string;
} {
  if (app.status === 'COMPLETED') {
    return {
      level: 'completed',
      label: 'Completed',
      badgeVariant: 'success',
      reason: 'Case workflow completed'
    };
  }

  // Check if has open escalation tasks
  const openTasks = (app.tasks || []).filter(t => t.status === 'OPEN');
  const hasEscalation = openTasks.some(t => t.task_type === 'ESCALATION');
  if (hasEscalation) {
    return {
      level: 'escalated',
      label: 'Escalated',
      badgeVariant: 'error',
      reason: 'Escalation triggered by workflow automation'
    };
  }

  const hasFollowUp = openTasks.some(t => t.task_type === 'FOLLOW_UP');
  if (hasFollowUp) {
    return {
      level: 'at_risk',
      label: 'At Risk',
      badgeVariant: 'warning',
      reason: 'Claimed review has exceeded SLA'
    };
  }

  const hasAssignment = openTasks.some(t => t.task_type === 'ASSIGNMENT');
  if (hasAssignment || (app.status === 'OPEN' && !app.claimed_by_user_id)) {
    const age = getApplicationAgeHours(app.created_at);
    if (age > 24) {
      return {
        level: 'attention',
        label: 'Needs Assignment',
        badgeVariant: 'orange',
        reason: 'Unclaimed for more than 24 hours'
      };
    }
  }

  if (app.status === 'CLAIMED') {
    return {
      level: 'normal',
      label: 'In Progress',
      badgeVariant: 'info',
      reason: `Under review by ${app.claimed_by?.name || app.current_role || 'Agent'}`
    };
  }

  return {
    level: 'normal',
    label: 'Open',
    badgeVariant: 'default',
    reason: 'Application queued'
  };
}
