import type { AgentExecutionStatus } from '@promptdeploy/shared-types';
import { ExecutionId } from '../value-objects/execution-id.js';
import { TenantId } from '../value-objects/tenant-id.js';
import { ProjectId } from '../value-objects/project-id.js';
import { InvalidExecutionTransitionError, TokenBudgetExceededError } from '../errors/index.js';

/**
 * Valid state transitions for an AgentExecution.
 */
const VALID_TRANSITIONS: Record<AgentExecutionStatus, Set<AgentExecutionStatus>> = {
  running: new Set(['waiting_for_human', 'completed', 'failed', 'cancelled']),
  waiting_for_human: new Set(['running', 'cancelled']),
  completed: new Set([]),
  failed: new Set(['running']), // Allow retry
  cancelled: new Set([]),
};

/**
 * The steps in the agent pipeline, in order.
 */
export const PIPELINE_STEPS = [
  'requirement_analysis',
  'spec_review',
  'system_design',
  'code_generation',
  'assembly',
  'qa_validation',
  'security_review',
  'repository_setup',
  'deployment',
  'verification',
] as const;

export type PipelineStep = typeof PIPELINE_STEPS[number];

export interface CreateExecutionProps {
  readonly executionId: ExecutionId;
  readonly projectId: ProjectId;
  readonly tenantId: TenantId;
  readonly tokensBudget: number;
}

export interface ReconstituteExecutionProps extends CreateExecutionProps {
  readonly status: AgentExecutionStatus;
  readonly currentStep: PipelineStep;
  readonly tokensUsed: number;
  readonly steps: StepRecord[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly errorMessage?: string;
}

/**
 * Record of a single pipeline step execution.
 */
export interface StepRecord {
  readonly step: PipelineStep;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  readonly agentName?: string;
  readonly tokensUsed: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
}

function createInitialSteps(): StepRecord[] {
  return PIPELINE_STEPS.map((step) => ({
    step,
    status: 'pending' as const,
    tokensUsed: 0,
  }));
}

/**
 * AgentExecution aggregate root.
 *
 * Manages the lifecycle of the multi-agent pipeline that transforms
 * a user prompt into a deployed SaaS application.
 *
 * State machine: running → waiting_for_human → running → completed
 *                running → failed → running (retry)
 *                running → cancelled
 *                waiting_for_human → cancelled
 *
 * All mutations return new immutable instances.
 */
export class AgentExecution {
  private constructor(
    public readonly executionId: ExecutionId,
    public readonly projectId: ProjectId,
    public readonly tenantId: TenantId,
    public readonly status: AgentExecutionStatus,
    public readonly currentStep: PipelineStep,
    public readonly tokensUsed: number,
    public readonly tokensBudget: number,
    public readonly steps: ReadonlyArray<StepRecord>,
    public readonly startedAt: string,
    public readonly completedAt: string | undefined,
    public readonly errorMessage: string | undefined,
  ) {
    Object.freeze(this);
  }

  /**
   * Factory: start a new agent execution.
   */
  static create(props: CreateExecutionProps): AgentExecution {
    const now = new Date().toISOString();
    const steps = createInitialSteps();
    // Mark first step as running
    steps[0] = { ...steps[0], status: 'running', startedAt: now };

    return new AgentExecution(
      props.executionId,
      props.projectId,
      props.tenantId,
      'running',
      PIPELINE_STEPS[0],
      0,
      props.tokensBudget,
      steps,
      now,
      undefined,
      undefined,
    );
  }

  /**
   * Reconstitute from persistence.
   */
  static reconstitute(props: ReconstituteExecutionProps): AgentExecution {
    return new AgentExecution(
      props.executionId,
      props.projectId,
      props.tenantId,
      props.status,
      props.currentStep,
      props.tokensUsed,
      props.tokensBudget,
      props.steps,
      props.startedAt,
      props.completedAt,
      props.errorMessage,
    );
  }

  // ─── Pipeline Progression ─────────────────────────────────────────────────

  /**
   * Record token usage for the current step.
   * Throws if budget would be exceeded.
   */
  recordTokenUsage(tokens: number): AgentExecution {
    const newTotal = this.tokensUsed + tokens;
    if (newTotal > this.tokensBudget) {
      throw new TokenBudgetExceededError(this.executionId.value, this.tokensBudget, newTotal);
    }

    const updatedSteps = this.steps.map((s) =>
      s.step === this.currentStep
        ? { ...s, tokensUsed: s.tokensUsed + tokens }
        : s,
    );

    return new AgentExecution(
      this.executionId,
      this.projectId,
      this.tenantId,
      this.status,
      this.currentStep,
      newTotal,
      this.tokensBudget,
      updatedSteps,
      this.startedAt,
      this.completedAt,
      this.errorMessage,
    );
  }

