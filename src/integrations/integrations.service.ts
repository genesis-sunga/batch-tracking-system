import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { IntegrationOutbox } from './integration-outbox.entity';

const POLL_INTERVAL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;
const LEASE_DURATION_MS = 30_000;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;
const MAX_RETRY_DELAY_MS = 15 * 60_000;

@Injectable()
export class IntegrationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationsService.name);
  private timer: NodeJS.Timeout | undefined;
  private draining = false;
  private consecutiveFailures = 0;
  private circuitOpenedUntil = 0;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(IntegrationOutbox)
    private readonly outbox: Repository<IntegrationOutbox>,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.drain(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(
    manager: EntityManager,
    eventType: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.config.get<string>('INTEGRATION_WEBHOOK_URL')) return;
    const repository = manager.getRepository(IntegrationOutbox);
    await repository.save(
      repository.create({
        eventId: randomUUID(),
        eventType,
        data,
        attempts: 0,
        availableAt: new Date(),
        leasedUntil: null,
        deliveredAt: null,
        lastError: null,
      }),
    );
  }

  private async drain(): Promise<void> {
    if (this.draining || !this.config.get<string>('INTEGRATION_WEBHOOK_URL')) return;
    if (Date.now() < this.circuitOpenedUntil) return;

    this.draining = true;
    try {
      const now = new Date();
      const dueEvents = await this.outbox
        .createQueryBuilder('event')
        .where('event.deliveredAt IS NULL')
        .andWhere('event.availableAt <= :now', { now })
        .andWhere('(event.leasedUntil IS NULL OR event.leasedUntil < :now)', { now })
        .orderBy('event.id', 'ASC')
        .take(10)
        .getMany();

      for (const event of dueEvents) {
        if (Date.now() < this.circuitOpenedUntil) break;
        const leaseUntil = new Date(Date.now() + LEASE_DURATION_MS);
        const claim = await this.outbox
          .createQueryBuilder()
          .update(IntegrationOutbox)
          .set({ leasedUntil: leaseUntil })
          .where('id = :id AND deliveredAt IS NULL', { id: event.id })
          .andWhere('availableAt <= :now', { now })
          .andWhere('(leasedUntil IS NULL OR leasedUntil < :now)', { now })
          .execute();
        if (!claim.affected) continue;

        await this.deliver(event);
      }
    } catch (error) {
      this.logger.error(`Unable to process integration outbox: ${this.errorMessage(error)}`);
    } finally {
      this.draining = false;
    }
  }

  private async deliver(event: IntegrationOutbox): Promise<void> {
    const url = this.config.getOrThrow<string>('INTEGRATION_WEBHOOK_URL');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-correlation-id': event.eventId,
      'x-event-id': event.eventId,
    };
    const token = this.config.get<string>('INTEGRATION_WEBHOOK_TOKEN');
    if (token) headers.authorization = `Bearer ${token}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          eventId: event.eventId,
          eventType: event.eventType,
          occurredAt: event.createdAt,
          data: event.data,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);

      const responseCorrelationId =
        response.headers.get('x-correlation-id') ?? response.headers.get('x-request-id');
      await this.outbox.update(event.id, {
        deliveredAt: new Date(),
        leasedUntil: null,
        lastError: null,
      });
      this.consecutiveFailures = 0;
      this.logger.log(
        `Delivered event ${event.eventId} (${event.eventType})` +
          (responseCorrelationId ? `; remote correlation ID ${responseCorrelationId}` : ''),
      );
    } catch (error) {
      const attempts = event.attempts + 1;
      const retryDelay = Math.min(1_000 * 2 ** Math.min(attempts - 1, 10), MAX_RETRY_DELAY_MS);
      const message = this.errorMessage(error).slice(0, 2_000);
      await this.outbox.update(event.id, {
        attempts,
        availableAt: new Date(Date.now() + retryDelay),
        leasedUntil: null,
        lastError: message,
      });
      this.consecutiveFailures += 1;
      this.logger.error(
        `Delivery failed for event ${event.eventId} (${event.eventType}), attempt ${attempts}: ${message}`,
      );
      if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        this.circuitOpenedUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        this.logger.warn(`Integration circuit opened for ${CIRCUIT_COOLDOWN_MS}ms`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown integration error';
  }
}
