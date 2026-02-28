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
