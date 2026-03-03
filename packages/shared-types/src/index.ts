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
  readonly payhereSubscriptionId?: string;
  readonly plan: Plan;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancelledAt?: string;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

/**
 * PayHere webhook notification statuses.
 * status_code: 2 = success, 0 = pending, -1 = canceled, -2 = failed, -3 = chargedback
 */
export type PayHereStatusCode = 2 | 0 | -1 | -2 | -3;

/**
 * PayHere recurring message types for subscription webhooks.
 */
export type PayHereMessageType =
  | 'AUTHORIZATION_SUCCESS'
  | 'AUTHORIZATION_FAILED'
  | 'RECURRING_INSTALLMENT_SUCCESS'
  | 'RECURRING_INSTALLMENT_FAILED'
  | 'RECURRING_COMPLETE'
  | 'RECURRING_STOPPED';

/**
 * PayHere webhook notification payload (Recurring API).
 */
export interface PayHereWebhookPayload {
  readonly merchant_id: string;
  readonly order_id: string;
  readonly payment_id: string;
  readonly subscription_id?: string;
  readonly payhere_amount: string;
  readonly payhere_currency: string;
  readonly status_code: string;
  readonly md5sig: string;
  readonly method?: string;
  readonly status_message?: string;
  readonly custom_1?: string;
  readonly custom_2?: string;
  readonly recurring?: string;
  readonly message_type?: string;
  readonly item_recurrence?: string;
  readonly item_duration?: string;
  readonly item_rec_status?: string;
  readonly item_rec_date_next?: string;
  readonly item_rec_install_paid?: string;
  readonly card_holder_name?: string;
  readonly card_no?: string;
  readonly card_expiry?: string;
}

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

// ─── LLM / AI Bounded Context ─────────────────────────────────────────────────

/**
 * Supported LLM model identifiers for AWS Bedrock.
 */
export type LlmModelId =
  | 'anthropic.claude-3-5-sonnet-20241022-v2:0'
  | 'anthropic.claude-3-5-haiku-20241022-v1:0'
  | 'anthropic.claude-3-opus-20240229-v1:0'
  | 'anthropic.claude-3-sonnet-20240229-v1:0'
  | 'anthropic.claude-3-haiku-20240307-v1:0';

/**
 * Role of a message in a conversation.
 */
export type MessageRole = 'user' | 'assistant';

/**
 * A single message in an LLM conversation.
 */
export interface LlmMessage {
  readonly role: MessageRole;
  readonly content: string;
}

/**
 * Request to an LLM provider.
 */
export interface LlmRequest {
  readonly modelId: LlmModelId;
  readonly systemPrompt?: string;
  readonly messages: LlmMessage[];
  readonly maxTokens: number;
  readonly temperature?: number;
  readonly topP?: number;
  readonly stopSequences?: string[];
}

/**
 * Response from an LLM provider.
 */
export interface LlmResponse {
  readonly content: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly stopReason: LlmStopReason;
  readonly modelId: LlmModelId;
}

/**
 * Reason the LLM stopped generating.
 */
export type LlmStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'content_filtered'
  | 'tool_use';

/**
 * A chunk from a streaming LLM response.
 */
export interface LlmStreamChunk {
  readonly type: 'content_delta' | 'message_start' | 'message_stop' | 'metadata';
  readonly content?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly stopReason?: LlmStopReason;
}

/**
 * Configuration for the LLM provider.
 */
export interface LlmProviderConfig {
  readonly region: string;
  readonly defaultModelId: LlmModelId;
  readonly fallbackModelId?: LlmModelId;
  readonly maxRetries: number;
  readonly timeoutMs: number;
}

/**
 * Token budget limits by subscription plan.
 */
export const TOKEN_LIMITS_BY_PLAN: Record<Plan, number> = {
  free: 10_000,
  pro: 100_000,
  team: 200_000,
  enterprise: 500_000,
};

/**
 * Cost per 1K tokens by model (input/output in USD).
 */
export interface ModelPricing {
  readonly inputPer1K: number;
  readonly outputPer1K: number;
}

export const MODEL_PRICING: Record<LlmModelId, ModelPricing> = {
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'anthropic.claude-3-5-haiku-20241022-v1:0': { inputPer1K: 0.0008, outputPer1K: 0.004 },
  'anthropic.claude-3-opus-20240229-v1:0': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'anthropic.claude-3-sonnet-20240229-v1:0': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'anthropic.claude-3-haiku-20240307-v1:0': { inputPer1K: 0.00025, outputPer1K: 0.00125 },
};

/**
 * LLM usage record for billing and analytics.
 */
export interface LlmUsageRecord {
  readonly usageId: string;
  readonly tenantId: string;
  readonly executionId: string;
  readonly modelId: LlmModelId;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly timestamp: string;
}
