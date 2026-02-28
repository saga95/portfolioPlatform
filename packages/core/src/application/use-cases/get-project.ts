import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { GetProjectQuery, ProjectDTO } from '../dtos/index.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectNotFoundError, type DomainError } from '../../domain/errors/index.js';
import { ProjectMapper } from '../mappers/project-mapper.js';

/**
 * Retrieves a single project by tenant + project ID.
 */
export class GetProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepository) {}

  async execute(query: GetProjectQuery): Promise<Result<ProjectDTO, DomainError>> {
    try {
      // 1. Validate value objects
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const projectId = ProjectId.create(query.projectId);
      if (projectId instanceof Error) return err(projectId as DomainError);

      // 2. Fetch
      const project = await this.projectRepo.findById(tenantId, projectId);
      if (!project) {
        return err(new ProjectNotFoundError(query.projectId));
      }

      // 3. Map to DTO
      return ok(ProjectMapper.toDTO(project));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
