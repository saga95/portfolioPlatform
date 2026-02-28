import type { Project } from '../../domain/entities/project.js';
import type { ProjectDTO } from '../dtos/index.js';

/**
 * Maps between Project domain entity and ProjectDTO.
 * Keeps domain objects out of the API/transport layer.
 */
export class ProjectMapper {
  static toDTO(project: Project): ProjectDTO {
    return {
      projectId: project.projectId.value,
      tenantId: project.tenantId.value,
      name: project.name.value,
      description: project.description.value,
      status: project.status,
      templateId: project.templateId,
      repoUrl: project.repoUrl,
      deployedUrl: project.deployedUrl,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
