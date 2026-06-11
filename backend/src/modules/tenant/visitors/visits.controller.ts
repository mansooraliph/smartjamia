import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { FRONT_OFFICE_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  ExportColumn,
  ExportService,
} from '../../../common/export/export.service';
import { VisitsService } from './visits.service';
import {
  CheckInDto,
  CheckOutDto,
  CreateVisitDto,
  RejectVisitDto,
  VisitListQueryDto,
} from './dto/visit.dto';

type VisitExportRow = Awaited<ReturnType<VisitsService['exportRows']>>[number];

const VISIT_EXPORT_COLUMNS: ExportColumn<VisitExportRow>[] = [
  { header: 'Visitor', value: (r) => r.visitor, width: 22 },
  { header: 'Relation', value: (r) => r.relation },
  { header: 'Mobile', value: (r) => r.mobile, width: 16 },
  { header: 'Student', value: (r) => r.student, width: 22 },
  { header: 'Admission #', value: (r) => r.admissionNumber, width: 16 },
  { header: 'Meeting with', value: (r) => r.meetingWith, width: 18 },
  { header: 'Purpose', value: (r) => r.purpose, width: 20 },
  { header: 'Party', value: (r) => r.partySize },
  { header: 'Scheduled', value: (r) => r.scheduled, width: 18 },
  { header: 'Status', value: (r) => r.status },
  { header: 'Check-in', value: (r) => r.checkIn, width: 18 },
  { header: 'Check-out', value: (r) => r.checkOut, width: 18 },
  { header: 'Mins', value: (r) => r.durationMin },
  { header: 'Pass #', value: (r) => r.passNumber },
];

@ApiTags('school/visits')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...FRONT_OFFICE_ROLES)
@Controller('school/visits')
export class VisitsController {
  constructor(
    private readonly svc: VisitsService,
    private readonly exporter: ExportService,
  ) {}

  @RequirePermissions('/visits:list')
  @Get()
  list(@Tenant() t: TenantContext, @Query() q: VisitListQueryDto) {
    return this.svc.list(t.schemaName, t.schoolId, q);
  }

  @RequirePermissions('/visits:list')
  @Get('summary')
  @ApiOperation({ summary: 'Live counts: inside now, pending, scheduled today' })
  summary(@Tenant() t: TenantContext) {
    return this.svc.summary(t.schemaName, t.schoolId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export visit history as Excel or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Query() q: VisitListQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.svc.exportRows(t.schemaName, t.schoolId, q);
    await this.exporter.send(
      res,
      q.format === 'pdf' ? 'pdf' : 'xlsx',
      'visit-history',
      'Visit History',
      VISIT_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get(':id')
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/visits:create')
  @Post()
  @ApiOperation({ summary: 'Create a visit request' })
  create(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateVisitDto,
  ) {
    return this.svc.createRequest(t.schemaName, t.schoolId, userId, dto);
  }

  @RequirePermissions('/visits:create')
  @Post(':id/approve')
  approve(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.approve(t.schemaName, t.schoolId, userId, id);
  }

  @RequirePermissions('/visits:create')
  @Post(':id/reject')
  reject(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectVisitDto,
  ) {
    return this.svc.reject(t.schemaName, t.schoolId, userId, id, dto);
  }

  @RequirePermissions('/visits:create')
  @Post(':id/check-in')
  @ApiOperation({ summary: 'Record actual entry (visit entry)' })
  checkIn(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CheckInDto,
  ) {
    return this.svc.checkIn(t.schemaName, t.schoolId, userId, id, dto);
  }

  @RequirePermissions('/visits:create')
  @Post(':id/check-out')
  @ApiOperation({ summary: 'Record exit + compute time spent' })
  checkOut(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.svc.checkOut(t.schemaName, t.schoolId, id, dto);
  }

  @RequirePermissions('/visits:create')
  @Post(':id/cancel')
  cancel(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.cancel(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/visits:create')
  @Post(':id/no-show')
  noShow(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.markNoShow(t.schemaName, t.schoolId, id);
  }
}
