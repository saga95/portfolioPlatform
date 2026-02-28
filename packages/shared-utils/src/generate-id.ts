import { randomUUID } from 'node:crypto';

/**
 * Generate a prefixed unique identifier.
 *
 * @param prefix - Entity prefix (e.g., 'proj', 'tenant', 'deploy')
 * @returns A prefixed UUID string like `proj_a1b2c3d4-...`
 */
export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
