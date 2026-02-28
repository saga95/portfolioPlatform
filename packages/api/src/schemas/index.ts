import { z } from 'zod';

// ─── Reusable Schema Components ─────────────────────────────────────────────

const tenantIdSchema = z.string().startsWith('tenant_', 'Must start with "tenant_"');
const projectIdSchema = z.string().startsWith('proj_', 'Must start with "proj_"');

// ─── Request Schemas ────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(2000, 'Description must be at most 2000 characters').default(''),
  templateId: z.string().min(1, 'Template ID is required'),
});

export const updateProjectStatusSchema = z.object({
  action: z.enum([
    'submit_for_review',
    'approve_spec',
    'start_generation',
    'submit_for_qa',
    'approve_qa',
    'start_deployment',
    'mark_live',
    'mark_failed',
  ]),
  deployedUrl: z.string().url().optional(),
});

export const listProjectsQuerySchema = z.object({
  nextToken: z.string().optional(),
});

// ─── Path Parameter Schemas ─────────────────────────────────────────────────

export const projectPathParamsSchema = z.object({
  projectId: projectIdSchema,
});

// ─── Header Schema (tenant from Cognito authorizer) ─────────────────────────

export const tenantHeaderSchema = z.object({
  'x-tenant-id': tenantIdSchema,
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type ListProjectsQueryInput = z.infer<typeof listProjectsQuerySchema>;

// ─── Agent Execution Schemas ────────────────────────────────────────────────

const executionIdSchema = z.string().startsWith('exec_', 'Must start with "exec_"');

export const startExecutionSchema = z.object({
  projectId: projectIdSchema,
  tokensBudget: z.number().int().positive().optional(),
});

export const updateExecutionSchema = z.object({
  action: z.enum(['approve', 'cancel', 'retry']),
});

export const executionPathParamsSchema = z.object({
  executionId: executionIdSchema,
});

export const listExecutionsQuerySchema = z.object({
  nextToken: z.string().optional(),
});

export type StartExecutionInput = z.infer<typeof startExecutionSchema>;
export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>;
export type ListExecutionsQueryInput = z.infer<typeof listExecutionsQuerySchema>;

// ─── Deployment Schemas ─────────────────────────────────────────────────────

const deploymentIdSchema = z.string().startsWith('deploy_', 'Must start with "deploy_"');

export const startDeploymentSchema = z.object({
  projectId: projectIdSchema,
  version: z.string().min(1, 'Version is required'),
});

export const updateDeploymentSchema = z.object({
  action: z.enum([
    'start_bootstrap',
    'start_deploy',
    'start_verification',
    'mark_succeeded',
    'mark_failed',
    'start_rollback',
    'retry',
  ]),
  deployedUrl: z.string().url().optional(),
  errorMessage: z.string().optional(),
});

export const deploymentPathParamsSchema = z.object({
  deploymentId: deploymentIdSchema,
});

export const listDeploymentsQuerySchema = z.object({
  nextToken: z.string().optional(),
});

export type StartDeploymentInput = z.infer<typeof startDeploymentSchema>;
export type UpdateDeploymentInput = z.infer<typeof updateDeploymentSchema>;
export type ListDeploymentsQueryInput = z.infer<typeof listDeploymentsQuerySchema>;

// ─── Billing / Subscription Schemas ─────────────────────────────────────────

const subscriptionIdSchema = z.string().startsWith('sub_', 'Must start with "sub_"');

export const createSubscriptionSchema = z.object({
  plan: z.enum(['pro', 'team', 'enterprise']),
});

export const cancelSubscriptionSchema = z.object({
  // Body intentionally empty — subscriptionId comes from path params
});

export const subscriptionPathParamsSchema = z.object({
  subscriptionId: subscriptionIdSchema,
});

export const listSubscriptionsQuerySchema = z.object({
  nextToken: z.string().optional(),
});

/**
 * PayHere webhook payload schema.
 * PayHere sends application/x-www-form-urlencoded data.
 */
export const payhereWebhookSchema = z.object({
  merchant_id: z.string().min(1),
  order_id: z.string().min(1),
  payment_id: z.string().min(1),
  subscription_id: z.string().optional(),
  payhere_amount: z.string().min(1),
  payhere_currency: z.string().min(1),
  status_code: z.string().min(1),
  md5sig: z.string().min(1),
  method: z.string().optional(),
  status_message: z.string().optional(),
  custom_1: z.string().optional(),
  custom_2: z.string().optional(),
  recurring: z.string().optional(),
  message_type: z.string().optional(),
  item_recurrence: z.string().optional(),
  item_duration: z.string().optional(),
  item_rec_status: z.string().optional(),
  item_rec_date_next: z.string().optional(),
  item_rec_install_paid: z.string().optional(),
  card_holder_name: z.string().optional(),
  card_no: z.string().optional(),
  card_expiry: z.string().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type PayHereWebhookInput = z.infer<typeof payhereWebhookSchema>;
export type ListSubscriptionsQueryInput = z.infer<typeof listSubscriptionsQuerySchema>;
