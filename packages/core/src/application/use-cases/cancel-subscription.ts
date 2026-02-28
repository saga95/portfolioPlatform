import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { SubscriptionRepository } from '../../domain/ports/subscription-repository.js';
import type { CancelSubscriptionCommand, SubscriptionDTO } from '../dtos/index.js';
import { SubscriptionId } from '../../domain/value-objects/subscription-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import {
  type DomainError,
  SubscriptionNotFoundError,
} from '../../domain/errors/index.js';
import { SubscriptionMapper } from '../mappers/subscription-mapper.js';

/**
 * Cancels an existing subscription.
 *
 * Note: In a full implementation, this would also call PayHere's
 * Subscription Manager API to cancel the recurring charge.
 */
export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(
    command: CancelSubscriptionCommand,
  ): Promise<Result<SubscriptionDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(command.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const subscriptionId = SubscriptionId.create(command.subscriptionId);
      if (subscriptionId instanceof Error) return err(subscriptionId as DomainError);

      const subscription = await this.subscriptionRepo.findById(tenantId, subscriptionId);
      if (!subscription) {
        return err(new SubscriptionNotFoundError(command.subscriptionId));
      }

      const cancelled = subscription.cancel();
      await this.subscriptionRepo.save(cancelled);

      return ok(SubscriptionMapper.toDTO(cancelled));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
