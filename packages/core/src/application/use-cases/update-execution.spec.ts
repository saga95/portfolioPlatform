import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateExecutionUseCase } from './update-execution.js';
import type { ExecutionRepository } from '../../domain/ports/execution-repository.js';
import { AgentExecution } from '../../domain/entities/agent-execution.js';
import { ExecutionId } from '../../domain/value-objects/execution-id.js';
import { ProjectId } from '../../domain/value-objects/project-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';

function makeExecution() {
  return AgentExecution.create({
    executionId: ExecutionId.create('exec_test123'),
    projectId: ProjectId.create('proj_abc'),
    tenantId: TenantId.create('tenant_xyz'),
    tokensBudget: 100_000,
  });
}

describe('UpdateExecutionUseCase', () => {
  let useCase: UpdateExecutionUseCase;
  let mockRepo: ExecutionRepository;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(makeExecution()),
      findByProjectId: vi.fn().mockResolvedValue({ executions: [], nextToken: undefined }),
      findRunningByProjectId: vi.fn().mockResolvedValue(null),
    };
    useCase = new UpdateExecutionUseCase(mockRepo);
  });

  describe('cancel', () => {
    it('should cancel a running execution', async () => {
      const result = await useCase.execute({
        tenantId: 'tenant_xyz',
        executionId: 'exec_test123',
        action: 'cancel',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('cancelled');
      }
    });

    it('should save the updated execution', async () => {
      await useCase.execute({
        tenantId: 'tenant_xyz',
        executionId: 'exec_test123',
        action: 'cancel',
      });
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('approve (resume)', () => {
    it('should resume a waiting execution', async () => {
      const waiting = makeExecution().waitForHuman();
      vi.mocked(mockRepo.findById).mockResolvedValue(waiting);

      const result = await useCase.execute({
        tenantId: 'tenant_xyz',
        executionId: 'exec_test123',
        action: 'approve',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('running');
      }
    });

    it('should fail if execution is not waiting', async () => {
      // Execution is running, not waiting — approve should fail
      const result = await useCase.execute({
        tenantId: 'tenant_xyz',
        executionId: 'exec_test123',
        action: 'approve',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('retry', () => {
    it('should retry a failed execution', async () => {
      const failed = makeExecution().fail('timeout');
      vi.mocked(mockRepo.findById).mockResolvedValue(failed);

      const result = await useCase.execute({
        tenantId: 'tenant_xyz',
        executionId: 'exec_test123',
        action: 'retry',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('running');
      }
    });
  });

  describe('not found', () => {
    it('should return error if execution not found', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute({
        tenantId: 'tenant_xyz',
        executionId: 'exec_missing',
        action: 'cancel',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXECUTION_NOT_FOUND');
      }
    });
  });
});
