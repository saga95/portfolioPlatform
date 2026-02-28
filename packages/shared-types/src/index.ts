// ─── Identity Bounded Context ─────────────────────────────────────────────────

export interface Tenant {
  readonly tenantId: string;
  readonly name: string;
  readonly email: string;
  readonly plan: Plan;
  readonly status: TenantStatus;
  readonly awsAccountId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type Plan = 'free' | 'pro' | 'team' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'cancelled';

export interface Entitlement {
  readonly entitlementId: string;
  readonly name: string;
  readonly description: string;
  readonly plan: Plan;
}

// ─── Project Bounded Context ──────────────────────────────────────────────────

export interface Project {
  readonly projectId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly templateId: string;
  readonly spec?: ProjectSpec;
  readonly repoUrl?: string;
  readonly deployedUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProjectStatus =
  | 'draft'
  | 'spec_review'
  | 'designing'
  | 'generating'
  | 'qa_review'
  | 'security_review'
  | 'deploying'
  | 'live'
  | 'failed';

export interface ProjectSpec {
  readonly projectName: string;
  readonly description: string;
  readonly templateId: string;
  readonly pages: PageSpec[];
  readonly dataModels: DataModelSpec[];
  readonly apiEndpoints: ApiEndpointSpec[];
  readonly features: FeatureSpec[];
  readonly auth: AuthSpec;
  readonly integrations: IntegrationSpec[];
}

export interface PageSpec {
  readonly name: string;
  readonly route: string;
  readonly description: string;
  readonly components: string[];
  readonly isProtected: boolean;
}

export interface DataModelSpec {
  readonly name: string;
  readonly fields: FieldSpec[];
  readonly accessPatterns: AccessPatternSpec[];
}

export interface FieldSpec {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'object' | 'array';
  readonly required: boolean;
  readonly isPartitionKey?: boolean;
  readonly isSortKey?: boolean;
  readonly enumValues?: string[];
  readonly description?: string;
}

export interface AccessPatternSpec {
  readonly name: string;
  readonly description: string;
  readonly pk: string;
  readonly sk?: string;
  readonly gsi?: string;
}

export interface ApiEndpointSpec {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly description: string;
  readonly requestBody?: Record<string, unknown>;
  readonly responseBody?: Record<string, unknown>;
  readonly requiredEntitlements: string[];
}

export interface FeatureSpec {
  readonly name: string;
  readonly description: string;
  readonly priority: 'must' | 'should' | 'could';
}

export interface AuthSpec {
  readonly provider: 'cognito';
  readonly mfaRequired: boolean;
  readonly socialProviders: string[];
  readonly customAttributes: string[];
}

export interface IntegrationSpec {
  readonly name: string;
  readonly type: 'paddle' | 'payhere' | 'github' | 'ses' | 'custom';
  readonly description: string;
}

// ─── Deployment Bounded Context ───────────────────────────────────────────────

export interface Deployment {
  readonly deploymentId: string;
  readonly projectId: string;
  readonly tenantId: string;
  readonly version: string;
  readonly status: DeploymentStatus;
  readonly logs?: string;
  readonly startedAt: string;
  readonly completedAt?: string;
}

export type DeploymentStatus =
  | 'pending'
  | 'bootstrapping'
  | 'deploying'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'rolling_back';

// ─── Billing Bounded Context ──────────────────────────────────────────────────

export interface Subscription {
  readonly subscriptionId: string;
  readonly tenantId: string;
  readonly paddleSubscriptionId?: string;
  readonly payhereSubscriptionId?: string;
  readonly plan: Plan;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

// ─── Agent Bounded Context ────────────────────────────────────────────────────

export interface AgentExecution {
  readonly executionId: string;
  readonly projectId: string;
  readonly tenantId: string;
  readonly status: AgentExecutionStatus;
  readonly currentStep: string;
  readonly tokensUsed: number;
  readonly tokensBudget: number;
  readonly startedAt: string;
  readonly completedAt?: string;
}

export type AgentExecutionStatus =
  | 'running'
  | 'waiting_for_human'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ─── Common Types ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  readonly auditId: string;
  readonly tenantId: string;
  readonly action: string;
  readonly actor: string;
  readonly resource: string;
  readonly details: Record<string, unknown>;
  readonly timestamp: string;
}

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly nextToken?: string;
  readonly totalCount?: number;
}

export interface ApiErrorResponse {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly requestId: string;
}
