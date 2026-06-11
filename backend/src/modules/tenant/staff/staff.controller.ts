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
import { ADMIN_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  ExportColumn,
  ExportService,
} from '../../../common/export/export.service';
import { StaffService } from './staff.service';
import { StaffImportService } from './staff-import.service';
import {
  CreateStaffDto,
  StaffListQueryDto,
  UpdateStaffDto,
} from './dto/staff.dto';

interface UploadedExcel {
  buffer: Buffer;
}

type StaffExportRow = Awaited<ReturnType<StaffService['exportRows']>>[number];

const STAFF_EXPORT_COLUMNS: ExportColumn<StaffExportRow>[] = [
  { header: 'Employee ID', value: (r) => r.employeeId, width: 14 },
  { header: 'Name', value: (r) => r.name, width: 22 },
  { header: 'Email', value: (r) => r.email, width: 26 },
  { header: 'Role', value: (r) => r.role },
  { header: 'Designation', value: (r) => r.designation, width: 20 },
  { header: 'Department', value: (r) => r.department },
  { header: 'Qualification', value: (r) => r.qualification, width: 20 },
  {
    header: 'Joining Date',
    value: (r) =>
      r.joiningDate
        ? new Date(r.joiningDate as any).toISOString().slice(0, 10)
        : '',
  },
  { header: 'Salary (Rs/mo)', value: (r) => r.salary },
  { header: 'Status', value: (r) => r.status },
];

@ApiTags('school/staff')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/staff')
export class StaffController {
  constructor(
    private readonly svc: StaffService,
    private readonly exporter: ExportService,
    private readonly importer: StaffImportService,
  ) {}

  @RequirePermissions('/staff:list')
  @Get()
  @ApiOperation({ summary: 'List staff with linked user (paginated)' })
  list(@Tenant() t: TenantContext, @Query() q: StaffListQueryDto) {
    return this.svc.list(t.schemaName, t.schoolId, q);
  }

  @Get('import/template')
  @ApiOperation({ summary: 'Download the staff import template (.xlsx)' })
  async importTemplate(@Res() res: Response) {
    const buf = await this.importer.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="staff-import-template.xlsx"',
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
  @ApiOperation({ summary: 'Export staff as Excel (xlsx) or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Query() q: StaffListQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.svc.exportRows(t.schemaName, t.schoolId, q);
    const fmt = q.format === 'pdf' ? 'pdf' : 'xlsx';
    await this.exporter.send(
      res,
      fmt,
      'staff',
      'Staff',
      STAFF_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get(':id')
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/staff:create')
  @Post()
  @ApiOperation({ summary: 'Create staff (also creates the linked user)' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateStaffDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @RequirePermissions('/staff:create')
  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @RequirePermissions('/staff:delete')
  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
