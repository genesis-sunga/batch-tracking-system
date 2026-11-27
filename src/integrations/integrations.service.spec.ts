import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';
import { IntegrationOutbox } from './integration-outbox.entity';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService outbox', () => {
  it('enqueues a correlated event through the transaction manager when enabled', async () => {
    const outboxRepository = {
      create: jest.fn((value: Partial<IntegrationOutbox>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(outboxRepository),
    };
    const config = {
      get: jest.fn().mockReturnValue('https://erp.example.test/events'),
    };
    const service = new IntegrationsService(
      config as unknown as ConfigService,
      {} as Repository<IntegrationOutbox>,
    );

    await service.enqueue(manager as unknown as EntityManager, 'purchase_order.created', {
      id: 9,
    });

    expect(manager.getRepository).toHaveBeenCalledWith(IntegrationOutbox);
    expect(outboxRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        eventType: 'purchase_order.created',
        data: { id: 9 },
      }),
    );
  });
});
