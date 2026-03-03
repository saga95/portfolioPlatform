import type { Result } from '@promptdeploy/shared-utils';
import type {
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
  LlmModelId,
} from '@promptdeploy/shared-types';

/**
 * Error types that can occur during LLM operations.
 */
export type LlmErrorCode =
  | 'RATE_LIMITED'
  | 'TOKEN_LIMIT_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'MODEL_UNAVAILABLE'
  | 'CONTENT_FILTERED'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * Structured error from LLM operations.
 */
export interface LlmError {
  readonly code: LlmErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
}

/**
 * Port interface for LLM providers.
 * 
 * Implementations:
 * - BedrockLlmProvider (AWS Bedrock with Claude models)
 * 
 * Following the ports & adapters pattern (hexagonal architecture),
 * this interface lives in the domain layer and is implemented
 * by infrastructure adapters.
 */
export interface LlmProvider {
  /**
   * Send a request to the LLM and get a complete response.
   * 
   * @param request - The LLM request with messages, model, and parameters
   * @returns Result with LlmResponse on success, LlmError on failure
   */
  invoke(request: LlmRequest): Promise<Result<LlmResponse, LlmError>>;

  /**
   * Send a request to the LLM and stream the response.
   * 
   * @param request - The LLM request with messages, model, and parameters
   * @returns AsyncIterable of LlmStreamChunk for streaming responses
   * @throws LlmError if the request cannot be initiated
   */
  invokeStream(request: LlmRequest): AsyncIterable<Result<LlmStreamChunk, LlmError>>;

  /**
   * Check if a specific model is available.
   * 
   * @param modelId - The model identifier to check
   * @returns true if the model is available for use
   */
  isModelAvailable(modelId: LlmModelId): Promise<boolean>;
}

/**
 * Factory type for creating LlmProvider instances.
 * Useful for dependency injection in tests.
 */
export type LlmProviderFactory = () => LlmProvider;
