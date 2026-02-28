import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteProjectUseCase } from './delete-project.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { DeleteProjectCommand } from '../dtos/index.js';
import { Project } from '../../domain/entities/project.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectName } from '../../domain/value-objects/project-name.js';
import { ProjectDescription } from '../../domain/value-objects/project-description.js';

describe('DeleteProjectUseCase', () => {
  let useCase: DeleteProjectUseCase;
  let mockRepo: ProjectRepository;

  const tenantId = TenantId.create('tenant_abc123') as TenantId;
  const projectId = ProjectId.create('proj_abc123') as ProjectId;

  const existingProject = Project.create({
    projectId,
    tenantId,
    name: ProjectName.create('To Delete') as ProjectName,
    description: ProjectDescription.create('Will be deleted') as ProjectDescription,
    templateId: 'tmpl-1',
  });

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(existingProject),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(1),
    };
    useCase = new DeleteProjectUseCase(mockRepo);
  });

  it('should delete a project successfully', async () => {
    const cmd: DeleteProjectCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('should return error when project not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const cmd: DeleteProjectCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROJECT_NOT_FOUND');
    }
  });

  it('should not allow deleting a project that is currently deploying', async () => {
    const deployingProject = existingProject
      .submitForReview()
      .approveSpec()
      .startGeneration()
      .submitForQA()
      .approveQA()
      .startDeployment();

    vi.mocked(mockRepo.findById).mockResolvedValue(deployingProject);

    const cmd: DeleteProjectCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PROJECT_TRANSITION');
    }
  });

  it('should return error for invalid tenant ID', async () => {
    const result = await useCase.execute({ tenantId: 'bad', projectId: 'proj_abc123' });

    expect(result.ok).toBe(false);
  });
});
