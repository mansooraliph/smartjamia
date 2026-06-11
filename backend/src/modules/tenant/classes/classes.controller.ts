import {
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
  UseGuards,
} from '@nestjs/common';
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
import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';

type ClassExportRow = Awaited<ReturnType<ClassesService['exportRows']>>[number];

const CLASS_EXPORT_COLUMNS: ExportColumn<ClassExportRow>[] = [
  { header: 'Class', value: (r) => r.name, width: 22 },
  { header: 'Order', value: (r) => r.orderIndex },
  { header: 'Academic Year', value: (r) => r.academicYear, width: 16 },
  { header: 'Sections', value: (r) => r.sections },
];

@ApiTags('school/classes')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/classes')
export class ClassesController {
  constructor(
    private readonly svc: ClassesService,
    private readonly exporter: ExportService,
  ) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'withSections', required: false, type: Boolean })
  @ApiOperation({ summary: 'List classes (optionally with sections)' })
  list(
    @Tenant() t: TenantContext,
    @Query('academicYearId') academicYearId?: string,
    @Query('withSections') withSections?: string,
    @Query('courseId') courseId?: string,
  ) {
    return withSections === 'true'
      ? this.svc.listWithSections(
          t.schemaName,
          t.schoolId,
          academicYearId,
          courseId,
        )
      : this.svc.list(t.schemaName, t.schoolId, academicYearId, courseId);
  }

  @Get('export')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Export classes as Excel or PDF' })
  async export(
    @Tenant() t: TenantContext,
    @Res() res: Response,
    @Query('academicYearId') academicYearId?: string,
    @Query('format') format?: string,
  ) {
    const rows = await this.svc.exportRows(
      t.schemaName,
      t.schoolId,
      academicYearId,
    );
    await this.exporter.send(
      res,
      format === 'pdf' ? 'pdf' : 'xlsx',
      'classes',
      'Classes',
      CLASS_EXPORT_COLUMNS,
      rows,
    );
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a class' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateClassDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClassDto,
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

@ApiTags('school/sections')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/sections')
export class SectionsController {
  constructor(private readonly svc: ClassesService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiQuery({ name: 'classId', required: false })
  list(@Tenant() t: TenantContext, @Query('classId') classId?: string) {
    return this.svc.listSections(t.schemaName, t.schoolId, classId);
  }

  @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CreateSectionDto) {
    return this.svc.createSection(t.schemaName, t.schoolId, dto);
  }

  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.svc.updateSection(t.schemaName, t.schoolId, id, dto);
  }

  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.removeSection(t.schemaName, t.schoolId, id);
  }
}
