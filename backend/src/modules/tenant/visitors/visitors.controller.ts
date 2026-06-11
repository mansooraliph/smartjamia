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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { FRONT_OFFICE_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  ExportColumn,
  ExportService,
} from '../../../common/export/export.service';
import { VisitorsService } from './visitors.service';
import { VisitorImportService } from './visitor-import.service';
import {
  CreateVisitorDto,
  UpdateVisitorDto,
  VisitorListQueryDto,
} from './dto/visitor.dto';

interface UploadedExcel {
  buffer: Buffer;
}

type VisitorExportRow = Awaited<
  ReturnType<VisitorsService['exportRows']>
>[number];

const VISITOR_EXPORT_COLUMNS: ExportColumn<VisitorExportRow>[] = [
  { header: 'Name', value: (r) => r.name, width: 22 },
  { header: 'Relation', value: (r) => r.relation },
  { header: 'Student', value: (r) => r.student, width: 22 },
  { header: 'Admission #', value: (r) => r.admissionNumber, width: 16 },
  { header: 'Gender', value: (r) => r.gender },
  { header: 'Mobile', value: (r) => r.mobile, width: 16 },
  { header: 'Email', value: (r) => r.email, width: 24 },
  { header: 'Place', value: (r) => r.place },
  { header: 'Address', value: (r) => r.address, width: 28 },
  { header: 'ID Proof', value: (r) => r.idProof, width: 22 },
  { header: 'Blacklisted', value: (r) => r.blacklisted },
];

@ApiTags('school/visitors')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...FRONT_OFFICE_ROLES)
@Controller('school/visitors')
export class VisitorsController {
  constructor(
    private readonly svc: VisitorsService,
    private readonly exporter: ExportService,
    private readonly importer: VisitorImportService,
  ) {}

  @RequirePermissions('/visitors:list')
  @Get()
  list(@Tenant() t: TenantContext, @Query() q: VisitorListQueryDto) {
    return this.svc.list(t.schemaName, t.schoolId, q);
  }

  @Get('import/template')
  @ApiOperation({ summary: 'Download the visitor import template (.xlsx)' })
  async importTemplate(@Res() res: Response) {
    const buf = await this.importer.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="visitor-import-template.xlsx"',
    );
    res.end(buf);
  }

  @Post('import/preview')
  @ApiOperation({ summary: 'Validate an uploaded visitor import file' })
  @UseInterceptors(FileInterceptor('file'))
  importPreview(
    @Tenant() t: TenantContext,
    @UploadedFile() file: UploadedExcel,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importer.preview(t.schemaName, t.schoolId, file.buffer);
  }

  @Post('import/commit')
  @ApiOperation({ summary: 'Import valid visitor rows' })
  @UseInterceptors(FileInterceptor('file'))
  importCommit(@Tenant() t: TenantContext, @UploadedFile() file: UploadedExcel) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importer.commit(t.schemaName, t.schoolId, file.buffer);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export visitors as Excel or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Query() q: VisitorListQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.svc.exportRows(t.schemaName, t.schoolId, q);
    await this.exporter.send(
      res,
      q.format === 'pdf' ? 'pdf' : 'xlsx',
      'visitors',
      'Visitors',
      VISITOR_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get('lookup')
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  lookup(
    @Tenant() t: TenantContext,
    @Query('search') search?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.svc.lookup(t.schemaName, t.schoolId, { search, studentId });
  }

  @Get(':id')
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/visitors:create')
  @Post()
  @ApiOperation({ summary: 'Register a visitor' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateVisitorDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @RequirePermissions('/visitors:create')
  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVisitorDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @RequirePermissions('/visitors:delete')
  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
