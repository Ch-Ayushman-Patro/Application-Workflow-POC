export type UserRole = "Admin" | "Manager" | "Claimed Officer";

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

export interface Application {
    id: number;
    application_number: string;
    status: string;
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

export interface AnalyticsSummary {
    total_applications: number;
    open_applications: number;
    claimed_applications: number;
    completed_applications: number;
    pending_action: number;
    avg_processing_time_hours: number;
    avg_waiting_time_hours: number;
    total_escalations: number;
    bottleneck_stage: string;
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
