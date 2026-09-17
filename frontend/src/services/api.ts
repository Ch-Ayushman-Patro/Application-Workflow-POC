import axios from 'axios';
import type { Application, Task, User, AnalyticsSummary, ApplicationEvent, WorkflowRunResponse } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getApplications = () => api.get<Application[]>('/applications').then(res => res.data);
export const getApplication = (id: number) => api.get<Application>(`/applications/${id}`).then(res => res.data);
export const claimApplication = (id: number, userId: number) => api.post<Application>(`/applications/${id}/claim?user_id=${userId}`).then(res => res.data);
export const completeApplication = (id: number, actorId?: number) => 
  api.post<Application>(`/applications/${id}/complete${actorId !== undefined && actorId !== null ? `?actor_id=${actorId}` : ''}`).then(res => res.data);
export const getTimeline = (id: number) => api.get<ApplicationEvent[]>(`/applications/${id}/timeline`).then(res => res.data);

export const getTasks = () => api.get<Task[]>('/tasks').then(res => res.data);
export const completeTask = (id: number, actorId?: number) => 
  api.post<Task>(`/tasks/${id}/complete${actorId !== undefined && actorId !== null ? `?actor_id=${actorId}` : ''}`).then(res => res.data);

export const getUsers = () => api.get<User[]>('/users').then(res => res.data);

export const runWorkflow = () => api.post<WorkflowRunResponse>('/workflow/run').then(res => res.data);
export const simulateInflow = (count: number = 3, runWorkflow: boolean = true) => 
  api.post<{ cases_created: number; application_numbers: string[]; workflow_stats: WorkflowRunResponse }>(
    `/demo/simulate-inflow?count=${count}&run_workflow=${runWorkflow}`
  ).then(res => res.data);

export const resetAndSeed = () => api.post('/demo/reset-and-seed').then(res => res.data);
export const getAnalyticsSummary = () => api.get<AnalyticsSummary>('/analytics/summary').then(res => res.data);
