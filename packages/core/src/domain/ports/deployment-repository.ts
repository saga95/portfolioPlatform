import type { Deployment } from '../entities/deployment.js';
import type { DeploymentId } from '../value-objects/deployment-id.js';
import type { ProjectId } from '../value-objects/project-id.js';
import type { TenantId } from '../value-objects/tenant-id.js';

/**
 * Repository port for Deployment aggregate persistence.
 * Domain defines the interface; infrastructure implements it.
 */
export interface DeploymentRepository {
  /**
   * Save a new or updated deployment.
   */
  save(deployment: Deployment): Promise<void>;

  /**
   * Find a deployment by ID within a tenant scope.
   */
  findById(tenantId: TenantId, deploymentId: DeploymentId): Promise<Deployment | null>;

  /**
   * List deployments for a project.
   */
  findByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
    nextToken?: string,
  ): Promise<DeploymentListResult>;

  /**
   * Find the currently active (in-progress) deployment for a project.
   */
  findActiveByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
  ): Promise<Deployment | null>;
}

export interface DeploymentListResult {
  readonly deployments: Deployment[];
  readonly nextToken?: string;
}
