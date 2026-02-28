import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ExecutionRepository } from '../../domain/ports/execution-repository.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { IdGenerator } from '../../domain/ports/id-generator.js';
import type { StartExecutionCommand, ExecutionDTO } from '../dtos/index.js';
import { AgentExecution } from '../../domain/entities/agent-execution.js';
import { ExecutionId } from '../../domain/value-objects/execution-id.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import {
  type DomainError,
  ProjectNotFoundError,
  ExecutionAlreadyRunningError,
} from '../../domain/errors/index.js';
import { ExecutionMapper } from '../mappers/execution-mapper.js';

/**
 * Default token budgets by plan tier.
 */
const DEFAULT_TOKEN_BUDGETS: Record<string, number> = {
  free: 50_000,
  pro: 100_000,
  team: 200_000,
  enterprise: 500_000,
};

/**
 * Starts a new agent execution pipeline for a project.
 *
 * Guards:
 * - Project must exist
 * - No execution already running for this project
 */
export class StartExecutionUseCase {
  constructor(
    private readonly executionRepo: ExecutionRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    command: StartExecutionCommand,
    plan = 'free',
  ): Promise<Result<ExecutionDTO, DomainError>> {
    try {
      // 1. Validate VOs
      const tenantId = TenantId.create(command.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const projectId = ProjectId.create(command.projectId);
      if (projectId instanceof Error) return err(projectId as DomainError);

      // 2. Verify project exists
      const project = await this.projectRepo.findById(tenantId, projectId);
      if (!project) {
        return err(new ProjectNotFoundError(command.projectId));
      }

      // 3. Guard: no execution already running
      const running = await this.executionRepo.findRunningByProjectId(tenantId, projectId);
      if (running) {
        return err(new ExecutionAlreadyRunningError(command.projectId));
      }

      // 4. Create execution
      const id = this.idGenerator.generate('exec_');
      const executionId = ExecutionId.create(id);
      if (executionId instanceof Error) return err(executionId as DomainError);

      const tokensBudget = command.tokensBudget ?? DEFAULT_TOKEN_BUDGETS[plan] ?? 50_000;

      const execution = AgentExecution.create({
        executionId,
        projectId,
        tenantId,
        tokensBudget,
      });

      // 5. Persist
      await this.executionRepo.save(execution);

      return ok(ExecutionMapper.toDTO(execution));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
