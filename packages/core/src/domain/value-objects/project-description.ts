import { ValueObject } from './value-object.js';

const MAX_LENGTH = 2000;

export class ProjectDescription extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): ProjectDescription {
    if (value.length > MAX_LENGTH) {
      throw new Error(`ProjectDescription must not exceed ${MAX_LENGTH} characters`);
    }
    return new ProjectDescription(value);
  }
}
