import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { DeploymentRepository } from '../../domain/ports/deployment-repository.js';
import type { ListDeploymentsQuery, DeploymentListDTO } from '../dtos/index.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import type { DomainError } from '../../domain/errors/index.js';
import { DeploymentMapper } from '../mappers/deployment-mapper.js';

/**
 * Lists deployments for a project.
 */
export class ListDeploymentsUseCase {
  constructor(private readonly deploymentRepo: DeploymentRepository) {}

  async execute(
    query: ListDeploymentsQuery,
  ): Promise<Result<DeploymentListDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const projectId = ProjectId.create(query.projectId);
      if (projectId instanceof Error) return err(projectId as DomainError);

      const result = await this.deploymentRepo.findByProjectId(
        tenantId,
        projectId,
        query.nextToken,
      );

      return ok({
        deployments: result.deployments.map(DeploymentMapper.toDTO),
        nextToken: result.nextToken,
      });
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
