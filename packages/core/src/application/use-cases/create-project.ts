import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { IdGenerator } from '../../domain/ports/id-generator.js';
import type { CreateProjectCommand, ProjectDTO } from '../dtos/index.js';
import { Project } from '../../domain/entities/project.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectName } from '../../domain/value-objects/project-name.js';
import { ProjectDescription } from '../../domain/value-objects/project-description.js';
import { ProjectLimitExceededError, type DomainError } from '../../domain/errors/index.js';
import { ProjectMapper } from '../mappers/project-mapper.js';

/**
 * Creates a new project for a tenant.
 *
 * Validates inputs, enforces project limits, persists, and returns a DTO.
 */
export class CreateProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    command: CreateProjectCommand,
    projectLimit?: number,
  ): Promise<Result<ProjectDTO, DomainError>> {
    try {
      // 1. Validate value objects
      const tenantId = TenantId.create(command.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const name = ProjectName.create(command.name);
      if (name instanceof Error) return err(name as DomainError);

      const description = ProjectDescription.create(command.description);
      if (description instanceof Error) return err(description as DomainError);

      // 2. Enforce project limit
      if (projectLimit !== undefined) {
        const count = await this.projectRepo.countByTenantId(tenantId);
        if (count >= projectLimit) {
          return err(new ProjectLimitExceededError(command.tenantId, projectLimit));
        }
      }

      // 3. Generate ID and create entity
      const id = this.idGenerator.generate('proj_');
      const projectId = ProjectId.create(id);
      if (projectId instanceof Error) return err(projectId as DomainError);

      const project = Project.create({
        projectId,
        tenantId,
        name,
        description,
        templateId: command.templateId,
      });

      // 4. Persist
      await this.projectRepo.save(project);

      // 5. Map to DTO
      return ok(ProjectMapper.toDTO(project));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
