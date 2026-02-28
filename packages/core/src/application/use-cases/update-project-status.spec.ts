import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateProjectStatusUseCase } from './update-project-status.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { UpdateProjectStatusCommand } from '../dtos/index.js';
import { Project } from '../../domain/entities/project.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectName } from '../../domain/value-objects/project-name.js';
import { ProjectDescription } from '../../domain/value-objects/project-description.js';

describe('UpdateProjectStatusUseCase', () => {
  let useCase: UpdateProjectStatusUseCase;
  let mockRepo: ProjectRepository;

  const tenantId = TenantId.create('tenant_abc123') as TenantId;
  const projectId = ProjectId.create('proj_abc123') as ProjectId;

  function makeDraftProject(): Project {
    return Project.create({
      projectId,
      tenantId,
      name: ProjectName.create('Test Project') as ProjectName,
      description: ProjectDescription.create('Desc') as ProjectDescription,
      templateId: 'tmpl-1',
    });
  }

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(makeDraftProject()),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(0),
    };
    useCase = new UpdateProjectStatusUseCase(mockRepo);
  });

  it('should transition draft → spec_review on submit_for_review', async () => {
    const cmd: UpdateProjectStatusCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
      action: 'submit_for_review',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('spec_review');
    }
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should transition deploying → live with deployedUrl on mark_live', async () => {
    // Create a project in "deploying" state
    const deployingProject = makeDraftProject()
      .submitForReview()
      .approveSpec()
      .startGeneration()
      .submitForQA()
      .approveQA()
      .startDeployment();

    vi.mocked(mockRepo.findById).mockResolvedValue(deployingProject);

    const cmd: UpdateProjectStatusCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
      action: 'mark_live',
      deployedUrl: 'https://app.example.com',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('live');
      expect(result.value.deployedUrl).toBe('https://app.example.com');
    }
  });

  it('should return error for invalid transition', async () => {
    // Draft project — cannot approve_qa
    const cmd: UpdateProjectStatusCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
      action: 'approve_qa',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PROJECT_TRANSITION');
    }
  });

  it('should return error when project not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const cmd: UpdateProjectStatusCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
      action: 'submit_for_review',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROJECT_NOT_FOUND');
    }
  });

  it('should return error for mark_live without deployedUrl', async () => {
    const deployingProject = makeDraftProject()
      .submitForReview()
      .approveSpec()
      .startGeneration()
      .submitForQA()
      .approveQA()
      .startDeployment();

    vi.mocked(mockRepo.findById).mockResolvedValue(deployingProject);

    const cmd: UpdateProjectStatusCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
      action: 'mark_live',
      // deployedUrl intentionally missing
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(false);
  });

  it('should handle mark_failed for any failing state', async () => {
    const cmd: UpdateProjectStatusCommand = {
      tenantId: 'tenant_abc123',
      projectId: 'proj_abc123',
      action: 'mark_failed',
    };

    const result = await useCase.execute(cmd);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('failed');
    }
  });
});
