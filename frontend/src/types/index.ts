export type UserRole = "Admin" | "Manager" | "Underwriter";

export interface User {
    id: number;
    name: string;
    role: UserRole | string;
    manager_user_id?: number;
}

export interface Task {
    id: number;
    application_id: number;
    task_type: string;
    title: string;
    description: string;
    assigned_to_user_id?: number;
    assigned_to_role?: string;
    status: string;
    escalation_level: number;
    created_at: string;
    completed_at?: string;
    assigned_to?: User;
}

export type ApplicationDecision = "APPROVED" | "REJECTED";

export interface Application {
    id: number;
    application_number: string;
    status: string;
    decision?: ApplicationDecision | string | null;
    current_role?: string;
    current_stage?: string;
    claimed_by_user_id?: number;
    claimed_at?: string;
    created_at: string;
    completed_at?: string;
    claimed_by?: User;
    tasks: Task[];
}

export interface ApplicationEvent {
    id: number;
    application_id: number;
    event_type: string;
    timestamp: string;
    actor_id?: number;
    details?: string;
}


export interface WorkflowRunResponse {
    applications_checked: number;
    tasks_created: number;
    tasks_already_existing: number;
    escalations_created: number;
}

export interface SimulationResponse {
    cases_created: number;
    application_numbers: string[];
    workflow_stats: WorkflowRunResponse;
}

export interface AnalyticsOverview {
    total_applications: number;
    active_applications: number;
    unassigned_applications: number;
    delayed_applications: number;
    escalated_applications: number;
    approved_applications: number;
    rejected_applications: number;
}

export interface AnalyticsTime {
    avg_total_elapsed_hours: number;
    avg_queue_wait_hours: number;
    avg_review_duration_hours: number;
    queue_waiting_percentage: number;
    active_review_percentage: number;
}

export interface DelayContributor {
    application_id: number;
    application_number: string;
    stage: string;
    underwriter?: string;
    elapsed_time_hours: number;
    sla_excess_hours: number;
    sla_state: string;
}

export interface AnalyticsSla {
    assignment_delayed_count: number;
    review_delayed_count: number;
    escalated_count: number;
    assignment_sla_excess_hours: number;
    review_sla_excess_hours: number;
    critical_excess_hours: number;
    delay_contributors: DelayContributor[];
}

export interface WorkloadItem {
    user_id: number;
    name: string;
    active_applications: number;
    delayed_applications: number;
    escalated_applications: number;
    avg_review_hours: number;
    oldest_active_review_hours?: number;
}

export interface AnalyticsWorkload {
    underwriters: WorkloadItem[];
}

export interface TrendDataPoint {
    date: string;
    submitted: number;
    approved: number;
    rejected: number;
    avg_queue_wait_hours: number;
    avg_review_hours: number;
    delayed: number;
    escalated: number;
}

export interface AnalyticsTrends {
    data: TrendDataPoint[];
}

export interface AnalyticsInsight {
    type: string;
    severity: string;
    stage?: string;
    message: string;
    evidence: string;
    affected_count?: number;
    target_url?: string;
}

export interface AnalyticsInsightsResponse {
    primary_bottleneck?: AnalyticsInsight;
    insights: AnalyticsInsight[];
}
