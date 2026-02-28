import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { SubscriptionRepository } from '../../domain/ports/subscription-repository.js';
import type { GetSubscriptionQuery, SubscriptionDTO } from '../dtos/index.js';
import { SubscriptionId } from '../../domain/value-objects/subscription-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import {
  type DomainError,
  SubscriptionNotFoundError,
} from '../../domain/errors/index.js';
import { SubscriptionMapper } from '../mappers/subscription-mapper.js';

/**
 * Retrieves a single subscription by ID.
 */
export class GetSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(
    query: GetSubscriptionQuery,
  ): Promise<Result<SubscriptionDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const subscriptionId = SubscriptionId.create(query.subscriptionId);
      if (subscriptionId instanceof Error) return err(subscriptionId as DomainError);

      const subscription = await this.subscriptionRepo.findById(tenantId, subscriptionId);
      if (!subscription) {
        return err(new SubscriptionNotFoundError(query.subscriptionId));
      }

      return ok(SubscriptionMapper.toDTO(subscription));
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
