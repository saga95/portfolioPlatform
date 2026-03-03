import type { LlmModelId, Plan } from '@promptdeploy/shared-types';

// ─── Agent Types ──────────────────────────────────────────────────────────────

/**
 * Available agent identifiers in the PromptDeploy pipeline.
 */
export type AgentId =
  | 'requirement_analyzer'
  | 'system_designer'
  | 'frontend_dev'
  | 'backend_dev'
  | 'infra_dev'
  | 'qa_tester'
  | 'security_reviewer'
  | 'orchestrator';

/**
 * Metadata for an agent's capabilities and configuration.
 */
export interface AgentConfig {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;
  readonly preferredModel: LlmModelId;
  readonly fallbackModel: LlmModelId;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly outputFormat: 'xml' | 'json' | 'markdown';
}

/**
 * Default configurations for each agent.
 */
export const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  requirement_analyzer: {
    id: 'requirement_analyzer',
    name: 'Requirement Analyzer',
    description: 'Analyzes prompts and produces ProjectSpec',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 8192,
    temperature: 0.3,
    outputFormat: 'xml',
  },
  system_designer: {
    id: 'system_designer',
    name: 'System Designer',
    description: 'Creates technical design from ProjectSpec',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 16384,
    temperature: 0.2,
    outputFormat: 'xml',
  },
  frontend_dev: {
    id: 'frontend_dev',
    name: 'Frontend Developer',
    description: 'Generates React/MUI frontend code',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 32768,
    temperature: 0.1,
    outputFormat: 'xml',
  },
  backend_dev: {
    id: 'backend_dev',
    name: 'Backend Developer',
    description: 'Generates Node.js Lambda backend code',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 32768,
    temperature: 0.1,
    outputFormat: 'xml',
  },
  infra_dev: {
    id: 'infra_dev',
    name: 'Infrastructure Developer',
    description: 'Generates AWS CDK infrastructure code',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 16384,
    temperature: 0.1,
    outputFormat: 'xml',
  },
  qa_tester: {
    id: 'qa_tester',
    name: 'QA Validator',
    description: 'Validates code quality and spec compliance',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 8192,
    temperature: 0.2,
    outputFormat: 'xml',
  },
  security_reviewer: {
    id: 'security_reviewer',
    name: 'Security Reviewer',
    description: 'Performs security audit and vulnerability analysis',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 8192,
    temperature: 0.2,
    outputFormat: 'xml',
  },
  orchestrator: {
    id: 'orchestrator',
    name: 'Orchestrator',
    description: 'Coordinates multi-agent pipeline',
    preferredModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    maxTokens: 4096,
    temperature: 0.3,
    outputFormat: 'json',
  },
};

// ─── Prompt Template Types ────────────────────────────────────────────────────

/**
 * Variables that can be interpolated in prompt templates.
 * Extends a base set of known variables with custom key-value pairs.
 */
export interface PromptVariables {
  /** User's original prompt/request */
  readonly userPrompt?: string;
  /** Project specification (from requirement analyzer) */
  readonly projectSpec?: string;
  /** System design (from system designer) */
  readonly systemDesign?: string;
  /** Current file being generated */
  readonly currentFile?: string;
  /** Files already generated in this session */
  readonly generatedFiles?: string[];
  /** Tenant's subscription plan */
  readonly plan?: Plan;
  /** Token budget remaining */
  readonly tokenBudget?: number;
  /** Previous agent's output */
  readonly previousOutput?: string;
  /** Error context for retry */
  readonly errorContext?: string;
  /** Custom key-value pairs - allows arbitrary properties */
  [key: string]: unknown;
}

/**
 * A few-shot example for the prompt.
 */
export interface FewShotExample {
  readonly input: string;
  readonly output: string;
  readonly explanation?: string;
}

/**
 * Configuration for building a prompt.
 */
export interface PromptConfig {
  readonly agentId: AgentId;
  readonly variables: PromptVariables;
  readonly examples?: FewShotExample[];
  readonly additionalInstructions?: string;
}

// ─── Response Parser Types ────────────────────────────────────────────────────

/**
 * Result of parsing an LLM response.
 */
export interface ParsedResponse<T> {
  /** The parsed and validated data */
  readonly data: T;
  /** The raw response content before parsing */
  readonly raw: string;
  /** ISO timestamp when parsing occurred */
  readonly parsedAt: string;
}

/**
 * Error that occurred during parsing.
 */
export interface ParseError {
  readonly code: 'INVALID_XML' | 'INVALID_JSON' | 'SCHEMA_MISMATCH' | 'EMPTY_RESPONSE';
  readonly message: string;
  readonly location?: string;
}
