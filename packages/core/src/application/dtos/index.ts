import type { ProjectStatus, AgentExecutionStatus, DeploymentStatus, SubscriptionStatus, Plan } from '@promptdeploy/shared-types';
import type { PipelineStep } from '../../domain/entities/agent-execution.js';

// ─── Command DTOs (input to use cases) ──────────────────────────────────────

export interface CreateProjectCommand {
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly templateId: string;
}

export interface GetProjectQuery {
  readonly tenantId: string;
  readonly projectId: string;
}

export interface ListProjectsQuery {
  readonly tenantId: string;
  readonly nextToken?: string;
}

export interface UpdateProjectStatusCommand {
  readonly tenantId: string;
  readonly projectId: string;
  readonly action: ProjectAction;
  readonly deployedUrl?: string; // Required for 'mark_live'
}

export type ProjectAction =
  | 'submit_for_review'
  | 'approve_spec'
  | 'start_generation'
  | 'submit_for_qa'
  | 'approve_qa'
  | 'start_deployment'
  | 'mark_live'
  | 'mark_failed';

export interface DeleteProjectCommand {
  readonly tenantId: string;
  readonly projectId: string;
}

// ─── Agent Execution Commands ───────────────────────────────────────────────

export interface StartExecutionCommand {
  readonly tenantId: string;
  readonly projectId: string;
  readonly tokensBudget?: number; // Defaults by plan
}

export interface GetExecutionQuery {
  readonly tenantId: string;
  readonly executionId: string;
}

export interface ListExecutionsQuery {
  readonly tenantId: string;
  readonly projectId: string;
  readonly nextToken?: string;
}

export type ExecutionAction =
  | 'approve'   // Resume from waiting_for_human
  | 'cancel'    // Cancel running or waiting execution
  | 'retry';    // Retry from failed

export interface UpdateExecutionCommand {
  readonly tenantId: string;
  readonly executionId: string;
  readonly action: ExecutionAction;
}

// ─── Response DTOs (output from use cases) ──────────────────────────────────

export interface ProjectDTO {
  readonly projectId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly templateId: string;
  readonly repoUrl?: string;
  readonly deployedUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectListDTO {
  readonly projects: ProjectDTO[];
  readonly nextToken?: string;
}

// ─── Agent Execution Response DTOs ──────────────────────────────────────────

export interface StepRecordDTO {
  readonly step: PipelineStep;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  readonly agentName?: string;
  readonly tokensUsed: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
}

export interface ExecutionDTO {
  readonly executionId: string;
  readonly projectId: string;
  readonly tenantId: string;
  readonly status: AgentExecutionStatus;
  readonly currentStep: PipelineStep;
  readonly tokensUsed: number;
  readonly tokensBudget: number;
  readonly progressPercent: number;
  readonly steps: StepRecordDTO[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly errorMessage?: string;
}

export interface ExecutionListDTO {
  readonly executions: ExecutionDTO[];
  readonly nextToken?: string;
}

// ─── Deployment Commands ────────────────────────────────────────────────────

export interface StartDeploymentCommand {
  readonly tenantId: string;
  readonly projectId: string;
  readonly version: string;
}

export interface GetDeploymentQuery {
  readonly tenantId: string;
  readonly deploymentId: string;
}

export interface ListDeploymentsQuery {
  readonly tenantId: string;
  readonly projectId: string;
  readonly nextToken?: string;
}

export type DeploymentAction =
  | 'start_bootstrap'
  | 'start_deploy'
  | 'start_verification'
  | 'mark_succeeded'
  | 'mark_failed'
  | 'start_rollback'
  | 'retry';

export interface UpdateDeploymentCommand {
  readonly tenantId: string;
  readonly deploymentId: string;
  readonly action: DeploymentAction;
  readonly deployedUrl?: string;    // Required for 'mark_succeeded'
  readonly errorMessage?: string;   // Required for 'mark_failed'
}

// ─── Deployment Response DTOs ───────────────────────────────────────────────

export interface DeploymentDTO {
  readonly deploymentId: string;
  readonly projectId: string;
  readonly tenantId: string;
  readonly version: string;
  readonly status: DeploymentStatus;
  readonly logs: string[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly errorMessage?: string;
  readonly deployedUrl?: string;
}

export interface DeploymentListDTO {
  readonly deployments: DeploymentDTO[];
  readonly nextToken?: string;
}

// ─── Billing / Subscription Commands ────────────────────────────────────────

export interface CreateSubscriptionCommand {
  readonly tenantId: string;
  readonly plan: Plan;
}

export interface GetSubscriptionQuery {
  readonly tenantId: string;
  readonly subscriptionId: string;
}

export interface ListSubscriptionsQuery {
  readonly tenantId: string;
  readonly nextToken?: string;
}

export interface CancelSubscriptionCommand {
  readonly tenantId: string;
  readonly subscriptionId: string;
}

export interface HandlePayHereWebhookCommand {
  readonly merchantId: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly subscriptionId?: string;
  readonly payhereAmount: string;
  readonly payhereCurrency: string;
  readonly statusCode: string;
  readonly md5sig: string;
  readonly messageType?: string;
  readonly itemRecStatus?: string;
  readonly itemRecDateNext?: string;
  readonly custom1?: string;
  readonly custom2?: string;
}

/**
 * Checkout session data returned to the frontend
 * so it can redirect the user to PayHere.
 */
export interface CheckoutSessionDTO {
  readonly subscriptionId: string;
  readonly actionUrl: string;
  readonly params: Record<string, string>;
}

// ─── Billing / Subscription Response DTOs ───────────────────────────────────

export interface SubscriptionDTO {
  readonly subscriptionId: string;
  readonly tenantId: string;
  readonly payhereSubscriptionId?: string;
  readonly plan: Plan;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancelledAt?: string;
}

export interface SubscriptionListDTO {
  readonly subscriptions: SubscriptionDTO[];
  readonly nextToken?: string;
}
