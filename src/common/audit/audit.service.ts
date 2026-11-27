import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: number,
    details: Record<string, unknown> | null = null,
  ): Promise<void> {
    const repository = manager.getRepository(AuditLog);
    await repository.save(
      repository.create({
        actorId: actor.id,
        actorEmail: actor.email,
        action,
        entityType,
        entityId,
        details,
      }),
    );
  }

  findRecent(): Promise<AuditLog[]> {
    return this.logs.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
