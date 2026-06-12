import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ADMIN_ROLES, ALL_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  ExportColumn,
  ExportService,
} from '../../../common/export/export.service';
import { ParentsService } from './parents.service';
import { ParentImportService } from './parent-import.service';
import { PortalService } from '../portal/portal.service';
import { SetPinDto } from '../portal/dto/set-pin.dto';
import {
  CreateParentDto,
  ParentListQueryDto,
  UpdateParentDto,
} from './dto/parent.dto';

interface UploadedExcel {
  buffer: Buffer;
}

type ParentExportRow = Awaited<
  ReturnType<ParentsService['exportRows']>
>[number];

const PARENT_EXPORT_COLUMNS: ExportColumn<ParentExportRow>[] = [
  { header: 'Admission #', value: (r) => r.admissionNumber, width: 16 },
  { header: 'Student', value: (r) => r.student, width: 22 },
  { header: 'Name', value: (r) => r.name, width: 22 },
  { header: 'Relation', value: (r) => r.relation },
  { header: 'Phone Country Code', value: (r) => r.phoneCountryCode },
  { header: 'Phone', value: (r) => r.phone, width: 16 },
  { header: 'WhatsApp Country Code', value: (r) => r.whatsappCountryCode },
  { header: 'WhatsApp', value: (r) => r.whatsapp, width: 16 },
  { header: 'Email', value: (r) => r.email, width: 24 },
  { header: 'Occupation', value: (r) => r.occupation },
  { header: 'Annual Income', value: (r) => String(r.annualIncome ?? '') },
  { header: 'Aadhaar', value: (r) => r.aadharNumber },
  { header: 'Primary', value: (r) => r.isPrimary },
];

@ApiTags('school/parents')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/parents')
export class ParentsController {
  constructor(
    private readonly svc: ParentsService,
    private readonly exporter: ExportService,
    private readonly importer: ParentImportService,
    private readonly portal: PortalService,
  ) {}

  @RequirePermissions('/parents:list')
  @Get()
  @Roles(...ALL_ROLES)
  list(@Tenant() t: TenantContext, @Query() q: ParentListQueryDto) {
    return this.svc.list(t.schemaName, t.schoolId, q);
  }

  @Get('import/template')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Download the parent import template (.xlsx)' })
  async importTemplate(@Res() res: Response) {
    const buf = await this.importer.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="parent-import-template.xlsx"',
    );
    res.end(buf);
  }

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  importPreview(@Tenant() t: TenantContext, @UploadedFile() file: UploadedExcel) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importer.preview(t.schemaName, t.schoolId, file.buffer);
  }

  @Post('import/commit')
  @UseInterceptors(FileInterceptor('file'))
  importCommit(@Tenant() t: TenantContext, @UploadedFile() file: UploadedExcel) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importer.commit(t.schemaName, t.schoolId, file.buffer);
  }

  @Get('export')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Export parents as Excel or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Query() q: ParentListQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.svc.exportRows(t.schemaName, t.schoolId, q);
    await this.exporter.send(
      res,
      q.format === 'pdf' ? 'pdf' : 'xlsx',
      'parents',
      'Parents & Guardians',
      PARENT_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/parents:create')
  @Post()
  @ApiOperation({ summary: 'Add a parent/guardian for a student' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateParentDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @RequirePermissions('/parents:create')
  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateParentDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @RequirePermissions('/parents:delete')
  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }

  @Post(':id/portal-pin')
  @ApiOperation({ summary: 'Enable/reset the parent portal PIN' })
  setPin(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPinDto,
  ) {
    return this.portal.setParentPin(t.schemaName, t.schoolId, id, dto.pin);
  }

  @Delete(':id/portal-pin')
  @ApiOperation({ summary: 'Revoke the parent portal access' })
  removePin(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portal.removeParentPortal(t.schemaName, t.schoolId, id);
  }
}
