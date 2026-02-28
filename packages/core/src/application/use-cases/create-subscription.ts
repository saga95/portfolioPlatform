import type { Result } from '@promptdeploy/shared-utils';
import { ok, err } from '@promptdeploy/shared-utils';
import type { SubscriptionRepository } from '../../domain/ports/subscription-repository.js';
import type { IdGenerator } from '../../domain/ports/id-generator.js';
import type { CreateSubscriptionCommand, CheckoutSessionDTO } from '../dtos/index.js';
import { Subscription } from '../../domain/entities/subscription.js';
import { SubscriptionId } from '../../domain/value-objects/subscription-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import {
  type DomainError,
  SubscriptionAlreadyExistsError,
} from '../../domain/errors/index.js';

/**
 * Plan pricing in USD.
 */
const PLAN_PRICES: Record<string, { amount: number; recurrence: string; duration: string }> = {
  pro: { amount: 29.00, recurrence: '1 Month', duration: 'Forever' },
  team: { amount: 79.00, recurrence: '1 Month', duration: 'Forever' },
  enterprise: { amount: 199.00, recurrence: '1 Month', duration: 'Forever' },
};

export interface PayHereConfig {
  readonly merchantId: string;
  readonly merchantSecret: string;
  readonly notifyUrl: string;
  readonly returnUrl: string;
  readonly cancelUrl: string;
  readonly sandbox: boolean;
}

export interface HashGenerator {
  md5(input: string): string;
}

/**
 * Creates a new subscription and returns PayHere checkout session data.
 *
 * Guards:
 * - No active subscription must already exist
 * - Plan must be a paid plan (pro/team/enterprise)
 */
export class CreateSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly idGenerator: IdGenerator,
    private readonly payhereConfig: PayHereConfig,
    private readonly hashGenerator: HashGenerator,
  ) {}

  async execute(
    command: CreateSubscriptionCommand,
  ): Promise<Result<CheckoutSessionDTO, DomainError>> {
    try {
      // 1. Validate VOs
      const tenantId = TenantId.create(command.tenantId);
      if (tenantId instanceof Error) return err(tenantId as DomainError);

      // 2. Check for existing active subscription
      const existing = await this.subscriptionRepo.findActiveByTenantId(tenantId);
      if (existing) {
        return err(new SubscriptionAlreadyExistsError(command.tenantId));
      }

      // 3. Get plan pricing
      const pricing = PLAN_PRICES[command.plan];
      if (!pricing) {
        return err({
          name: 'ValidationError',
          message: `Invalid plan for subscription: ${command.plan}. Must be pro, team, or enterprise.`,
          code: 'VALIDATION_ERROR',
        } as DomainError);
      }

      // 4. Generate ID & create subscription
      const id = this.idGenerator.generate('sub_');
      const subscriptionId = SubscriptionId.create(id);
      if (subscriptionId instanceof Error) return err(subscriptionId as DomainError);

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const subscription = Subscription.create({
        subscriptionId,
        tenantId,
        plan: command.plan,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      });

      // 5. Persist
      await this.subscriptionRepo.save(subscription);

      // 6. Generate PayHere checkout params
      const actionUrl = this.payhereConfig.sandbox
        ? 'https://sandbox.payhere.lk/pay/checkout'
        : 'https://www.payhere.lk/pay/checkout';

      const amountFormatted = pricing.amount.toFixed(2);
      const currency = 'USD';
      const orderId = subscriptionId.value;

      // hash = UPPER(MD5(merchant_id + order_id + amount + currency + UPPER(MD5(merchant_secret))))
      const hashedSecret = this.hashGenerator.md5(this.payhereConfig.merchantSecret).toUpperCase();
      const hash = this.hashGenerator
        .md5(`${this.payhereConfig.merchantId}${orderId}${amountFormatted}${currency}${hashedSecret}`)
        .toUpperCase();

      const params: Record<string, string> = {
        merchant_id: this.payhereConfig.merchantId,
        return_url: this.payhereConfig.returnUrl,
        cancel_url: this.payhereConfig.cancelUrl,
        notify_url: this.payhereConfig.notifyUrl,
        order_id: orderId,
        items: `PromptDeploy ${command.plan} plan`,
        currency,
        amount: amountFormatted,
        recurrence: pricing.recurrence,
        duration: pricing.duration,
        hash,
        custom_1: command.tenantId,
        custom_2: subscriptionId.value,
      };

      return ok({
        subscriptionId: subscriptionId.value,
        actionUrl,
        params,
      });
    } catch (error) {
      return err(error as DomainError);
    }
  }
}
