/**
 * Domain validation guard clauses.
 * Use in value objects and entities to enforce invariants.
 */
export class Guard {
  static againstNullOrUndefined(value: unknown, name: string): void {
    if (value === null || value === undefined) {
      throw new Error(`${name} is required`);
    }
  }

  static againstEmpty(value: string, name: string): void {
    Guard.againstNullOrUndefined(value, name);
    if (value.trim().length === 0) {
      throw new Error(`${name} must not be empty`);
    }
  }

  static againstLengthExceeded(value: string, maxLength: number, name: string): void {
    if (value.length > maxLength) {
      throw new Error(`${name} must not exceed ${maxLength} characters`);
    }
  }

  static againstInvalidFormat(value: string, regex: RegExp, name: string): void {
    if (!regex.test(value)) {
      throw new Error(`${name} has an invalid format`);
    }
  }

  static isOneOf<T>(value: T, validValues: T[], name: string): void {
    if (!validValues.includes(value)) {
      throw new Error(`${name} must be one of: ${validValues.join(', ')}`);
    }
  }
}