  /**
   * Complete the current step and advance to the next one.
   * If this was the last step, the execution is marked complete.
   */
  completeCurrentStep(): AgentExecution {
    const now = new Date().toISOString();
    const currentIdx = PIPELINE_STEPS.indexOf(this.currentStep);
    const isLastStep = currentIdx === PIPELINE_STEPS.length - 1;

    // Mark current step completed
    const updatedSteps = this.steps.map((s) =>
      s.step === this.currentStep
        ? { ...s, status: 'completed' as const, completedAt: now }
        : s,
    );

    if (isLastStep) {
      // Pipeline complete
      return new AgentExecution(
        this.executionId,
        this.projectId,
        this.tenantId,
        'completed',
        this.currentStep,
        this.tokensUsed,
        this.tokensBudget,
        updatedSteps,
        this.startedAt,
        now,
        undefined,
      );
    }

    // Advance to next step
    const nextStep = PIPELINE_STEPS[currentIdx + 1];
    const stepsWithNext = updatedSteps.map((s) =>
      s.step === nextStep
        ? { ...s, status: 'running' as const, startedAt: now }
        : s,
    );

    return new AgentExecution(
      this.executionId,
      this.projectId,
      this.tenantId,
      'running',
      nextStep,
      this.tokensUsed,
      this.tokensBudget,
      stepsWithNext,
      this.startedAt,
      undefined,
      undefined,
    );
  }

  // ─── State Transitions ────────────────────────────────────────────────────

  /**
   * Pause execution waiting for human input (e.g., spec approval).
   */
  waitForHuman(): AgentExecution {
    this.assertTransition('waiting_for_human');
    return new AgentExecution(
      this.executionId,
      this.projectId,
      this.tenantId,
      'waiting_for_human',
      this.currentStep,
      this.tokensUsed,
      this.tokensBudget,
      this.steps,
      this.startedAt,
      undefined,
      undefined,
    );
  }

  /**
   * Resume execution after human approval.
   */
  resume(): AgentExecution {
    this.assertTransition('running');
    return new AgentExecution(
      this.executionId,
      this.projectId,
      this.tenantId,
      'running',
      this.currentStep,
      this.tokensUsed,
      this.tokensBudget,
      this.steps,
      this.startedAt,
      undefined,
      undefined,
    );
  }

  /**
   * Mark execution as failed with an error message.
   */
  fail(errorMessage: string): AgentExecution {
    this.assertTransition('failed');
    const now = new Date().toISOString();

    const updatedSteps = this.steps.map((s) =>
      s.step === this.currentStep && s.status === 'running'
        ? { ...s, status: 'failed' as const, completedAt: now, error: errorMessage }
        : s,
    );

    return new AgentExecution(
      this.executionId,
      this.projectId,
      this.tenantId,
      'failed',
      this.currentStep,
      this.tokensUsed,
      this.tokensBudget,
      updatedSteps,
      this.startedAt,
      now,
      errorMessage,
    );
  }

  /**
   * Cancel execution (user-initiated or timeout).
   */
  cancel(): AgentExecution {
    this.assertTransition('cancelled');
    return new AgentExecution(
      this.executionId,
      this.projectId,
      this.tenantId,
      'cancelled',
      this.currentStep,
      this.tokensUsed,
      this.tokensBudget,
      this.steps,
      this.startedAt,
      new Date().toISOString(),
      'Execution cancelled',
    );
  }

  /**
   * Retry a failed execution (resumes from the failed step).
   */
  retry(): AgentExecution {
    this.assertTransition('running');
    const now = new Date().toISOString();

    const updatedSteps = this.steps.map((s) =>
      s.step === this.currentStep && s.status === 'failed'
        ? { ...s, status: 'running' as const, startedAt: now, error: undefined }
        : s,
    );

    return new AgentExecution(
      this.executionId,
      this.projectId,
      this.tenantId,
      'running',
      this.currentStep,
      this.tokensUsed,
      this.tokensBudget,
      updatedSteps,
      this.startedAt,
      undefined,
      undefined,
    );
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  get isTerminal(): boolean {
    return this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled';
  }

  get progressPercent(): number {
    const completedCount = this.steps.filter((s) => s.status === 'completed').length;
    return Math.round((completedCount / PIPELINE_STEPS.length) * 100);
  }

  get tokenBudgetRemaining(): number {
    return Math.max(0, this.tokensBudget - this.tokensUsed);
  }

  get tokenBudgetPercent(): number {
    if (this.tokensBudget === 0) return 100;
    return Math.round((this.tokensUsed / this.tokensBudget) * 100);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private assertTransition(nextStatus: AgentExecutionStatus): void {
    const allowed = VALID_TRANSITIONS[this.status];
    if (!allowed.has(nextStatus)) {
      throw new InvalidExecutionTransitionError(this.status, nextStatus);
    }
  }
}
