import type { Subscription } from '../../domain/entities/subscription.js';
import type { SubscriptionDTO } from '../dtos/index.js';

/**
 * Maps between Subscription domain entity and SubscriptionDTO.
 */
export class SubscriptionMapper {
  static toDTO(subscription: Subscription): SubscriptionDTO {
    return {
      subscriptionId: subscription.subscriptionId.value,
      tenantId: subscription.tenantId.value,
      payhereSubscriptionId: subscription.payhereSubscriptionId,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      cancelledAt: subscription.cancelledAt,
    };
  }
}
