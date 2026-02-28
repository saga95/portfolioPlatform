/**
 * Port for generating unique identifiers.
 * Allows domain to request IDs without depending on any specific implementation.
 */
export interface IdGenerator {
  generate(prefix: string): string;
}
