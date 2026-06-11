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
import { ADMIN_ROLES, ALL_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  ExportColumn,
  ExportService,
} from '../../../common/export/export.service';
import { SubjectsService } from './subjects.service';
import { SubjectImportService } from './subject-import.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

interface UploadedExcel {
  buffer: Buffer;
}

type SubjectExportRow = Awaited<
  ReturnType<SubjectsService['exportRows']>
>[number];

const SUBJECT_EXPORT_COLUMNS: ExportColumn<SubjectExportRow>[] = [
  { header: 'Subject', value: (r) => r.name, width: 22 },
  { header: 'Code', value: (r) => r.code },
  { header: 'Class', value: (r) => r.class, width: 16 },
  { header: 'Max Marks', value: (r) => r.maxMarks },
  { header: 'Pass Marks', value: (r) => r.passMarks },
  { header: 'Optional', value: (r) => r.optional },
];

@ApiTags('school/subjects')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/subjects')
export class SubjectsController {
  constructor(
    private readonly svc: SubjectsService,
    private readonly exporter: ExportService,
    private readonly importer: SubjectImportService,
  ) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiQuery({ name: 'classId', required: false })
  list(@Tenant() t: TenantContext, @Query('classId') classId?: string) {
    return this.svc.list(t.schemaName, t.schoolId, classId);
  }

  @Get('import/template')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Download the subject import template (.xlsx)' })
  async importTemplate(@Res() res: Response) {
    const buf = await this.importer.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="subject-import-template.xlsx"',
    );
    res.end(buf);
  }

  @Post('import/preview')
  @ApiQuery({ name: 'academicYearId', required: false })
  @UseInterceptors(FileInterceptor('file'))
  importPreview(
    @Tenant() t: TenantContext,
    @UploadedFile() file: UploadedExcel,
    @Query('academicYearId') academicYearId?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importer.preview(
      t.schemaName,
      t.schoolId,
      file.buffer,
      academicYearId || undefined,
    );
  }

  @Post('import/commit')
  @ApiQuery({ name: 'academicYearId', required: false })
  @UseInterceptors(FileInterceptor('file'))
  importCommit(
    @Tenant() t: TenantContext,
    @UploadedFile() file: UploadedExcel,
    @Query('academicYearId') academicYearId?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importer.commit(
      t.schemaName,
      t.schoolId,
      file.buffer,
      academicYearId || undefined,
    );
  }

  @Get('export')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Export subjects as Excel or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Res() res: Response,
    @Query('classId') classId?: string,
    @Query('format') format?: string,
  ) {
    const rows = await this.svc.exportRows(t.schemaName, t.schoolId, classId);
    await this.exporter.send(
      res,
      format === 'pdf' ? 'pdf' : 'xlsx',
      'subjects',
      'Subjects',
      SUBJECT_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CreateSubjectDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
