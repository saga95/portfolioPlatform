import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { DeploymentRepository } from '../../domain/ports/deployment-repository.js';
import type { UpdateDeploymentCommand, DeploymentDTO } from '../dtos/index.js';
import { DeploymentId } from '../../domain/value-objects/deployment-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { type DomainError, DeploymentNotFoundError } from '../../domain/errors/index.js';
import { DeploymentMapper } from '../mappers/deployment-mapper.js';

/**
 * Applies a lifecycle action to a deployment.
 */
export class UpdateDeploymentUseCase {
  constructor(private readonly deploymentRepo: DeploymentRepository) {}

  async execute(
    command: UpdateDeploymentCommand,
  ): Promise<Result<DeploymentDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(command.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const deploymentId = DeploymentId.create(command.deploymentId);
      if (deploymentId instanceof Error) return err(deploymentId as DomainError);

      const deployment = await this.deploymentRepo.findById(tenantId, deploymentId);
      if (!deployment) {
        return err(new DeploymentNotFoundError(command.deploymentId));
      }

      let updated = deployment;
      switch (command.action) {
        case 'start_bootstrap':
          updated = deployment.startBootstrap();
          break;
        case 'start_deploy':
          updated = deployment.startDeploy();
          break;
        case 'start_verification':
          updated = deployment.startVerification();
          break;
        case 'mark_succeeded':
          updated = deployment.markSucceeded(command.deployedUrl ?? '');
          break;
        case 'mark_failed':
          updated = deployment.markFailed(command.errorMessage ?? 'Unknown error');
          break;
        case 'start_rollback':
          updated = deployment.startRollback();
          break;
        case 'retry':
          updated = deployment.retry();
          break;
        default: {
          const _exhaustive: never = command.action;
          return err(new Error(`Unknown action: ${_exhaustive}`) as DomainError);
        }
      }

      await this.deploymentRepo.save(updated);
      return ok(DeploymentMapper.toDTO(updated));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
