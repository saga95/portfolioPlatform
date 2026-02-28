import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { DeploymentRepository } from '../../domain/ports/deployment-repository.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { IdGenerator } from '../../domain/ports/id-generator.js';
import type { StartDeploymentCommand, DeploymentDTO } from '../dtos/index.js';
import { Deployment } from '../../domain/entities/deployment.js';
import { DeploymentId } from '../../domain/value-objects/deployment-id.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import {
  type DomainError,
  ProjectNotFoundError,
} from '../../domain/errors/index.js';
import { DeploymentMapper } from '../mappers/deployment-mapper.js';

/**
 * Starts a new deployment for a project.
 *
 * Guards:
 * - Project must exist
 */
export class StartDeploymentUseCase {
  constructor(
    private readonly deploymentRepo: DeploymentRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    command: StartDeploymentCommand,
  ): Promise<Result<DeploymentDTO, DomainError>> {
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

      // 3. Generate ID and create deployment
      const id = this.idGenerator.generate('deploy_');
      const deploymentId = DeploymentId.create(id);
      if (deploymentId instanceof Error) return err(deploymentId as DomainError);

      const deployment = Deployment.create({
        deploymentId,
        projectId,
        tenantId,
        version: command.version,
      });

      // 4. Persist
      await this.deploymentRepo.save(deployment);

      return ok(DeploymentMapper.toDTO(deployment));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
