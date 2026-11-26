import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums';
import { CreateLocationDto } from './dto/create-location.dto';
import { Location } from './location.entity';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR)
  create(
    @Body() input: CreateLocationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Location> {
    return this.locations.create(input, actor);
  }

  @Get()
  findAll(): Promise<Location[]> {
    return this.locations.findAll();
  }
}
