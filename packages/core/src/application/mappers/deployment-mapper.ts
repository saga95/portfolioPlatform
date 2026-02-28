import type { Deployment } from '../../domain/entities/deployment.js';
import type { DeploymentDTO } from '../dtos/index.js';

/**
 * Maps between Deployment domain entity and DeploymentDTO.
 */
export class DeploymentMapper {
  static toDTO(deployment: Deployment): DeploymentDTO {
    return {
      deploymentId: deployment.deploymentId.value,
      projectId: deployment.projectId.value,
      tenantId: deployment.tenantId.value,
      version: deployment.version,
      status: deployment.status,
      logs: [...deployment.logs],
      startedAt: deployment.startedAt,
      completedAt: deployment.completedAt,
      errorMessage: deployment.errorMessage,
      deployedUrl: deployment.deployedUrl,
    };
  }
}
