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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { TEACHING_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { ExamsService } from './exams.service';
import {
  CreateExamDto,
  ExamListQueryDto,
  SaveMarksDto,
  UpdateExamDto,
} from './dto/exam.dto';

@ApiTags('school/exams')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...TEACHING_ROLES)
@Controller('school/exams')
export class ExamsController {
  constructor(private readonly svc: ExamsService) {}

  @RequirePermissions('/exams:list')
  @Get()
  list(@Tenant() t: TenantContext, @Query() q: ExamListQueryDto) {
    return this.svc.list(t.schemaName, t.schoolId, q);
  }

  @RequirePermissions('/exams:list')
  @Get(':id')
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/exams:list')
  @Get(':id/marks-grid')
  @ApiOperation({ summary: 'Students × subjects grid + existing marks' })
  marksGrid(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.marksGrid(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/exams:create')
  @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CreateExamDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @RequirePermissions('/exams:create')
  @Post(':id/marks')
  @ApiOperation({ summary: 'Bulk enter/update marks for an exam' })
  saveMarks(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveMarksDto,
  ) {
    return this.svc.saveMarks(t.schemaName, t.schoolId, id, userId, dto);
  }

  @RequirePermissions('/exams:create')
  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @RequirePermissions('/exams:delete')
  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
