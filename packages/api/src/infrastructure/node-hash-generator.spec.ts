import { describe, it, expect } from 'vitest';
import { NodeHashGenerator } from './node-hash-generator.js';

describe('NodeHashGenerator', () => {
  const hashGen = new NodeHashGenerator();

  it('should produce a valid MD5 hex string', () => {
    const result = hashGen.md5('hello');
    expect(result).toBe('5d41402abc4b2a76b9719d911017c592');
    expect(result).toHaveLength(32);
  });

  it('should produce uppercase hash when transformed', () => {
    const result = hashGen.md5('test_secret').toUpperCase();
    expect(result).toMatch(/^[A-F0-9]{32}$/);
  });

  it('should produce consistent results', () => {
    const a = hashGen.md5('same-input');
    const b = hashGen.md5('same-input');
    expect(a).toBe(b);
  });

  it('should produce correct PayHere-style checkout hash', () => {
    // Simulating: hash = UPPER(MD5(merchantId + orderId + amount + currency + UPPER(MD5(merchantSecret))))
    const merchantId = '1234567';
    const orderId = 'order_001';
    const amount = '29.00';
    const currency = 'USD';
    const merchantSecret = 'secret123';

    const hashedSecret = hashGen.md5(merchantSecret).toUpperCase();
    const hash = hashGen.md5(`${merchantId}${orderId}${amount}${currency}${hashedSecret}`).toUpperCase();

    expect(hash).toMatch(/^[A-F0-9]{32}$/);
  });
});
