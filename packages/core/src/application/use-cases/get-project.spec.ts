import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetProjectUseCase } from './get-project.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { GetProjectQuery } from '../dtos/index.js';
import { Project } from '../../domain/entities/project.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectName } from '../../domain/value-objects/project-name.js';
import { ProjectDescription } from '../../domain/value-objects/project-description.js';

describe('GetProjectUseCase', () => {
  let useCase: GetProjectUseCase;
  let mockRepo: ProjectRepository;

  const tenantId = TenantId.create('tenant_abc123');
  const projectId = ProjectId.create('proj_abc123');
  const existingProject = Project.create({
    projectId: projectId as ProjectId,
    tenantId: tenantId as TenantId,
    name: ProjectName.create('Test Project') as ProjectName,
    description: ProjectDescription.create('A test') as ProjectDescription,
    templateId: 'tmpl-1',
  });

  const validQuery: GetProjectQuery = {
    tenantId: 'tenant_abc123',
    projectId: 'proj_abc123',
  };

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(existingProject),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(0),
    };
    useCase = new GetProjectUseCase(mockRepo);
  });

  it('should return a project DTO when found', async () => {
    const result = await useCase.execute(validQuery);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.projectId).toBe('proj_abc123');
      expect(result.value.tenantId).toBe('tenant_abc123');
      expect(result.value.name).toBe('Test Project');
      expect(result.value.status).toBe('draft');
    }
  });

  it('should return error when project not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const result = await useCase.execute(validQuery);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROJECT_NOT_FOUND');
    }
  });

  it('should return error for invalid tenant ID format', async () => {
    const result = await useCase.execute({ ...validQuery, tenantId: 'bad' });

    expect(result.ok).toBe(false);
  });

  it('should return error for invalid project ID format', async () => {
    const result = await useCase.execute({ ...validQuery, projectId: 'bad' });

    expect(result.ok).toBe(false);
  });
});
