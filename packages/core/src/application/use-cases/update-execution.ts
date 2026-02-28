import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ExecutionRepository } from '../../domain/ports/execution-repository.js';
import type { UpdateExecutionCommand, ExecutionDTO } from '../dtos/index.js';
import { ExecutionId } from '../../domain/value-objects/execution-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { type DomainError, ExecutionNotFoundError } from '../../domain/errors/index.js';
import { ExecutionMapper } from '../mappers/execution-mapper.js';

/**
 * Applies an action (approve/cancel/retry) to an agent execution.
 */
export class UpdateExecutionUseCase {
  constructor(private readonly executionRepo: ExecutionRepository) {}

  async execute(
    command: UpdateExecutionCommand,
  ): Promise<Result<ExecutionDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(command.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const executionId = ExecutionId.create(command.executionId);
      if (executionId instanceof Error) return err(executionId as DomainError);

      const execution = await this.executionRepo.findById(tenantId, executionId);
      if (!execution) {
        return err(new ExecutionNotFoundError(command.executionId));
      }

      let updated = execution;
      switch (command.action) {
        case 'approve':
          updated = execution.resume();
          break;
        case 'cancel':
          updated = execution.cancel();
          break;
        case 'retry':
          updated = execution.retry();
          break;
        default: {
          const _exhaustive: never = command.action;
          return err(new Error(`Unknown action: ${_exhaustive}`) as DomainError);
        }
      }

      await this.executionRepo.save(updated);
      return ok(ExecutionMapper.toDTO(updated));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
