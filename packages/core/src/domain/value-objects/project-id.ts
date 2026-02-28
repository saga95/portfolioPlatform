import { ValueObject } from './value-object.js';

export class ProjectId extends ValueObject<string> {
  private static readonly PREFIX = 'proj_';

  private constructor(value: string) {
    super(value);
  }

  static create(value: string): ProjectId {
    if (!value || value.trim().length === 0) {
      throw new Error('ProjectId must not be empty');
    }
    if (!value.startsWith(ProjectId.PREFIX)) {
      throw new Error('ProjectId must start with "proj_"');
    }
    return new ProjectId(value);
  }
}
