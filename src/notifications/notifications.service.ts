import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { Batch } from '../batches/batch.entity';
import { BatchStatus, UserRole } from '../common/enums';
import { User } from '../users/user.entity';
import { EmailOutbox } from './email-outbox.entity';
import { EmailTemplate, renderEmail } from './email-templates';

const DELIVERY_INTERVAL_MS = 5_000;
const REMINDER_INTERVAL_MS = 24 * 60 * 60_000;
const LEASE_DURATION_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRY_DELAY_MS = 15 * 60_000;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;
const TERMINAL_BATCH_STATUSES = [
  BatchStatus.DISPATCHED,
  BatchStatus.REJECTED,
  BatchStatus.CONSUMED,
];

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: nodemailer.Transporter | undefined;
  private readonly from: string | undefined;
  private readonly expiryReminderDays: number;
  private deliveryTimer: NodeJS.Timeout | undefined;
  private reminderTimer: NodeJS.Timeout | undefined;
  private draining = false;
  private consecutiveFailures = 0;
  private circuitOpenedUntil = 0;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(EmailOutbox)
    private readonly outbox: Repository<EmailOutbox>,
    @InjectRepository(Batch)
    private readonly batches: Repository<Batch>,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from = this.config.get<string>('SMTP_FROM');
    if (host && !this.from) throw new Error('SMTP_FROM is required when SMTP_HOST is configured');
    if (host && this.from) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('SMTP_PORT must be a valid TCP port');
      }
      const username = this.config.get<string>('SMTP_USER');
      const password = this.config.get<string>('SMTP_PASSWORD');
      if (Boolean(username) !== Boolean(password)) {
        throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
      }
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: this.config.get<string>('SMTP_SECURE') === 'true' || port === 465,
        auth: username && password ? { user: username, pass: password } : undefined,
        connectionTimeout: REQUEST_TIMEOUT_MS,
        greetingTimeout: REQUEST_TIMEOUT_MS,
        socketTimeout: REQUEST_TIMEOUT_MS,
      });
    }

    this.expiryReminderDays = Number(this.config.get<string>('EXPIRY_REMINDER_DAYS') ?? 7);
    if (!Number.isInteger(this.expiryReminderDays) || this.expiryReminderDays < 1) {
      throw new Error('EXPIRY_REMINDER_DAYS must be a positive integer');
    }
  }

  onModuleInit(): void {
    if (!this.transporter) return;
    this.deliveryTimer = setInterval(() => void this.drain(), DELIVERY_INTERVAL_MS);
    this.deliveryTimer.unref();
    this.reminderTimer = setInterval(
      () => void this.queueScheduledReminders(),
      REMINDER_INTERVAL_MS,
    );
    this.reminderTimer.unref();
    void this.queueScheduledReminders();
  }

  onModuleDestroy(): void {
    if (this.deliveryTimer) clearInterval(this.deliveryTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
    this.transporter?.close();
  }

  async notifyRoles(
    manager: EntityManager,
    roles: UserRole[],
    template: EmailTemplate,
    data: Record<string, unknown>,
    dedupeKey?: string,
  ): Promise<void> {
    if (!this.transporter || roles.length === 0) return;
    const recipients = await manager.getRepository(User).find({
      select: { id: true, email: true },
      where: { role: In(roles) },
    });
    for (const recipient of recipients) {
      await this.queueEmail(
        manager,
        recipient.email,
        template,
        data,
        dedupeKey ? `${dedupeKey}:${recipient.id}` : null,
      );
    }
  }

  private async queueEmail(
    manager: EntityManager,
    recipient: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
    dedupeKey: string | null,
  ): Promise<void> {
    const repository = manager.getRepository(EmailOutbox);
    if (dedupeKey && (await repository.existsBy({ dedupeKey }))) return;
    try {
      await repository.save(
        repository.create({
          recipient,
          template,
          data,
          dedupeKey,
          attempts: 0,
          availableAt: new Date(),
          leasedUntil: null,
          sentAt: null,
          lastError: null,
        }),
      );
    } catch (error) {
      if (!this.isDuplicateKey(error)) throw error;
    }
  }

  private async drain(): Promise<void> {
    if (!this.transporter || this.draining || Date.now() < this.circuitOpenedUntil) return;
    this.draining = true;
    try {
      const now = new Date();
      const dueEmails = await this.outbox
        .createQueryBuilder('email')
        .where('email.sentAt IS NULL')
        .andWhere('email.availableAt <= :now', { now })
        .andWhere('(email.leasedUntil IS NULL OR email.leasedUntil < :now)', { now })
        .orderBy('email.id', 'ASC')
        .take(10)
        .getMany();

      for (const email of dueEmails) {
        if (Date.now() < this.circuitOpenedUntil) break;
        const claim = await this.outbox
          .createQueryBuilder()
          .update(EmailOutbox)
          .set({ leasedUntil: new Date(Date.now() + LEASE_DURATION_MS) })
          .where('id = :id AND sentAt IS NULL', { id: email.id })
          .andWhere('availableAt <= :now', { now })
          .andWhere('(leasedUntil IS NULL OR leasedUntil < :now)', { now })
          .execute();
        if (!claim.affected) continue;
        await this.send(email);
      }
    } catch (error) {
      this.logger.error(`Unable to process email outbox: ${this.errorMessage(error)}`);
    } finally {
      this.draining = false;
    }
  }

  private async send(email: EmailOutbox): Promise<void> {
    if (!this.transporter || !this.from) return;
    try {
      const rendered = renderEmail(email.template, email.data);
      await this.transporter.sendMail({
        from: this.from,
        to: email.recipient,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      await this.outbox.update(email.id, {
        sentAt: new Date(),
        leasedUntil: null,
        lastError: null,
      });
      this.consecutiveFailures = 0;
      this.logger.log(`Sent notification ${email.id}`);
    } catch (error) {
      const attempts = email.attempts + 1;
      const retryDelay = Math.min(1_000 * 2 ** Math.min(attempts - 1, 10), MAX_RETRY_DELAY_MS);
      const message = this.errorMessage(error).slice(0, 2_000);
      await this.outbox.update(email.id, {
        attempts,
        availableAt: new Date(Date.now() + retryDelay),
        leasedUntil: null,
        lastError: message,
      });
      this.consecutiveFailures += 1;
      this.logger.error(
        `Email ${email.id} to ${email.recipient} failed, attempt ${attempts}: ${message}`,
      );
      if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        this.circuitOpenedUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        this.logger.warn(`Email circuit opened for ${CIRCUIT_COOLDOWN_MS}ms`);
      }
    }
  }

  private async queueScheduledReminders(): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.batches.manager.transaction(async (manager) => {
        const now = new Date();
        const dayKey = now.toISOString().slice(0, 10);
        const expiryHorizon = new Date(
          now.getTime() + this.expiryReminderDays * 24 * 60 * 60_000,
        );
        const batchesNearExpiry = await manager
          .getRepository(Batch)
          .createQueryBuilder('batch')
          .where('batch.expiresAt IS NOT NULL')
          .andWhere('batch.expiresAt <= :expiryHorizon', { expiryHorizon })
          .andWhere('batch.quantity > 0')
          .andWhere('batch.status NOT IN (:...terminalStatuses)', {
            terminalStatuses: TERMINAL_BATCH_STATUSES,
          })
          .orderBy('batch.id', 'ASC')
          .getMany();
        for (const batch of batchesNearExpiry) {
          const daysRemaining = Math.ceil(
            ((batch.expiresAt?.getTime() ?? now.getTime()) - now.getTime()) / (24 * 60 * 60_000),
          );
          await this.notifyRoles(
            manager,
            [UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.WAREHOUSE_OPERATOR],
            'expiry_approaching',
            {
              batchNumber: batch.batchNumber,
              expiresAt: batch.expiresAt?.toISOString() ?? '',
              daysRemaining,
              quantity: batch.quantity,
              status: batch.status,
            },
            `expiry:${batch.id}:${dayKey}`,
          );
        }

        const quarantineCutoff = new Date(now.getTime() - REMINDER_INTERVAL_MS);
        const overdueQuarantines = await manager
          .getRepository(Batch)
          .createQueryBuilder('batch')
          .where('batch.status = :status', { status: BatchStatus.QUARANTINED })
          .andWhere('batch.quantity > 0')
          .andWhere('batch.updatedAt <= :quarantineCutoff', { quarantineCutoff })
          .orderBy('batch.id', 'ASC')
          .getMany();
        for (const batch of overdueQuarantines) {
          await this.notifyRoles(
            manager,
            [UserRole.ADMIN, UserRole.QA_INSPECTOR, UserRole.WAREHOUSE_OPERATOR],
            'quarantine_reminder',
            {
              batchNumber: batch.batchNumber,
              quantity: batch.quantity,
              status: batch.status,
              quarantinedSince: batch.updatedAt.toISOString(),
            },
            `quarantine:${batch.id}:${dayKey}`,
          );
        }
      });
    } catch (error) {
      this.logger.error(`Unable to queue scheduled reminders: ${this.errorMessage(error)}`);
    }
  }

  private isDuplicateKey(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as { code?: string };
    return driverError.code === 'ER_DUP_ENTRY';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown notification error';
  }
}
