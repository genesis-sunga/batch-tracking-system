import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Location } from './location.entity';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
  ) {}

  create(input: CreateLocationDto, actor: AuthenticatedUser): Promise<Location> {
    return this.dataSource.transaction(async (manager) => {
      const locationRepository = manager.getRepository(Location);
      const location = await locationRepository.save(locationRepository.create(input));
      await this.audit.record(manager, actor, 'location_created', 'location', location.id, {
        code: location.code,
      });
      return location;
    });
  }

  findAll(): Promise<Location[]> {
    return this.locations.find({ order: { code: 'ASC' } });
  }
}
