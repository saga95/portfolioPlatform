import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateProjectUseCase } from './create-project.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { IdGenerator } from '../../domain/ports/id-generator.js';
import type { CreateProjectCommand } from '../dtos/index.js';

describe('CreateProjectUseCase', () => {
  let useCase: CreateProjectUseCase;
  let mockRepo: ProjectRepository;
  let mockIdGen: IdGenerator;

  const validCommand: CreateProjectCommand = {
    tenantId: 'tenant_abc123',
    name: 'My SaaS App',
    description: 'A project management tool',
    templateId: 'template-react-node',
  };

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(0),
    };
    mockIdGen = {
      generate: vi.fn().mockReturnValue('proj_generated123'),
    };
    useCase = new CreateProjectUseCase(mockRepo, mockIdGen);
  });

  it('should create a project and return success with DTO', async () => {
    const result = await useCase.execute(validCommand);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.projectId).toBe('proj_generated123');
      expect(result.value.tenantId).toBe('tenant_abc123');
      expect(result.value.name).toBe('My SaaS App');
      expect(result.value.description).toBe('A project management tool');
      expect(result.value.status).toBe('draft');
      expect(result.value.templateId).toBe('template-react-node');
    }
  });

  it('should call IdGenerator with "proj_" prefix', async () => {
    await useCase.execute(validCommand);
    expect(mockIdGen.generate).toHaveBeenCalledWith('proj_');
  });

  it('should save the project to the repository', async () => {
    await useCase.execute(validCommand);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should enforce project limit (max 5 for free tier)', async () => {
    vi.mocked(mockRepo.countByTenantId).mockResolvedValue(5);

    const result = await useCase.execute(validCommand, 5);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROJECT_LIMIT_EXCEEDED');
    }
  });

  it('should allow creation when under the limit', async () => {
    vi.mocked(mockRepo.countByTenantId).mockResolvedValue(4);

    const result = await useCase.execute(validCommand, 5);

    expect(result.ok).toBe(true);
  });

  it('should return error for invalid project name (empty)', async () => {
    const result = await useCase.execute({ ...validCommand, name: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBeDefined();
    }
  });

  it('should return error for invalid tenant ID', async () => {
    const result = await useCase.execute({ ...validCommand, tenantId: 'bad-id' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('TenantId');
    }
  });

  it('should return error when repository save fails', async () => {
    vi.mocked(mockRepo.save).mockRejectedValue(new Error('DB connection failed'));

    const result = await useCase.execute(validCommand);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('DB connection failed');
    }
  });
});
