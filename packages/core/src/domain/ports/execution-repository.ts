import type { AgentExecution } from '../entities/agent-execution.js';
import type { ExecutionId } from '../value-objects/execution-id.js';
import type { ProjectId } from '../value-objects/project-id.js';
import type { TenantId } from '../value-objects/tenant-id.js';

/**
 * Repository port for AgentExecution aggregate persistence.
 * Domain defines the interface; infrastructure implements it.
 */
export interface ExecutionRepository {
  /**
   * Save a new or updated execution.
   */
  save(execution: AgentExecution): Promise<void>;

  /**
   * Find an execution by ID within a tenant scope.
   */
  findById(tenantId: TenantId, executionId: ExecutionId): Promise<AgentExecution | null>;

  /**
   * List executions for a project.
   */
  findByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
    nextToken?: string,
  ): Promise<ExecutionListResult>;

  /**
   * Find the currently running execution for a project (if any).
   */
  findRunningByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
  ): Promise<AgentExecution | null>;
}

export interface ExecutionListResult {
  readonly executions: AgentExecution[];
  readonly nextToken?: string;
}
