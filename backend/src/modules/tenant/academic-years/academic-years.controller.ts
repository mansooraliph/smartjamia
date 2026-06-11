import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES, ALL_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { AcademicYearsService } from './academic-years.service';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
} from './dto/academic-year.dto';

@ApiTags('school/academic-years')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/academic-years')
export class AcademicYearsController {
  constructor(private readonly svc: AcademicYearsService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List academic years' })
  list(@Tenant() t: TenantContext) {
    return this.svc.list(t.schemaName, t.schoolId);
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get an academic year' })
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an academic year' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateAcademicYearDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an academic year' })
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @Post(':id/set-current')
  @ApiOperation({ summary: 'Mark this year as the current one' })
  setCurrent(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.setCurrent(t.schemaName, t.schoolId, id);
  }

  @Post(':id/lock')
  @ApiOperation({ summary: 'Lock the year (freezes edits after promotion)' })
  lock(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.setLocked(t.schemaName, t.schoolId, id, true);
  }

  @Post(':id/unlock')
  @ApiOperation({ summary: 'Unlock the year' })
  unlock(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.setLocked(t.schemaName, t.schoolId, id, false);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an academic year (only when unlocked)' })
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
