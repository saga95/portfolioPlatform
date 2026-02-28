import type { Project } from '../entities/project.js';
import type { ProjectId } from '../value-objects/project-id.js';
import type { TenantId } from '../value-objects/tenant-id.js';

/**
 * Repository port for Project aggregate persistence.
 * Domain defines the interface; infrastructure implements it.
 *
 * This follows the Ports & Adapters (Hexagonal Architecture) pattern.
 * The domain layer depends only on this interface, never on the concrete implementation.
 */
export interface ProjectRepository {
  /**
   * Save a new or updated project.
   */
  save(project: Project): Promise<void>;

  /**
   * Find a project by its ID within a tenant scope.
   */
  findById(tenantId: TenantId, projectId: ProjectId): Promise<Project | null>;

  /**
   * List all projects for a tenant.
   */
  findByTenantId(tenantId: TenantId, nextToken?: string): Promise<ProjectListResult>;

  /**
   * Delete a project (soft delete — marks as archived).
   */
  delete(tenantId: TenantId, projectId: ProjectId): Promise<void>;

  /**
   * Count all projects for a tenant (for limit enforcement).
   */
  countByTenantId(tenantId: TenantId): Promise<number>;
}

export interface ProjectListResult {
  readonly projects: Project[];
  readonly nextToken?: string;
}
