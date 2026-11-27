import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { exportReport } from './report-exporter';
import { CreateReportJobDto, ReportQueryDto } from './report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('stock')
  async stock(@Query() query: ReportQueryDto, @Res() response: Response): Promise<void> {
    exportReport(
      response,
      'stock-report',
      'Current stock by batch and location',
      await this.reports.stock(query),
      query.format,
    );
  }

  @Get('expiry')
  async expiry(@Query() query: ReportQueryDto, @Res() response: Response): Promise<void> {
    exportReport(
      response,
      'expiry-report',
      'Batch expiry report',
      await this.reports.expiry(query),
      query.format,
    );
  }

  @Get('quality')
  async quality(@Query() query: ReportQueryDto, @Res() response: Response): Promise<void> {
    exportReport(
      response,
      'quality-report',
      'Quality test summary',
      await this.reports.quality(query),
      query.format,
    );
  }

  @Get('purchase-orders')
  async purchaseOrders(@Query() query: ReportQueryDto, @Res() response: Response): Promise<void> {
    exportReport(
      response,
      'purchase-order-report',
      'Purchase order fulfillment',
      await this.reports.purchaseOrderFulfillment(query),
      query.format,
    );
  }

  @Get('movements')
  async movements(@Query() query: ReportQueryDto, @Res() response: Response): Promise<void> {
    exportReport(
      response,
      'batch-movement-report',
      'Batch movement and traceability log',
      await this.reports.movementLog(query),
      query.format,
    );
  }

  @Post('jobs')
  @Roles(UserRole.ADMIN)
  createJob(@Body() input: CreateReportJobDto) {
    const { reportType, ...filters } = input;
    return this.reports.createJob(reportType, filters);
  }

  @Get('jobs/:id')
  @Roles(UserRole.ADMIN)
  getJob(@Param('id', ParseIntPipe) id: number) {
    return this.reports.getJob(id);
  }
}
