import type { ProjectStatus, AgentExecutionStatus, DeploymentStatus, Plan, SubscriptionStatus } from '@promptdeploy/shared-types';
import { getIdToken } from '../auth/cognito-service';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProjectDTO {
  projectId: string;
  tenantId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  templateId: string;
  repoUrl?: string;
  deployedUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListDTO {
  projects: ProjectDTO[];
  nextToken?: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  templateId: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface StepRecordDTO {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  agentName?: string;
  tokensUsed: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ExecutionDTO {
  executionId: string;
  projectId: string;
  tenantId: string;
  status: AgentExecutionStatus;
  currentStep: string;
  tokensUsed: number;
  tokensBudget: number;
  steps: StepRecordDTO[];
  progressPercent: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ExecutionListDTO {
  executions: ExecutionDTO[];
  nextToken?: string;
}

export type ExecutionAction = 'approve' | 'cancel' | 'retry';

// ─── Deployment Types ───────────────────────────────────────────────────────

export interface DeploymentDTO {
  deploymentId: string;
  projectId: string;
  tenantId: string;
  version: string;
  status: DeploymentStatus;
  logs: string[];
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  deployedUrl?: string;
}

export interface DeploymentListDTO {
  deployments: DeploymentDTO[];
  nextToken?: string;
}

export type DeploymentAction =
  | 'start_bootstrap'
  | 'start_deploy'
  | 'start_verification'
  | 'mark_succeeded'
  | 'mark_failed'
  | 'start_rollback'
  | 'retry';

// ─── Subscription / Billing Types ───────────────────────────────────────────

export interface SubscriptionDTO {
  subscriptionId: string;
  tenantId: string;
  payhereSubscriptionId?: string;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

export interface SubscriptionListDTO {
  subscriptions: SubscriptionDTO[];
  nextToken?: string;
}

export interface CheckoutSessionDTO {
  subscriptionId: string;
  actionUrl: string;
  params: Record<string, string>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Attach JWT token when available (Cognito auth)
  const token = await getIdToken();
  if (token) {
    headers['Authorization'] = token;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }));
    throw body as ApiError;
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── API Client ─────────────────────────────────────────────────────────────

export const api = {
  projects: {
    list(tenantId: string, nextToken?: string): Promise<ProjectListDTO> {
      const params = nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : '';
      return request<ProjectListDTO>(`/projects${params}`, {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    get(tenantId: string, projectId: string): Promise<ProjectDTO> {
      return request<ProjectDTO>(`/projects/${projectId}`, {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    create(tenantId: string, input: CreateProjectInput): Promise<ProjectDTO> {
      return request<ProjectDTO>('/projects', {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify(input),
      });
    },

    updateStatus(
      tenantId: string,
      projectId: string,
      action: string,
      deployedUrl?: string,
    ): Promise<ProjectDTO> {
      return request<ProjectDTO>(`/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({ action, deployedUrl }),
      });
    },

    delete(tenantId: string, projectId: string): Promise<void> {
      return request<void>(`/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': tenantId },
      });
    },
  },

  executions: {
    list(tenantId: string, projectId: string, nextToken?: string): Promise<ExecutionListDTO> {
      const params = nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : '';
      return request<ExecutionListDTO>(`/projects/${projectId}/executions${params}`, {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    get(tenantId: string, executionId: string): Promise<ExecutionDTO> {
      return request<ExecutionDTO>(`/executions/${executionId}`, {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    start(tenantId: string, projectId: string): Promise<ExecutionDTO> {
      return request<ExecutionDTO>('/executions', {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({ projectId }),
      });
    },

    update(tenantId: string, executionId: string, action: ExecutionAction): Promise<ExecutionDTO> {
      return request<ExecutionDTO>(`/executions/${executionId}`, {
        method: 'PATCH',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({ action }),
      });
    },
  },

  deployments: {
    list(tenantId: string, projectId: string, nextToken?: string): Promise<DeploymentListDTO> {
      const params = nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : '';
      return request<DeploymentListDTO>(`/projects/${projectId}/deployments${params}`, {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    get(tenantId: string, deploymentId: string): Promise<DeploymentDTO> {
      return request<DeploymentDTO>(`/deployments/${deploymentId}`, {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    start(tenantId: string, projectId: string, version: string): Promise<DeploymentDTO> {
      return request<DeploymentDTO>('/deployments', {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({ projectId, version }),
      });
    },

    update(
      tenantId: string,
      deploymentId: string,
      action: DeploymentAction,
      extra?: { deployedUrl?: string; errorMessage?: string },
    ): Promise<DeploymentDTO> {
      return request<DeploymentDTO>(`/deployments/${deploymentId}`, {
        method: 'PATCH',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({ action, ...extra }),
      });
    },
  },

  subscriptions: {
    list(tenantId: string): Promise<SubscriptionListDTO> {
      return request<SubscriptionListDTO>('/subscriptions', {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    get(tenantId: string, subscriptionId: string): Promise<SubscriptionDTO> {
      return request<SubscriptionDTO>(`/subscriptions/${subscriptionId}`, {
        headers: { 'x-tenant-id': tenantId },
      });
    },

    create(tenantId: string, plan: 'pro' | 'team' | 'enterprise'): Promise<CheckoutSessionDTO> {
      return request<CheckoutSessionDTO>('/subscriptions', {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({ plan }),
      });
    },

    cancel(tenantId: string, subscriptionId: string): Promise<SubscriptionDTO> {
      return request<SubscriptionDTO>(`/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': tenantId },
      });
    },
  },
};
