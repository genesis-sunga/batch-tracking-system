import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
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

  async findAll(query: PaginationDto) {
    const builder = this.locations.createQueryBuilder('location');
    if (query.search) {
      builder.where('(location.code LIKE :search OR location.name LIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    const [data, total] = await builder
      .orderBy('location.code', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }
}
