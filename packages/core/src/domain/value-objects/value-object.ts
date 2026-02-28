/**
 * Base class for all value objects providing equality semantics.
 * Value objects are compared by value, not by reference.
 */
export abstract class ValueObject<T> {
  constructor(public readonly value: T) {
    Object.freeze(this);
  }

  equals(other: ValueObject<T>): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
