import type { ProjectStatus } from '@promptdeploy/shared-types';
import { ProjectId } from '../value-objects/project-id.js';
import { TenantId } from '../value-objects/tenant-id.js';
import { ProjectName } from '../value-objects/project-name.js';
import { ProjectDescription } from '../value-objects/project-description.js';
import { InvalidProjectTransitionError } from '../errors/index.js';

/**
 * Valid state transitions for a Project.
 * Key = current status, Value = set of allowed next statuses.
 */
const VALID_TRANSITIONS: Record<ProjectStatus, Set<ProjectStatus>> = {
  draft: new Set(['spec_review', 'failed']),
  spec_review: new Set(['designing', 'failed']),
  designing: new Set(['generating', 'failed']),
  generating: new Set(['qa_review', 'failed']),
  qa_review: new Set(['security_review', 'generating', 'failed']),
  security_review: new Set(['deploying', 'generating', 'failed']),
  deploying: new Set(['live', 'failed']),
  live: new Set([]),
  failed: new Set(['draft']),
};

export interface CreateProjectProps {
  readonly projectId: ProjectId;
  readonly tenantId: TenantId;
  readonly name: ProjectName;
  readonly description: ProjectDescription;
  readonly templateId: string;
}

export interface ReconstituteProjectProps extends CreateProjectProps {
  readonly status: ProjectStatus;
  readonly repoUrl?: string;
  readonly deployedUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Project aggregate root.
 * Manages lifecycle of a user's SaaS project from draft to live.
 * All mutations return a new immutable instance (event-sourcing friendly).
 */
export class Project {
  private constructor(
    public readonly projectId: ProjectId,
    public readonly tenantId: TenantId,
    public readonly name: ProjectName,
    public readonly description: ProjectDescription,
    public readonly templateId: string,
    public readonly status: ProjectStatus,
    public readonly repoUrl: string | undefined,
    public readonly deployedUrl: string | undefined,
    public readonly createdAt: string,
    public readonly updatedAt: string,
  ) {
    Object.freeze(this);
  }

  /**
   * Factory method for creating a new Project (starts in draft).
   */
  static create(props: CreateProjectProps): Project {
    const now = new Date().toISOString();
    return new Project(
      props.projectId,
      props.tenantId,
      props.name,
      props.description,
      props.templateId,
      'draft',
      undefined,
      undefined,
      now,
      now,
    );
  }

  /**
   * Reconstitute a Project from persisted state (no validation, no defaults).
   */
  static reconstitute(props: ReconstituteProjectProps): Project {
    return new Project(
      props.projectId,
      props.tenantId,
      props.name,
      props.description,
      props.templateId,
      props.status,
      props.repoUrl,
      props.deployedUrl,
      props.createdAt,
      props.updatedAt,
    );
  }

  // ─── State Transitions ────────────────────────────────────────────────────

  submitForReview(): Project {
    return this.transitionTo('spec_review');
  }

  approveSpec(): Project {
    return this.transitionTo('designing');
  }

  startGeneration(): Project {
    return this.transitionTo('generating');
  }

  submitForQA(): Project {
    return this.transitionTo('qa_review');
  }

  approveQA(): Project {
    return this.transitionTo('security_review');
  }

  startDeployment(): Project {
    return this.transitionTo('deploying');
  }

  markLive(deployedUrl: string): Project {
    const next = this.transitionTo('live');
    return new Project(
      next.projectId,
      next.tenantId,
      next.name,
      next.description,
      next.templateId,
      next.status,
      next.repoUrl,
      deployedUrl,
      next.createdAt,
      next.updatedAt,
    );
  }

  markFailed(): Project {
    return this.transitionTo('failed');
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  setRepoUrl(repoUrl: string): Project {
    return new Project(
      this.projectId,
      this.tenantId,
      this.name,
      this.description,
      this.templateId,
      this.status,
      repoUrl,
      this.deployedUrl,
      this.createdAt,
      new Date().toISOString(),
    );
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private transitionTo(nextStatus: ProjectStatus): Project {
    const allowed = VALID_TRANSITIONS[this.status];
    if (!allowed.has(nextStatus)) {
      throw new InvalidProjectTransitionError(this.status, nextStatus);
    }
    return new Project(
      this.projectId,
      this.tenantId,
      this.name,
      this.description,
      this.templateId,
      nextStatus,
      this.repoUrl,
      this.deployedUrl,
      this.createdAt,
      new Date().toISOString(),
    );
  }
}
