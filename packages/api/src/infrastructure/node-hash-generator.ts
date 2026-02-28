import { createHash } from 'node:crypto';
import type { HashGenerator, WebhookHashGenerator } from '@promptdeploy/core';

/**
 * MD5 hash generator using Node.js built-in crypto module.
 *
 * Used for:
 *  - Generating checkout hash: UPPER(MD5(merchant_id + order_id + amount + currency + UPPER(MD5(merchant_secret))))
 *  - Verifying webhook md5sig: UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(merchant_secret))))
 */
export class NodeHashGenerator implements HashGenerator, WebhookHashGenerator {
  md5(input: string): string {
    return createHash('md5').update(input).digest('hex');
  }
}
