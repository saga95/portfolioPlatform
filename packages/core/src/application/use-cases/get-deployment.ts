import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { DeploymentRepository } from '../../domain/ports/deployment-repository.js';
import type { GetDeploymentQuery, DeploymentDTO } from '../dtos/index.js';
import { DeploymentId } from '../../domain/value-objects/deployment-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { type DomainError, DeploymentNotFoundError } from '../../domain/errors/index.js';
import { DeploymentMapper } from '../mappers/deployment-mapper.js';

/**
 * Retrieves a single deployment by ID.
 */
export class GetDeploymentUseCase {
  constructor(private readonly deploymentRepo: DeploymentRepository) {}

  async execute(
    query: GetDeploymentQuery,
  ): Promise<Result<DeploymentDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const deploymentId = DeploymentId.create(query.deploymentId);
      if (deploymentId instanceof Error) return err(deploymentId as DomainError);

      const deployment = await this.deploymentRepo.findById(tenantId, deploymentId);
      if (!deployment) {
        return err(new DeploymentNotFoundError(query.deploymentId));
      }

      return ok(DeploymentMapper.toDTO(deployment));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
