import { ValueObject } from './value-object.js';

/**
 * Unique identifier for an agent execution.
 * Format: exec_{uuid}
 */
export class ExecutionId extends ValueObject<string> {
  private static readonly PREFIX = 'exec_';

  private constructor(value: string) {
    super(value);
  }

  static create(value: string): ExecutionId {
    if (!value || value.trim().length === 0) {
      throw new Error('ExecutionId must not be empty');
    }
    if (!value.startsWith(ExecutionId.PREFIX)) {
      throw new Error('ExecutionId must start with "exec_"');
    }
    return new ExecutionId(value);
  }
}
