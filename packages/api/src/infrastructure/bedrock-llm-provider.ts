import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type ConverseResponse,
  type ConverseStreamOutput,
  ThrottlingException,
  ValidationException,
  ModelTimeoutException,
  ModelNotReadyException,
  ServiceUnavailableException,
} from '@aws-sdk/client-bedrock-runtime';
import { ok, err, type Result } from '@promptdeploy/shared-utils';
import type {
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
  LlmModelId,
  LlmStopReason,
  LlmProviderConfig,
} from '@promptdeploy/shared-types';
import type { LlmProvider, LlmError, LlmErrorCode } from '@promptdeploy/core';

/**
 * Default configuration for the Bedrock LLM provider.
 */
const DEFAULT_CONFIG: LlmProviderConfig = {
  region: process.env.BEDROCK_REGION ?? 'us-east-1',
  defaultModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  fallbackModelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  maxRetries: 3,
  timeoutMs: 120_000,
};

/**
 * Map Bedrock stop reasons to our LlmStopReason type.
 */
function mapStopReason(bedrockReason?: string): LlmStopReason {
  switch (bedrockReason) {
    case 'end_turn':
      return 'end_turn';
    case 'max_tokens':
      return 'max_tokens';
    case 'stop_sequence':
      return 'stop_sequence';
    case 'content_filtered':
      return 'content_filtered';
    case 'tool_use':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}

/**
 * Map AWS SDK errors to our LlmError type.
 */
function mapError(error: unknown): LlmError {
  if (error instanceof ThrottlingException) {
    // Parse Retry-After header if available
    const retryAfterMs = 60_000; // Default to 1 minute
    return {
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded. Please retry later.',
      retryable: true,
      retryAfterMs,
    };
  }

  if (error instanceof ValidationException) {
    return {
      code: 'INVALID_REQUEST',
      message: error.message ?? 'Invalid request parameters.',
      retryable: false,
    };
  }

  if (error instanceof ModelTimeoutException) {
    return {
      code: 'TIMEOUT',
      message: 'Model request timed out.',
      retryable: true,
      retryAfterMs: 5_000,
    };
  }

  if (error instanceof ModelNotReadyException) {
    return {
      code: 'MODEL_UNAVAILABLE',
      message: 'Model is not ready. Please try again.',
      retryable: true,
      retryAfterMs: 10_000,
    };
  }

  if (error instanceof ServiceUnavailableException) {
    return {
      code: 'MODEL_UNAVAILABLE',
      message: 'Bedrock service is temporarily unavailable.',
      retryable: true,
      retryAfterMs: 30_000,
    };
  }

  // Check for content filter error in message
  if (error instanceof Error && error.message?.includes('content filter')) {
    return {
      code: 'CONTENT_FILTERED',
      message: 'Request was blocked by content filter.',
      retryable: false,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'An unknown error occurred.',
    retryable: false,
  };
}

/**
 * AWS Bedrock implementation of the LlmProvider interface.
 *
 * Supports Claude 3.x models via the Converse API.
 * Features:
 * - Automatic retry with exponential backoff
 * - Model fallback on rate limits
 * - Streaming responses
 * - Token counting from response metadata
 */
export class BedrockLlmProvider implements LlmProvider {
  private readonly client: BedrockRuntimeClient;
  private readonly config: LlmProviderConfig;

  constructor(config?: Partial<LlmProviderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new BedrockRuntimeClient({
      region: this.config.region,
      maxAttempts: this.config.maxRetries,
    });
  }

  /**
   * Convert our message format to Bedrock's Message format.
   */
  private toBedrockMessages(request: LlmRequest): Message[] {
    return request.messages.map((msg) => ({
      role: msg.role,
      content: [{ text: msg.content }] as ContentBlock[],
    }));
  }

  /**
   * Send a request to the LLM and get a complete response.
   */
  async invoke(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    try {
      const command = new ConverseCommand({
        modelId: request.modelId,
        messages: this.toBedrockMessages(request),
        system: request.systemPrompt ? [{ text: request.systemPrompt }] : undefined,
        inferenceConfig: {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          topP: request.topP,
          stopSequences: request.stopSequences,
        },
      });

      const response: ConverseResponse = await this.client.send(command);

      // Extract text content from response
      const content = response.output?.message?.content
        ?.map((block) => ('text' in block ? block.text : ''))
        .join('') ?? '';

      const llmResponse: LlmResponse = {
        content,
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
        stopReason: mapStopReason(response.stopReason),
        modelId: request.modelId,
      };

      return ok(llmResponse);
    } catch (error) {
      const llmError = mapError(error);

      // If rate limited and we have a fallback model, try it
      if (
        llmError.code === 'RATE_LIMITED' &&
        this.config.fallbackModelId &&
        request.modelId !== this.config.fallbackModelId
      ) {
        console.warn(
          `Rate limited on ${request.modelId}, falling back to ${this.config.fallbackModelId}`,
        );
        return this.invoke({
          ...request,
          modelId: this.config.fallbackModelId,
        });
      }

      return err(llmError);
    }
  }

  /**
   * Send a request to the LLM and stream the response.
   */
  async *invokeStream(
    request: LlmRequest,
  ): AsyncIterable<Result<LlmStreamChunk, LlmError>> {
    try {
      const command = new ConverseStreamCommand({
        modelId: request.modelId,
        messages: this.toBedrockMessages(request),
        system: request.systemPrompt ? [{ text: request.systemPrompt }] : undefined,
        inferenceConfig: {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          topP: request.topP,
          stopSequences: request.stopSequences,
        },
      });

      const response = await this.client.send(command);

      if (!response.stream) {
        yield err({
          code: 'UNKNOWN_ERROR',
          message: 'No stream returned from Bedrock',
          retryable: false,
        });
        return;
      }

      for await (const event of response.stream) {
        const chunk = this.mapStreamEvent(event);
        if (chunk) {
          yield ok(chunk);
        }
      }
    } catch (error) {
      yield err(mapError(error));
    }
  }

  /**
   * Map Bedrock stream events to our LlmStreamChunk format.
   */
  private mapStreamEvent(event: ConverseStreamOutput): LlmStreamChunk | null {
    if ('messageStart' in event && event.messageStart) {
      return { type: 'message_start' };
    }

    if ('contentBlockDelta' in event && event.contentBlockDelta) {
      const delta = event.contentBlockDelta.delta;
      if (delta && 'text' in delta) {
        return {
          type: 'content_delta',
          content: delta.text,
        };
      }
    }

    if ('messageStop' in event && event.messageStop) {
      return {
        type: 'message_stop',
        stopReason: mapStopReason(event.messageStop.stopReason),
      };
    }

    if ('metadata' in event && event.metadata) {
      return {
        type: 'metadata',
        inputTokens: event.metadata.usage?.inputTokens,
        outputTokens: event.metadata.usage?.outputTokens,
      };
    }

    return null;
  }

  /**
   * Check if a specific model is available.
   * For now, we assume all Claude models are available in the configured region.
   */
  async isModelAvailable(modelId: LlmModelId): Promise<boolean> {
    // Claude models are available in these regions
    const claudeRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'];
    return claudeRegions.includes(this.config.region) && modelId.startsWith('anthropic.');
  }
}

/**
 * Create a BedrockLlmProvider with default configuration.
 * Reads BEDROCK_REGION from environment if set.
 */
export function createBedrockLlmProvider(
  config?: Partial<LlmProviderConfig>,
): BedrockLlmProvider {
  return new BedrockLlmProvider(config);
}
