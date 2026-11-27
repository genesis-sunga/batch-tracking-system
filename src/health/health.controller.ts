import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok'; database: 'ok' }> {
    if (!this.dataSource.isInitialized) {
      throw new ServiceUnavailableException('Database is not ready');
    }
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'ok' };
    } catch (error) {
      this.logger.warn(
        `Database readiness probe failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}
