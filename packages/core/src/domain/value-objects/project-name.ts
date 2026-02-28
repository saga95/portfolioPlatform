import { ValueObject } from './value-object.js';

const MAX_LENGTH = 100;

export class ProjectName extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): ProjectName {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error('ProjectName must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new Error(`ProjectName must not exceed ${MAX_LENGTH} characters`);
    }
    return new ProjectName(trimmed);
  }
}
