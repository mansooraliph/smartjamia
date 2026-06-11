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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES, ALL_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@ApiTags('school/courses')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/courses')
export class CoursesController {
  constructor(private readonly svc: CoursesService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiOperation({ summary: 'List courses/programs (college mode)' })
  list(
    @Tenant() t: TenantContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.svc.list(t.schemaName, t.schoolId, academicYearId);
  }

  @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CreateCourseDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCourseDto,
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
