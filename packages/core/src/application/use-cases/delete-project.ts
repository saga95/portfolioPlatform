import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { DeleteProjectCommand } from '../dtos/index.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import {
  ProjectNotFoundError,
  InvalidProjectTransitionError,
  type DomainError,
} from '../../domain/errors/index.js';

/** Statuses that cannot be deleted (active operation in progress). */
const NON_DELETABLE_STATUSES = new Set(['deploying', 'live']);

/**
 * Deletes (soft-delete) a project.
 * Projects that are currently deploying or live cannot be deleted.
 */
export class DeleteProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepository) {}

  async execute(command: DeleteProjectCommand): Promise<Result<void, DomainError>> {
    try {
      // 1. Validate value objects
      const tenantId = TenantId.create(command.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const projectId = ProjectId.create(command.projectId);
      if (projectId instanceof Error) return err(projectId as DomainError);

      // 2. Fetch existing project
      const project = await this.projectRepo.findById(tenantId, projectId);
      if (!project) {
        return err(new ProjectNotFoundError(command.projectId));
      }

      // 3. Guard against deleting active projects
      if (NON_DELETABLE_STATUSES.has(project.status)) {
        return err(
          new InvalidProjectTransitionError(project.status, 'deleted'),
        );
      }

      // 4. Delete
      await this.projectRepo.delete(tenantId, projectId);

      return ok(undefined);
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
