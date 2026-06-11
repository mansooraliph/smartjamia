import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { TEACHING_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { ReportCardsService } from './report-cards.service';

@ApiTags('school/report-cards')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...TEACHING_ROLES)
@Controller('school')
export class ReportCardsController {
  constructor(private readonly svc: ReportCardsService) {}

  @RequirePermissions('/report-cards:create')
  @Post('exams/:examId/report-cards')
  @ApiOperation({ summary: 'Generate ranked report cards for an exam' })
  generate(
    @Tenant() t: TenantContext,
    @Param('examId', new ParseUUIDPipe()) examId: string,
  ) {
    return this.svc.generateForExam(t.schemaName, t.schoolId, examId);
  }

  @RequirePermissions('/report-cards:list')
  @Get('exams/:examId/report-cards')
  @ApiOperation({ summary: 'Ranked report-card list for an exam' })
  list(
    @Tenant() t: TenantContext,
    @Param('examId', new ParseUUIDPipe()) examId: string,
  ) {
    return this.svc.listForExam(t.schemaName, t.schoolId, examId);
  }

  @RequirePermissions('/report-cards:list')
  @Get('report-cards/:id')
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(t.schemaName, t.schoolId, id);
  }

  @RequirePermissions('/report-cards:create')
  @Post('report-cards/:id/pdf')
  @ApiOperation({ summary: 'Re-queue PDF generation for a report card' })
  regeneratePdf(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.regeneratePdf(t.schemaName, t.schoolId, id);
  }
}
