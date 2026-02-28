import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { SubscriptionRepository } from '../../domain/ports/subscription-repository.js';
import type { ListSubscriptionsQuery, SubscriptionListDTO } from '../dtos/index.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import type { DomainError } from '../../domain/errors/index.js';
import { SubscriptionMapper } from '../mappers/subscription-mapper.js';

/**
 * Lists all subscriptions for a tenant.
 */
export class ListSubscriptionsUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(
    query: ListSubscriptionsQuery,
  ): Promise<Result<SubscriptionListDTO, DomainError>> {
    try {
      const tenantId = TenantId.create(query.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      const result = await this.subscriptionRepo.findByTenantId(
        tenantId,
        query.nextToken,
      );

      return ok({
        subscriptions: result.subscriptions.map(SubscriptionMapper.toDTO),
        nextToken: result.nextToken,
      });
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
