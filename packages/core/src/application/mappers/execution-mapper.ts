import type { AgentExecution } from '../../domain/entities/agent-execution.js';
import type { ExecutionDTO } from '../dtos/index.js';

/**
 * Maps between AgentExecution domain entity and ExecutionDTO.
 */
export class ExecutionMapper {
  static toDTO(execution: AgentExecution): ExecutionDTO {
    return {
      executionId: execution.executionId.value,
      projectId: execution.projectId.value,
      tenantId: execution.tenantId.value,
      status: execution.status,
      currentStep: execution.currentStep,
      tokensUsed: execution.tokensUsed,
      tokensBudget: execution.tokensBudget,
      progressPercent: execution.progressPercent,
      steps: execution.steps.map((s) => ({ ...s })),
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      errorMessage: execution.errorMessage,
    };
  }
}
