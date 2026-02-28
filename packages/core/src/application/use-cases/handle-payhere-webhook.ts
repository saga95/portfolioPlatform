import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { SubscriptionRepository } from '../../domain/ports/subscription-repository.js';
import type { HandlePayHereWebhookCommand, SubscriptionDTO } from '../dtos/index.js';
import {
  type DomainError,
  SubscriptionNotFoundError,
  PayHereWebhookVerificationError,
} from '../../domain/errors/index.js';
import { SubscriptionMapper } from '../mappers/subscription-mapper.js';

export interface WebhookHashGenerator {
  md5(input: string): string;
}

/**
 * Handles PayHere webhook notifications (notify_url callback).
 *
 * PayHere sends POST requests with payment/subscription status updates.
 * This use case:
 * 1. Verifies the md5sig signature
 * 2. Updates the subscription status based on the webhook data
 *
 * Payment status codes: 2=success, 0=pending, -1=canceled, -2=failed, -3=chargedback
 * Recurring message types:
 *  - AUTHORIZATION_SUCCESS, AUTHORIZATION_FAILED
 *  - RECURRING_INSTALLMENT_SUCCESS, RECURRING_INSTALLMENT_FAILED
 *  - RECURRING_COMPLETE, RECURRING_STOPPED
 */
export class HandlePayHereWebhookUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly merchantId: string,
    private readonly merchantSecret: string,
    private readonly hashGenerator: WebhookHashGenerator,
  ) {}

  async execute(
    command: HandlePayHereWebhookCommand,
  ): Promise<Result<SubscriptionDTO, DomainError>> {
    try {
      // 1. Verify md5sig signature
      // md5sig = UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(merchant_secret))))
      const hashedSecret = this.hashGenerator.md5(this.merchantSecret).toUpperCase();
      const expectedSig = this.hashGenerator.md5(
        `${command.merchantId}${command.orderId}${command.payhereAmount}${command.payhereCurrency}${command.statusCode}${hashedSecret}`,
      ).toUpperCase();

      if (expectedSig !== command.md5sig) {
        return err(new PayHereWebhookVerificationError());
      }

      // 2. Find the subscription
      // custom_2 contains the subscriptionId; orderId is also the subscriptionId
      const subscriptionIdStr = command.custom2 ?? command.orderId;

      // Try to find by PayHere subscription ID first, then by our subscription ID
      let subscription = command.subscriptionId
        ? await this.subscriptionRepo.findByPayhereSubscriptionId(command.subscriptionId)
        : null;

      if (!subscription) {
        // Look up by our internal orderId (which matches subscriptionId value)
        const { SubscriptionId } = await import('../../domain/value-objects/subscription-id.js');
        const { TenantId } = await import('../../domain/value-objects/tenant-id.js');

        // custom_1 = tenantId, custom_2/order_id = subscriptionId
        if (!command.custom1) {
          return err(new SubscriptionNotFoundError(subscriptionIdStr));
        }

        const tenantId = TenantId.create(command.custom1);
        if (tenantId instanceof Error) return err(tenantId as DomainError);

        const subId = SubscriptionId.create(subscriptionIdStr);
        if (subId instanceof Error) return err(subId as DomainError);

        subscription = await this.subscriptionRepo.findById(tenantId, subId);
      }

      if (!subscription) {
        return err(new SubscriptionNotFoundError(subscriptionIdStr));
      }

      // 3. Process based on status code and message type
      const statusCode = parseInt(command.statusCode, 10);
      let updated = subscription;

      if (command.messageType) {
        // Recurring subscription event
        switch (command.messageType) {
          case 'AUTHORIZATION_SUCCESS':
            updated = subscription.activate(command.subscriptionId);
            break;
          case 'AUTHORIZATION_FAILED':
          case 'RECURRING_STOPPED':
            updated = subscription.cancel();
            break;
          case 'RECURRING_INSTALLMENT_SUCCESS': {
            if (subscription.status === 'past_due') {
              updated = subscription.activate();
            }
            // Renew period if next date is provided
            if (command.itemRecDateNext) {
              const nextDate = new Date(command.itemRecDateNext);
              const periodEnd = new Date(nextDate);
              periodEnd.setMonth(periodEnd.getMonth() + 1);
              updated = updated.renewPeriod(
                new Date().toISOString(),
                periodEnd.toISOString(),
              );
            }
            break;
          }
          case 'RECURRING_INSTALLMENT_FAILED':
            updated = subscription.markPastDue();
            break;
          case 'RECURRING_COMPLETE':
            updated = subscription.cancel();
            break;
        }
      } else {
        // One-time checkout status (initial payment)
        if (statusCode === 2) {
          // Success
          updated = subscription.activate(command.subscriptionId);
        } else if (statusCode === -1 || statusCode === -3) {
          // Canceled or chargedback
          updated = subscription.cancel();
        } else if (statusCode === -2) {
          // Failed
          updated = subscription.markPastDue();
        }
        // status 0 (pending) — no action, keep current state
      }

      // 4. Persist
      await this.subscriptionRepo.save(updated);

      return ok(SubscriptionMapper.toDTO(updated));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
