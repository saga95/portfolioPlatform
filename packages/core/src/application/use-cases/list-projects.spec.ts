import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListProjectsUseCase } from './list-projects.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { ListProjectsQuery } from '../dtos/index.js';
import { Project } from '../../domain/entities/project.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectName } from '../../domain/value-objects/project-name.js';
import { ProjectDescription } from '../../domain/value-objects/project-description.js';

describe('ListProjectsUseCase', () => {
  let useCase: ListProjectsUseCase;
  let mockRepo: ProjectRepository;

  const tenantId = TenantId.create('tenant_abc123');
  const project1 = Project.create({
    projectId: ProjectId.create('proj_111') as ProjectId,
    tenantId: tenantId as TenantId,
    name: ProjectName.create('Project One') as ProjectName,
    description: ProjectDescription.create('First project') as ProjectDescription,
    templateId: 'tmpl-1',
  });
  const project2 = Project.create({
    projectId: ProjectId.create('proj_222') as ProjectId,
    tenantId: tenantId as TenantId,
    name: ProjectName.create('Project Two') as ProjectName,
    description: ProjectDescription.create('Second project') as ProjectDescription,
    templateId: 'tmpl-2',
  });

  const validQuery: ListProjectsQuery = {
    tenantId: 'tenant_abc123',
  };

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue({
        projects: [project1, project2],
        nextToken: undefined,
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(2),
    };
    useCase = new ListProjectsUseCase(mockRepo);
  });

  it('should return list of project DTOs', async () => {
    const result = await useCase.execute(validQuery);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.projects).toHaveLength(2);
      expect(result.value.projects[0].name).toBe('Project One');
      expect(result.value.projects[1].name).toBe('Project Two');
    }
  });

  it('should pass nextToken to repository', async () => {
    await useCase.execute({ ...validQuery, nextToken: 'cursor-abc' });

    expect(mockRepo.findByTenantId).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-abc',
    );
  });

  it('should return empty list for tenant with no projects', async () => {
    vi.mocked(mockRepo.findByTenantId).mockResolvedValue({
      projects: [],
      nextToken: undefined,
    });

    const result = await useCase.execute(validQuery);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.projects).toHaveLength(0);
    }
  });

  it('should return error for invalid tenant ID', async () => {
    const result = await useCase.execute({ tenantId: 'invalid' });

    expect(result.ok).toBe(false);
  });

  it('should forward nextToken from repository response', async () => {
    vi.mocked(mockRepo.findByTenantId).mockResolvedValue({
      projects: [project1],
      nextToken: 'next-page-token',
    });

    const result = await useCase.execute(validQuery);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextToken).toBe('next-page-token');
    }
  });
});
