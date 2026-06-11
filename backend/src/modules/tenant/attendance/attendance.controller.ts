import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { AttendanceService } from './attendance.service';
import { BulkMarkAttendanceDto } from './dto/attendance.dto';

@ApiTags('school/attendance')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school/attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @RequirePermissions('/attendance:list')
  @Get('section/:sectionId')
  @ApiQuery({ name: 'date', required: true, example: '2026-06-08' })
  @ApiOperation({
    summary: 'Get section attendance for a date (with all enrolled students)',
  })
  getSection(
    @Tenant() t: TenantContext,
    @Param('sectionId', new ParseUUIDPipe()) sectionId: string,
    @Query('date') date: string,
  ) {
    return this.svc.getForSection(t.schemaName, t.schoolId, sectionId, date);
  }

  @RequirePermissions('/attendance:create')
  @Post('bulk')
  @ApiOperation({ summary: 'Bulk mark attendance for a section + date' })
  bulk(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Body() dto: BulkMarkAttendanceDto,
  ) {
    return this.svc.bulkMark(t.schemaName, t.schoolId, userId, dto);
  }

  @RequirePermissions('/attendance:list')
  @Get('student/:studentId/summary')
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiOperation({ summary: 'Per-student attendance counts (P/A/L/HD)' })
  studentSummary(
    @Tenant() t: TenantContext,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.svc.studentSummary(
      t.schemaName,
      t.schoolId,
      studentId,
      academicYearId,
    );
  }
}
