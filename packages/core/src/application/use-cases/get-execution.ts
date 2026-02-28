import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ExecutionRepository } from '../../domain/ports/execution-repository.js';
import type { GetExecutionQuery, ExecutionDTO } from '../dtos/index.js';
import { ExecutionId } from '../../domain/value-objects/execution-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { type DomainError, ExecutionNotFoundError } from '../../domain/errors/index.js';
import { ExecutionMapper } from '../mappers/execution-mapper.js';

/**
 * Retrieves a single agent execution by ID.
 */
export class GetExecutionUseCase {
  constructor(private readonly executionRepo: ExecutionRepository) {}

  async execute(
    query: GetExecutionQuery,
  ): Promise<Result<ExecutionDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const executionId = ExecutionId.create(query.executionId);
      if (executionId instanceof Error) return err(executionId as DomainError);

      const execution = await this.executionRepo.findById(tenantId, executionId);
      if (!execution) {
        return err(new ExecutionNotFoundError(query.executionId));
      }

      return ok(ExecutionMapper.toDTO(execution));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
