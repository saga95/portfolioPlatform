import { ValueObject } from './value-object.js';

/**
 * Unique identifier for a deployment.
 * Format: deploy_{uuid}
 */
export class DeploymentId extends ValueObject<string> {
  private static readonly PREFIX = 'deploy_';

  private constructor(value: string) {
    super(value);
  }

  static create(value: string): DeploymentId {
    if (!value || value.trim().length === 0) {
      throw new Error('DeploymentId must not be empty');
    }
    if (!value.startsWith(DeploymentId.PREFIX)) {
      throw new Error('DeploymentId must start with "deploy_"');
    }
    return new DeploymentId(value);
  }
}
