/**
 * Prompt Engineering Framework
 *
 * This module provides tools for constructing and parsing LLM prompts
 * for the PromptDeploy multi-agent pipeline.
 */

// Types
export type {
  AgentId,
  AgentConfig,
  PromptVariables,
  FewShotExample,
  PromptConfig,
  ParsedResponse,
} from './types';

export { AGENT_CONFIGS } from './types';

// Agent system prompts
export {
  REQUIREMENT_ANALYZER_PROMPT,
  SYSTEM_DESIGNER_PROMPT,
  FRONTEND_DEV_PROMPT,
  BACKEND_DEV_PROMPT,
  INFRA_DEV_PROMPT,
  QA_TESTER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  ORCHESTRATOR_PROMPT,
  AGENT_SYSTEM_PROMPTS,
} from './agent-prompts';

// Prompt template
export { PromptTemplate } from './prompt-template';

// Response parser
export {
  ResponseParser,
  responseParser,
  type ParseFormat,
  type ParseOptions,
  type ParseError,
} from './response-parser';
