import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { ListProjectsQuery, ProjectListDTO } from '../dtos/index.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import type { DomainError } from '../../domain/errors/index.js';
import { ProjectMapper } from '../mappers/project-mapper.js';

/**
 * Lists all projects for a tenant with optional pagination.
 */
export class ListProjectsUseCase {
  constructor(private readonly projectRepo: ProjectRepository) {}

  async execute(query: ListProjectsQuery): Promise<Result<ProjectListDTO, DomainError>> {
    try {
      // 1. Validate tenant ID
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      // 2. Fetch
      const result = await this.projectRepo.findByTenantId(tenantId, query.nextToken);

      // 3. Map to DTOs
      return ok({
        projects: result.projects.map(ProjectMapper.toDTO),
        nextToken: result.nextToken,
      });
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
