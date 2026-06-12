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
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  ExportColumn,
  ExportService,
} from '../../../common/export/export.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ADMIN_ROLES } from '../../../common/constants/roles';
import { StudentsService } from './students.service';
import { StudentImportService } from './student-import.service';
import { PortalService } from '../portal/portal.service';
import { SetPinDto } from '../portal/dto/set-pin.dto';
import {
  CreateStudentDto,
  StudentListQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';

interface UploadedExcel {
  buffer: Buffer;
  originalname: string;
}

type StudentExportRow = Awaited<
  ReturnType<StudentsService['exportRows']>
>[number];

const STUDENT_EXPORT_COLUMNS: ExportColumn<StudentExportRow>[] = [
  { header: 'Admission #', value: (r) => r.admissionNumber, width: 16 },
  { header: 'First Name', value: (r) => r.firstName },
  { header: 'Last Name', value: (r) => r.lastName },
  { header: 'Gender', value: (r) => r.gender },
  { header: 'Date of Birth', value: (r) => fmtDate(r.dateOfBirth) },
  { header: 'Blood Group', value: (r) => r.bloodGroup },
  { header: 'Religion', value: (r) => r.religion },
  { header: 'Caste', value: (r) => r.caste },
  { header: 'Aadhaar', value: (r) => r.aadharNumber },
  { header: 'Mobile Country Code', value: (r) => r.mobileCountryCode },
  { header: 'Mobile', value: (r) => r.mobile },
  { header: 'WhatsApp Country Code', value: (r) => r.whatsappCountryCode },
  { header: 'WhatsApp', value: (r) => r.whatsapp },
  { header: 'Class', value: (r) => r.className },
  { header: 'Section', value: (r) => r.sectionName },
  { header: 'Roll', value: (r) => r.rollNumber },
  { header: 'Status', value: (r) => r.status },
  { header: 'Admission Date', value: (r) => fmtDate(r.admissionDate) },
  { header: 'Address', value: (r) => r.address },
  { header: 'City', value: (r) => r.city },
  { header: 'State', value: (r) => r.state },
  { header: 'Pincode', value: (r) => r.pincode },
  { header: 'Previous School', value: (r) => r.previousSchool },
];

function fmtDate(d: unknown): string {
  if (!d) return '';
  const s = typeof d === 'string' ? d : new Date(d as any).toISOString();
  return s.slice(0, 10);
}

@ApiTags('school/students')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school/students')
export class StudentsController {
  constructor(
    private readonly svc: StudentsService,
    private readonly exporter: ExportService,
    private readonly importer: StudentImportService,
    private readonly portal: PortalService,
  ) {}

  @Get()
  @RequirePermissions('/students:list')
  list(@Tenant() t: TenantContext, @Query() q: StudentListQueryDto) {
    return this.svc.list(t.schemaName, t.schoolId, q);
  }

  @Get('import/template')
  @ApiOperation({ summary: 'Download the student import template (.xlsx)' })
  async importTemplate(@Res() res: Response) {
    const buf = await this.importer.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="student-import-template.xlsx"',
    );
    res.end(buf);
  }

  @Post('import/preview')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Validate an uploaded import file (no writes)' })
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
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Import valid rows from an uploaded file' })
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
  @ApiOperation({ summary: 'Export students as Excel (xlsx) or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Query() q: StudentListQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.svc.exportRows(t.schemaName, t.schoolId, q);
    const fmt = q.format === 'pdf' ? 'pdf' : 'xlsx';
    await this.exporter.send(
      res,
      fmt,
      'students',
      'Students',
      STUDENT_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Lightweight student options for pickers' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  lookup(
    @Tenant() t: TenantContext,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.lookup(t.schemaName, t.schoolId, { search, status });
  }

  @Get('next-admission-number')
  @ApiOperation({
    summary: 'Suggest the next admission number for a new admission',
  })
  nextAdmissionNumber(@Tenant() t: TenantContext) {
    return this.svc.nextAdmissionNumber(t.schemaName, t.schoolId);
  }

  @Get(':id')
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @RequirePermissions('/students:create')
  @ApiOperation({
    summary: 'Create student (optionally enroll into class/section)',
  })
  create(@Tenant() t: TenantContext, @Body() dto: CreateStudentDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @RequirePermissions('/students:create')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @RequirePermissions('/students:delete')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }

  @Post(':id/portal-pin')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Enable/reset the student portal PIN' })
  setPin(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPinDto,
  ) {
    return this.portal.setStudentPin(t.schemaName, t.schoolId, id, dto.pin);
  }

  @Delete(':id/portal-pin')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Revoke the student portal access' })
  removePin(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portal.removeStudentPortal(t.schemaName, t.schoolId, id);
  }
}
