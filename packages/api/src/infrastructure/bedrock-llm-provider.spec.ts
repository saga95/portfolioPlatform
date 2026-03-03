import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { BedrockLlmProvider, createBedrockLlmProvider } from './bedrock-llm-provider.js';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  ThrottlingException,
  ValidationException,
  ModelTimeoutException,
} from '@aws-sdk/client-bedrock-runtime';
import type { LlmRequest, LlmModelId } from '@promptdeploy/shared-types';

// Mock the BedrockRuntimeClient
vi.mock('@aws-sdk/client-bedrock-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-bedrock-runtime')>();
  return {
    ...actual,
    BedrockRuntimeClient: vi.fn().mockImplementation(function () {
      return {
        send: vi.fn(),
      };
    }),
  };
});

describe('BedrockLlmProvider', () => {
  let provider: BedrockLlmProvider;
  let mockSend: Mock;

  const defaultRequest: LlmRequest = {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0' as LlmModelId,
    messages: [{ role: 'user', content: 'Hello, world!' }],
    maxTokens: 1024,
    temperature: 0.7,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new BedrockLlmProvider({ region: 'us-east-1' });
    // Get the mock send function from the client
    mockSend = (provider as unknown as { client: { send: Mock } }).client.send;
  });

  describe('invoke', () => {
    it('should return successful response with token counts', async () => {
      mockSend.mockResolvedValue({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Hello! How can I help you?' }],
          },
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
        },
        stopReason: 'end_turn',
      });

      const result = await provider.invoke(defaultRequest);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('Hello! How can I help you?');
        expect(result.value.inputTokens).toBe(10);
        expect(result.value.outputTokens).toBe(8);
        expect(result.value.stopReason).toBe('end_turn');
        expect(result.value.modelId).toBe(defaultRequest.modelId);
      }
    });

    it('should include system prompt when provided', async () => {
      mockSend.mockResolvedValue({
        output: { message: { content: [{ text: 'Response' }] } },
        usage: { inputTokens: 15, outputTokens: 5 },
        stopReason: 'end_turn',
      });

      const requestWithSystem: LlmRequest = {
        ...defaultRequest,
        systemPrompt: 'You are a helpful assistant.',
      };

      await provider.invoke(requestWithSystem);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.system).toEqual([{ text: 'You are a helpful assistant.' }]);
    });

    it('should handle rate limiting with fallback model', async () => {
      // First call throws ThrottlingException
      mockSend
        .mockRejectedValueOnce(new ThrottlingException({ $metadata: {}, message: 'Rate limited' }))
        .mockResolvedValueOnce({
          output: { message: { content: [{ text: 'Fallback response' }] } },
          usage: { inputTokens: 10, outputTokens: 5 },
          stopReason: 'end_turn',
        });

      const result = await provider.invoke(defaultRequest);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('Fallback response');
      }
      // Should have called twice - original and fallback
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return error for validation exception', async () => {
      mockSend.mockRejectedValue(
        new ValidationException({ $metadata: {}, message: 'Invalid model ID' }),
      );

      const result = await provider.invoke(defaultRequest);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_REQUEST');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('should return error for timeout', async () => {
      mockSend.mockRejectedValue(
        new ModelTimeoutException({ $metadata: {}, message: 'Timeout' }),
      );

      const result = await provider.invoke(defaultRequest);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TIMEOUT');
        expect(result.error.retryable).toBe(true);
        expect(result.error.retryAfterMs).toBeDefined();
      }
    });

    it('should map different stop reasons correctly', async () => {
      const stopReasons = ['end_turn', 'max_tokens', 'stop_sequence', 'content_filtered'];

      for (const stopReason of stopReasons) {
        mockSend.mockResolvedValueOnce({
          output: { message: { content: [{ text: 'Response' }] } },
          usage: { inputTokens: 10, outputTokens: 5 },
          stopReason,
        });

        const result = await provider.invoke(defaultRequest);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.stopReason).toBe(stopReason);
        }
      }
    });

    it('should handle multiple content blocks', async () => {
      mockSend.mockResolvedValue({
        output: {
          message: {
            content: [{ text: 'First part. ' }, { text: 'Second part.' }],
          },
        },
        usage: { inputTokens: 10, outputTokens: 10 },
        stopReason: 'end_turn',
      });

      const result = await provider.invoke(defaultRequest);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('First part. Second part.');
      }
    });
  });

  describe('invokeStream', () => {
    it('should yield stream chunks', async () => {
      const mockStream = (async function* () {
        yield { messageStart: { role: 'assistant' } };
        yield { contentBlockDelta: { delta: { text: 'Hello' } } };
        yield { contentBlockDelta: { delta: { text: ' world' } } };
        yield { messageStop: { stopReason: 'end_turn' } };
        yield { metadata: { usage: { inputTokens: 5, outputTokens: 3 } } };
      })();

      mockSend.mockResolvedValue({ stream: mockStream });

      const chunks: unknown[] = [];
      for await (const chunk of provider.invokeStream(defaultRequest)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(5);
      expect(chunks[0]).toEqual({ ok: true, value: { type: 'message_start' } });
      expect(chunks[1]).toEqual({
        ok: true,
        value: { type: 'content_delta', content: 'Hello' },
      });
      expect(chunks[2]).toEqual({
        ok: true,
        value: { type: 'content_delta', content: ' world' },
      });
      expect(chunks[3]).toEqual({
        ok: true,
        value: { type: 'message_stop', stopReason: 'end_turn' },
      });
      expect(chunks[4]).toEqual({
        ok: true,
        value: { type: 'metadata', inputTokens: 5, outputTokens: 3 },
      });
    });

    it('should yield error when stream is missing', async () => {
      mockSend.mockResolvedValue({ stream: null });

      const chunks: unknown[] = [];
      for await (const chunk of provider.invokeStream(defaultRequest)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual({
        ok: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'No stream returned from Bedrock',
          retryable: false,
        },
      });
    });
  });

  describe('isModelAvailable', () => {
    it('should return true for Claude models in supported regions', async () => {
      const provider = new BedrockLlmProvider({ region: 'us-east-1' });
      const available = await provider.isModelAvailable(
        'anthropic.claude-3-5-sonnet-20241022-v2:0',
      );
      expect(available).toBe(true);
    });

    it('should return false for non-Claude models', async () => {
      const provider = new BedrockLlmProvider({ region: 'us-east-1' });
      const available = await provider.isModelAvailable(
        'some.other-model' as LlmModelId,
      );
      expect(available).toBe(false);
    });
  });

  describe('createBedrockLlmProvider', () => {
    it('should create provider with default config', () => {
      const provider = createBedrockLlmProvider();
      expect(provider).toBeInstanceOf(BedrockLlmProvider);
    });

    it('should create provider with custom config', () => {
      const provider = createBedrockLlmProvider({
        region: 'eu-west-1',
        maxRetries: 5,
      });
      expect(provider).toBeInstanceOf(BedrockLlmProvider);
    });
  });
});
