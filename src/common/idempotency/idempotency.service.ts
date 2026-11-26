import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { IdempotencyRecord } from './idempotency-record.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(IdempotencyRecord)
    private readonly records: Repository<IdempotencyRecord>,
  ) {}

  async execute<T>(
    scope: string,
    key: string | undefined,
    request: unknown,
    operation: (manager: import('typeorm').EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!key || key.length > 128 || key.trim() !== key) {
      throw new BadRequestException('A valid Idempotency-Key header is required');
    }

    const requestHash = createHash('sha256').update(this.stableStringify(request)).digest('hex');
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(IdempotencyRecord);
        const existing = await repository.findOneBy({ scope, key });
        if (existing?.response !== null && existing?.response !== undefined) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException('Idempotency-Key was already used with a different request');
          }
          return existing.response as T;
        }
        await repository.insert({ scope, key, requestHash, response: null });
        const result = await operation(manager);
        await repository.update({ scope, key }, { response: result });
        return result;
      });
    } catch (error) {
      if (!this.isDuplicateKey(error)) throw error;
      const completed = await this.records.findOneBy({ scope, key });
      if (completed?.response !== null && completed?.response !== undefined) {
        if (completed.requestHash !== requestHash) {
          throw new ConflictException('Idempotency-Key was already used with a different request');
        }
        return completed.response as T;
      }
      throw error;
    }
  }

  private isDuplicateKey(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as { code?: string };
    return driverError.code === 'ER_DUP_ENTRY';
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
      return `{${entries
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }
}
