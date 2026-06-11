import {
  Body,
  Controller,
  Delete,
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
import { ADMIN_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  ExportColumn,
  ExportService,
} from '../../../common/export/export.service';
import { TransferCertificatesService } from './transfer-certificates.service';
import { IssueTcDto, TcListQueryDto } from './dto/transfer-certificate.dto';

type TcExportRow = Awaited<
  ReturnType<TransferCertificatesService['exportRows']>
>[number];

const TC_EXPORT_COLUMNS: ExportColumn<TcExportRow>[] = [
  { header: 'TC #', value: (r) => r.tcNumber, width: 18 },
  { header: 'Student', value: (r) => r.studentName, width: 22 },
  { header: 'Admission #', value: (r) => r.admissionNumber, width: 16 },
  { header: 'Last Class', value: (r) => r.lastClass },
  { header: 'Reason', value: (r) => r.reason },
  { header: 'Conduct', value: (r) => r.conduct },
  { header: 'Fees Cleared', value: (r) => r.feesCleared },
  {
    header: 'Issue Date',
    value: (r) =>
      r.issueDate ? new Date(r.issueDate as any).toISOString().slice(0, 10) : '',
  },
];

@ApiTags('school/transfer-certificates')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/transfer-certificates')
export class TransferCertificatesController {
  constructor(
    private readonly svc: TransferCertificatesService,
    private readonly exporter: ExportService,
  ) {}

  @RequirePermissions('/transfer-certificates:list')
  @Get()
  list(@Tenant() t: TenantContext, @Query() q: TcListQueryDto) {
    return this.svc.list(t.schemaName, t.schoolId, q);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export transfer certificates as Excel or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Query() q: TcListQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.svc.exportRows(t.schemaName, t.schoolId, q);
    const fmt = q.format === 'pdf' ? 'pdf' : 'xlsx';
    await this.exporter.send(
      res,
      fmt,
      'transfer-certificates',
      'Transfer Certificates',
      TC_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get(':id')
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/transfer-certificates:create')
  @Post()
  @ApiOperation({
    summary: 'Issue a transfer certificate and transition the student out',
  })
  issue(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Body() dto: IssueTcDto,
  ) {
    return this.svc.issue(t.schemaName, t.schoolId, userId, dto);
  }

  @RequirePermissions('/transfer-certificates:create')
  @Post(':id/pdf')
  @ApiOperation({ summary: 'Re-queue background PDF generation for a TC' })
  regeneratePdf(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.regeneratePdf(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/transfer-certificates:delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a TC and restore the student to active' })
  revoke(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.revoke(t.schemaName, t.schoolId, id);
  }
}
