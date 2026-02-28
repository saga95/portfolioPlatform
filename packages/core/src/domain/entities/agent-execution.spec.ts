import { describe, it, expect } from 'vitest';
import { AgentExecution, PIPELINE_STEPS } from './agent-execution.js';
import { ExecutionId } from '../value-objects/execution-id.js';
import { ProjectId } from '../value-objects/project-id.js';
import { TenantId } from '../value-objects/tenant-id.js';

function createExecution(budget = 100_000) {
  return AgentExecution.create({
    executionId: ExecutionId.create('exec_test123'),
    projectId: ProjectId.create('proj_abc'),
    tenantId: TenantId.create('tenant_xyz'),
    tokensBudget: budget,
  });
}

describe('AgentExecution', () => {
  describe('create', () => {
    it('should start in running status', () => {
      const exec = createExecution();
      expect(exec.status).toBe('running');
    });

    it('should start on the first pipeline step', () => {
      const exec = createExecution();
      expect(exec.currentStep).toBe('requirement_analysis');
    });

    it('should start with zero tokens used', () => {
      const exec = createExecution();
      expect(exec.tokensUsed).toBe(0);
    });

    it('should initialize all pipeline steps', () => {
      const exec = createExecution();
      expect(exec.steps).toHaveLength(PIPELINE_STEPS.length);
    });

    it('should mark first step as running', () => {
      const exec = createExecution();
      expect(exec.steps[0].status).toBe('running');
      expect(exec.steps[0].startedAt).toBeDefined();
    });

    it('should mark remaining steps as pending', () => {
      const exec = createExecution();
      exec.steps.slice(1).forEach((s) => {
        expect(s.status).toBe('pending');
      });
    });

    it('should be frozen (immutable)', () => {
      const exec = createExecution();
      expect(Object.isFrozen(exec)).toBe(true);
    });
  });

  describe('recordTokenUsage', () => {
    it('should add tokens to the total', () => {
      const exec = createExecution();
      const updated = exec.recordTokenUsage(5000);
      expect(updated.tokensUsed).toBe(5000);
    });

    it('should accumulate tokens across calls', () => {
      const exec = createExecution();
      const updated = exec.recordTokenUsage(5000).recordTokenUsage(3000);
      expect(updated.tokensUsed).toBe(8000);
    });

    it('should track tokens per step', () => {
      const exec = createExecution();
      const updated = exec.recordTokenUsage(5000);
      expect(updated.steps[0].tokensUsed).toBe(5000);
    });

    it('should throw when budget is exceeded', () => {
      const exec = createExecution(1000);
      expect(() => exec.recordTokenUsage(1001)).toThrow('Token budget exceeded');
    });
  });

  describe('completeCurrentStep', () => {
    it('should advance to the next step', () => {
      const exec = createExecution();
      const next = exec.completeCurrentStep();
      expect(next.currentStep).toBe(PIPELINE_STEPS[1]);
    });

    it('should mark previous step as completed', () => {
      const exec = createExecution();
      const next = exec.completeCurrentStep();
      expect(next.steps[0].status).toBe('completed');
      expect(next.steps[0].completedAt).toBeDefined();
    });

    it('should mark next step as running', () => {
      const exec = createExecution();
      const next = exec.completeCurrentStep();
      expect(next.steps[1].status).toBe('running');
      expect(next.steps[1].startedAt).toBeDefined();
    });

    it('should complete the execution on the last step', () => {
      let exec = createExecution();
      // Advance through all steps
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        exec = exec.completeCurrentStep();
      }
      expect(exec.status).toBe('completed');
      expect(exec.completedAt).toBeDefined();
    });

    it('should report progress percent', () => {
      const exec = createExecution();
      expect(exec.progressPercent).toBe(0);
      const afterOne = exec.completeCurrentStep();
      expect(afterOne.progressPercent).toBe(Math.round(100 / PIPELINE_STEPS.length));
    });
  });

  describe('waitForHuman', () => {
    it('should transition from running to waiting_for_human', () => {
      const exec = createExecution();
      const paused = exec.waitForHuman();
      expect(paused.status).toBe('waiting_for_human');
    });

    it('should preserve current step', () => {
      const exec = createExecution();
      const paused = exec.waitForHuman();
      expect(paused.currentStep).toBe(exec.currentStep);
    });
  });

  describe('resume', () => {
    it('should transition from waiting_for_human to running', () => {
      const exec = createExecution().waitForHuman();
      const resumed = exec.resume();
      expect(resumed.status).toBe('running');
    });

    it('should throw when not waiting_for_human', () => {
      const exec = createExecution(); // already running
      expect(() => exec.resume()).toThrow('Invalid');
    });
  });

  describe('fail', () => {
    it('should transition to failed with error message', () => {
      const exec = createExecution();
      const failed = exec.fail('LLM timeout');
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('LLM timeout');
      expect(failed.completedAt).toBeDefined();
    });

    it('should mark current step as failed', () => {
      const exec = createExecution();
      const failed = exec.fail('out of memory');
      expect(failed.steps[0].status).toBe('failed');
      expect(failed.steps[0].error).toBe('out of memory');
    });
  });

  describe('cancel', () => {
    it('should cancel from running', () => {
      const exec = createExecution();
      const cancelled = exec.cancel();
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.completedAt).toBeDefined();
    });

    it('should cancel from waiting_for_human', () => {
      const exec = createExecution().waitForHuman();
      const cancelled = exec.cancel();
      expect(cancelled.status).toBe('cancelled');
    });

    it('should not cancel from completed', () => {
      let exec = createExecution();
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        exec = exec.completeCurrentStep();
      }
      expect(() => exec.cancel()).toThrow('Invalid');
    });
  });

  describe('retry', () => {
    it('should retry from failed', () => {
      const exec = createExecution().fail('temporary error');
      const retried = exec.retry();
      expect(retried.status).toBe('running');
      expect(retried.errorMessage).toBeUndefined();
    });

    it('should re-mark the failed step as running', () => {
      const exec = createExecution().fail('temporary error');
      const retried = exec.retry();
      expect(retried.steps[0].status).toBe('running');
    });

    it('should not retry from running', () => {
      const exec = createExecution();
      expect(() => exec.retry()).toThrow('Invalid');
    });
  });

  describe('queries', () => {
    it('should report terminal state correctly', () => {
      expect(createExecution().isTerminal).toBe(false);
      expect(createExecution().fail('err').isTerminal).toBe(true);
      expect(createExecution().cancel().isTerminal).toBe(true);
    });

    it('should report token budget remaining', () => {
      const exec = createExecution(10000).recordTokenUsage(3000);
      expect(exec.tokenBudgetRemaining).toBe(7000);
    });

    it('should report token budget percentage', () => {
      const exec = createExecution(10000).recordTokenUsage(5000);
      expect(exec.tokenBudgetPercent).toBe(50);
    });
  });

  describe('reconstitute', () => {
    it('should rebuild from persisted props', () => {
      const exec = AgentExecution.reconstitute({
        executionId: ExecutionId.create('exec_rebuild'),
        projectId: ProjectId.create('proj_abc'),
        tenantId: TenantId.create('tenant_xyz'),
        status: 'waiting_for_human',
        currentStep: 'spec_review',
        tokensUsed: 12000,
        tokensBudget: 100000,
        steps: PIPELINE_STEPS.map((step) => ({
          step,
          status: step === 'requirement_analysis' ? 'completed' as const : 'pending' as const,
          tokensUsed: step === 'requirement_analysis' ? 12000 : 0,
        })),
        startedAt: '2026-02-20T00:00:00Z',
      });
      expect(exec.status).toBe('waiting_for_human');
      expect(exec.currentStep).toBe('spec_review');
      expect(exec.tokensUsed).toBe(12000);
    });
  });
});
