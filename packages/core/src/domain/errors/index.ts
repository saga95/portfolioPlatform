/**
 * Base class for domain-specific errors.
 * All domain errors extend this for proper error categorization.
 */
export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ProjectNotFoundError extends DomainError {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`, 'PROJECT_NOT_FOUND');
  }
}

export class ProjectAlreadyExistsError extends DomainError {
  constructor(name: string, tenantId: string) {
    super(
      `Project "${name}" already exists for tenant ${tenantId}`,
      'PROJECT_ALREADY_EXISTS',
    );
  }
}

export class ProjectLimitExceededError extends DomainError {
  constructor(tenantId: string, limit: number) {
    super(
      `Tenant ${tenantId} has reached the project limit of ${limit}`,
      'PROJECT_LIMIT_EXCEEDED',
    );
  }
}

export class InvalidProjectTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(
      `Invalid project status transition from "${from}" to "${to}"`,
      'INVALID_PROJECT_TRANSITION',
    );
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED');
  }
}

export class InsufficientEntitlementError extends DomainError {
  constructor(required: string) {
    super(
      `Missing required entitlement: ${required}`,
      'INSUFFICIENT_ENTITLEMENT',
    );
  }
}

// ─── Agent Bounded Context Errors ───────────────────────────────────────────

export class ExecutionNotFoundError extends DomainError {
  constructor(executionId: string) {
    super(`Agent execution not found: ${executionId}`, 'EXECUTION_NOT_FOUND');
  }
}

export class InvalidExecutionTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(
      `Invalid execution status transition from "${from}" to "${to}"`,
      'INVALID_EXECUTION_TRANSITION',
    );
  }
}

export class TokenBudgetExceededError extends DomainError {
  constructor(executionId: string, budget: number, requested: number) {
    super(
      `Token budget exceeded for execution ${executionId}: budget=${budget}, requested=${requested}`,
      'TOKEN_BUDGET_EXCEEDED',
    );
  }
}

export class ExecutionAlreadyRunningError extends DomainError {
  constructor(projectId: string) {
    super(
      `An execution is already running for project ${projectId}`,
      'EXECUTION_ALREADY_RUNNING',
    );
  }
}

// ─── Deployment Bounded Context Errors ──────────────────────────────────────

export class DeploymentNotFoundError extends DomainError {
  constructor(deploymentId: string) {
    super(`Deployment not found: ${deploymentId}`, 'DEPLOYMENT_NOT_FOUND');
  }
}

export class InvalidDeploymentTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(
      `Invalid deployment status transition from "${from}" to "${to}"`,
      'INVALID_DEPLOYMENT_TRANSITION',
    );
  }
}
