import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { UpdateProjectStatusCommand, ProjectDTO, ProjectAction } from '../dtos/index.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectNotFoundError, type DomainError } from '../../domain/errors/index.js';
import { ProjectMapper } from '../mappers/project-mapper.js';
import type { Project } from '../../domain/entities/project.js';

/**
 * Transitions a project to the next status based on an action.
 */
export class UpdateProjectStatusUseCase {
  constructor(private readonly projectRepo: ProjectRepository) {}

  async execute(
    command: UpdateProjectStatusCommand,
  ): Promise<Result<ProjectDTO, DomainError>> {
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

      // 3. Validate mark_live requires deployedUrl
      if (command.action === 'mark_live' && !command.deployedUrl) {
        return err({
          name: 'ValidationError',
          message: 'deployedUrl is required for mark_live action',
          code: 'VALIDATION_ERROR',
        } as DomainError);
      }

      // 4. Apply transition
      const updated = this.applyAction(project, command.action, command.deployedUrl);

      // 5. Persist
      await this.projectRepo.save(updated);

      // 6. Map to DTO
      return ok(ProjectMapper.toDTO(updated));
    } catch (error) {
      // Domain errors (e.g., InvalidProjectTransitionError) are thrown by the entity
      if (error instanceof Error && 'code' in error) {
        return err(error as DomainError);
      }
      return err(error as DomainError);
    }
  }

  private applyAction(
    project: Project,
    action: ProjectAction,
    deployedUrl?: string,
  ): Project {
    switch (action) {
      case 'submit_for_review':
        return project.submitForReview();
      case 'approve_spec':
        return project.approveSpec();
      case 'start_generation':
        return project.startGeneration();
      case 'submit_for_qa':
        return project.submitForQA();
      case 'approve_qa':
        return project.approveQA();
      case 'start_deployment':
        return project.startDeployment();
      case 'mark_live':
        return project.markLive(deployedUrl!);
      case 'mark_failed':
        return project.markFailed();
    }
  }
}
