import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../common/audit/audit.module';
import { Supplier } from './supplier.entity';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier]), AuditModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [TypeOrmModule],
})
export class SuppliersModule {}
