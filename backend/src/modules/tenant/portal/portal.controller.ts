import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PinAuthGuard } from '../../../common/guards/pin-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PortalService } from './portal.service';

interface PinUser {
  sub: string;
  role: 'student' | 'parent';
  schoolId: string;
  schoolSlug: string;
  schemaName: string;
  refId: string;
}

@ApiTags('portal')
@ApiBearerAuth('bearer')
@UseGuards(PinAuthGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly svc: PortalService) {}

  @Get('me')
  @ApiOperation({ summary: 'Logged-in student/parent profile (PIN auth)' })
  me(@CurrentUser() u: PinUser) {
    return this.svc.me(u.schemaName, u.schoolId, u.role, u.refId);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance summary + recent records (PIN auth)' })
  attendance(@CurrentUser() u: PinUser) {
    return this.svc.attendance(u.schemaName, u.schoolId, u.role, u.refId);
  }

  @Get('results')
  @ApiOperation({ summary: 'Exam results with per-subject marks (PIN auth)' })
  results(@CurrentUser() u: PinUser) {
    return this.svc.results(u.schemaName, u.schoolId, u.role, u.refId);
  }

  @Get('timetable')
  @ApiOperation({ summary: 'Weekly class timetable for the student (PIN auth)' })
  timetable(@CurrentUser() u: PinUser) {
    return this.svc.timetable(u.schemaName, u.schoolId, u.role, u.refId);
  }
}
