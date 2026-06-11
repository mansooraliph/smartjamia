import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ADMIN_ROLES, TEACHING_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { TimetableService } from './timetable.service';
import { SaveTimetableDto, TimetableQueryDto } from './dto/timetable.dto';

@ApiTags('school/timetable')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...TEACHING_ROLES)
@Controller('school/timetable')
export class TimetableController {
  constructor(private readonly svc: TimetableService) {}

  @RequirePermissions('/timetable:list')
  @Get('my-schedule')
  @ApiOperation({ summary: 'Logged-in teacher’s weekly schedule' })
  mySchedule(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
  ) {
    return this.svc.mySchedule(t.schemaName, t.schoolId, userId);
  }

  @RequirePermissions('/timetable:list')
  @Get()
  @ApiOperation({ summary: 'Editor grid for a section + pick-lists' })
  grid(@Tenant() t: TenantContext, @Query() q: TimetableQueryDto) {
    return this.svc.editorGrid(
      t.schemaName,
      t.schoolId,
      q.sectionId,
      q.academicYearId,
    );
  }

  @RequirePermissions('/timetable:create')
  @Put()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Replace a section’s timetable for the year' })
  save(@Tenant() t: TenantContext, @Body() dto: SaveTimetableDto) {
    return this.svc.save(t.schemaName, t.schoolId, dto);
  }
}
