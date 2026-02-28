import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StartExecutionUseCase } from './start-execution.js';
import type { ExecutionRepository } from '../../domain/ports/execution-repository.js';
import type { ProjectRepository } from '../../domain/ports/project-repository.js';
import type { IdGenerator } from '../../domain/ports/id-generator.js';
import type { StartExecutionCommand } from '../dtos/index.js';
import { Project } from '../../domain/entities/project.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { ProjectName } from '../../domain/value-objects/project-name.js';
import { ProjectDescription } from '../../domain/value-objects/project-description.js';

function makeMockProject() {
  return Project.create({
    projectId: ProjectId.create('proj_abc'),
    tenantId: TenantId.create('tenant_xyz'),
    name: ProjectName.create('Test App'),
    description: ProjectDescription.create('A test app'),
    templateId: 'template-react-node',
  });
}

describe('StartExecutionUseCase', () => {
  let useCase: StartExecutionUseCase;
  let mockExecRepo: ExecutionRepository;
  let mockProjectRepo: ProjectRepository;
  let mockIdGen: IdGenerator;

  const validCommand: StartExecutionCommand = {
    tenantId: 'tenant_xyz',
    projectId: 'proj_abc',
  };

  beforeEach(() => {
    mockExecRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue({ executions: [], nextToken: undefined }),
      findRunningByProjectId: vi.fn().mockResolvedValue(null),
    };
    mockProjectRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(makeMockProject()),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(1),
    };
    mockIdGen = {
      generate: vi.fn().mockReturnValue('exec_gen123'),
    };
    useCase = new StartExecutionUseCase(mockExecRepo, mockProjectRepo, mockIdGen);
  });

  it('should start an execution and return success DTO', async () => {
    const result = await useCase.execute(validCommand);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.executionId).toBe('exec_gen123');
      expect(result.value.projectId).toBe('proj_abc');
      expect(result.value.tenantId).toBe('tenant_xyz');
      expect(result.value.status).toBe('running');
      expect(result.value.currentStep).toBe('requirement_analysis');
      expect(result.value.tokensUsed).toBe(0);
    }
  });

  it('should use default free tier token budget', async () => {
    const result = await useCase.execute(validCommand);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tokensBudget).toBe(50_000);
    }
  });

  it('should use pro tier token budget when specified', async () => {
    const result = await useCase.execute(validCommand, 'pro');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tokensBudget).toBe(100_000);
    }
  });

  it('should use custom token budget from command', async () => {
    const result = await useCase.execute({ ...validCommand, tokensBudget: 75_000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tokensBudget).toBe(75_000);
    }
  });

  it('should call IdGenerator with "exec_" prefix', async () => {
    await useCase.execute(validCommand);
    expect(mockIdGen.generate).toHaveBeenCalledWith('exec_');
  });

  it('should save the execution to the repository', async () => {
    await useCase.execute(validCommand);
    expect(mockExecRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should fail if project does not exist', async () => {
    vi.mocked(mockProjectRepo.findById).mockResolvedValue(null);
    const result = await useCase.execute(validCommand);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROJECT_NOT_FOUND');
    }
  });

  it('should fail if an execution is already running for this project', async () => {
    vi.mocked(mockExecRepo.findRunningByProjectId).mockResolvedValue(
      {} as ReturnType<typeof makeMockProject> & { status: 'running' } as never,
    );
    const result = await useCase.execute(validCommand);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EXECUTION_ALREADY_RUNNING');
    }
  });

  it('should fail with invalid tenantId', async () => {
    const result = await useCase.execute({ ...validCommand, tenantId: '' });
    expect(result.ok).toBe(false);
  });

  it('should fail with invalid projectId', async () => {
    const result = await useCase.execute({ ...validCommand, projectId: 'bad-id' });
    expect(result.ok).toBe(false);
  });
});
