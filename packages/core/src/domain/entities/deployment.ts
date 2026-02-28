import type { DeploymentStatus } from '@promptdeploy/shared-types';
import { DeploymentId } from '../value-objects/deployment-id.js';
import { TenantId } from '../value-objects/tenant-id.js';
import { ProjectId } from '../value-objects/project-id.js';
import { InvalidDeploymentTransitionError } from '../errors/index.js';

/**
 * Valid state transitions for a Deployment.
 *
 * pending → bootstrapping → deploying → verifying → succeeded
 *                                                 → failed
 *                                     → failed
 *                          → failed
 *           → failed
 * failed → rolling_back → pending (retry)
 * succeeded (terminal)
 */
const VALID_TRANSITIONS: Record<DeploymentStatus, Set<DeploymentStatus>> = {
  pending: new Set(['bootstrapping', 'failed']),
  bootstrapping: new Set(['deploying', 'failed']),
  deploying: new Set(['verifying', 'failed']),
  verifying: new Set(['succeeded', 'failed']),
  succeeded: new Set([]),
  failed: new Set(['rolling_back', 'pending']), // rolling_back or retry (back to pending)
  rolling_back: new Set(['pending', 'failed']),
};

export interface CreateDeploymentProps {
  readonly deploymentId: DeploymentId;
  readonly projectId: ProjectId;
  readonly tenantId: TenantId;
  readonly version: string;
}

export interface ReconstituteDeploymentProps extends CreateDeploymentProps {
  readonly status: DeploymentStatus;
  readonly logs: string[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly errorMessage?: string;
  readonly deployedUrl?: string;
}

/**
 * Deployment aggregate root.
 *
 * Manages the lifecycle of deploying generated code to a
 * customer's AWS account via CDK.
 *
 * All mutations return new immutable instances.
 */
export class Deployment {
  private constructor(
    public readonly deploymentId: DeploymentId,
    public readonly projectId: ProjectId,
    public readonly tenantId: TenantId,
    public readonly version: string,
    public readonly status: DeploymentStatus,
    public readonly logs: ReadonlyArray<string>,
    public readonly startedAt: string,
    public readonly completedAt: string | undefined,
    public readonly errorMessage: string | undefined,
    public readonly deployedUrl: string | undefined,
  ) {
    Object.freeze(this);
  }

  /**
   * Factory: create a new deployment in pending state.
   */
  static create(props: CreateDeploymentProps): Deployment {
    const now = new Date().toISOString();
    return new Deployment(
      props.deploymentId,
      props.projectId,
      props.tenantId,
      props.version,
      'pending',
      [],
      now,
      undefined,
      undefined,
      undefined,
    );
  }

  /**
   * Reconstitute from persistence.
   */
  static reconstitute(props: ReconstituteDeploymentProps): Deployment {
    return new Deployment(
      props.deploymentId,
      props.projectId,
      props.tenantId,
      props.version,
      props.status,
      props.logs,
      props.startedAt,
      props.completedAt,
      props.errorMessage,
      props.deployedUrl,
    );
  }

  // ─── State Machine Transitions ──────────────────────────────────────────

  /**
   * Move deployment to bootstrapping state (CDK bootstrap).
   */
  startBootstrap(): Deployment {
    return this.transitionTo('bootstrapping');
  }

  /**
   * Move deployment to deploying state (CDK deploy).
   */
  startDeploy(): Deployment {
    return this.transitionTo('deploying');
  }

  /**
   * Move deployment to verifying state (health checks).
   */
  startVerification(): Deployment {
    return this.transitionTo('verifying');
  }

  /**
   * Mark deployment as succeeded.
   */
  markSucceeded(deployedUrl: string): Deployment {
    this.assertTransition('succeeded');
    return new Deployment(
      this.deploymentId,
      this.projectId,
      this.tenantId,
      this.version,
      'succeeded',
      this.logs,
      this.startedAt,
      new Date().toISOString(),
      undefined,
      deployedUrl,
    );
  }

  /**
   * Mark deployment as failed.
   */
  markFailed(errorMessage: string): Deployment {
    this.assertTransition('failed');
    return new Deployment(
      this.deploymentId,
      this.projectId,
      this.tenantId,
      this.version,
      'failed',
      this.logs,
      this.startedAt,
      new Date().toISOString(),
      errorMessage,
      this.deployedUrl,
    );
  }

  /**
   * Start rolling back a failed deployment.
   */
  startRollback(): Deployment {
    return this.transitionTo('rolling_back');
  }

  /**
   * Retry a failed or rolled-back deployment (back to pending).
   */
  retry(): Deployment {
    return this.transitionTo('pending');
  }

  // ─── Log Management ────────────────────────────────────────────────────

  /**
   * Append a log entry.
   */
  appendLog(message: string): Deployment {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    return new Deployment(
      this.deploymentId,
      this.projectId,
      this.tenantId,
      this.version,
      this.status,
      [...this.logs, entry],
      this.startedAt,
      this.completedAt,
      this.errorMessage,
      this.deployedUrl,
    );
  }

  // ─── Queries ───────────────────────────────────────────────────────────

  /**
   * Whether the deployment is in a terminal state.
   */
  get isTerminal(): boolean {
    return this.status === 'succeeded' || this.status === 'failed';
  }

  /**
   * Whether the deployment is actively in progress.
   */
  get isInProgress(): boolean {
    return (
      this.status === 'pending' ||
      this.status === 'bootstrapping' ||
      this.status === 'deploying' ||
      this.status === 'verifying' ||
      this.status === 'rolling_back'
    );
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private transitionTo(newStatus: DeploymentStatus): Deployment {
    this.assertTransition(newStatus);
    return new Deployment(
      this.deploymentId,
      this.projectId,
      this.tenantId,
      this.version,
      newStatus,
      this.logs,
      this.startedAt,
      this.completedAt,
      this.errorMessage,
      this.deployedUrl,
    );
  }

  private assertTransition(newStatus: DeploymentStatus): void {
    const allowed = VALID_TRANSITIONS[this.status];
    if (!allowed || !allowed.has(newStatus)) {
      throw new InvalidDeploymentTransitionError(this.status, newStatus);
    }
  }
}
