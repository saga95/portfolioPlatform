import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ExecutionRepository } from '../../domain/ports/execution-repository.js';
import type { ListExecutionsQuery, ExecutionListDTO } from '../dtos/index.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import type { DomainError } from '../../domain/errors/index.js';
import { ExecutionMapper } from '../mappers/execution-mapper.js';

/**
 * Lists agent executions for a project.
 */
export class ListExecutionsUseCase {
  constructor(private readonly executionRepo: ExecutionRepository) {}

  async execute(
    query: ListExecutionsQuery,
  ): Promise<Result<ExecutionListDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const projectId = ProjectId.create(query.projectId);
      if (projectId instanceof Error) return err(projectId as DomainError);

      const result = await this.executionRepo.findByProjectId(
        tenantId,
        projectId,
        query.nextToken,
      );

      return ok({
        executions: result.executions.map(ExecutionMapper.toDTO),
        nextToken: result.nextToken,
      });
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
