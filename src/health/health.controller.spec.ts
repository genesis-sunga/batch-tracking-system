import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('health HTTP integration', () => {
  let app: INestApplication;
  const query = jest.fn().mockResolvedValue([{ ready: 1 }]);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: { isInitialized: true, query },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness and database readiness endpoints over HTTP', async () => {
    const address = app.getHttpServer().address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/health`;
    const [live, ready] = await Promise.all([
      fetch(`${baseUrl}/live`),
      fetch(`${baseUrl}/ready`),
    ]);

    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ status: 'ok' });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ok', database: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });
});
