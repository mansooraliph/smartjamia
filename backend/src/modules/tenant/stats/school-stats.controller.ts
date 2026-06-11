import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { SchoolStatsService } from './school-stats.service';

@ApiTags('school/stats')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard)
@Controller('school/stats')
export class SchoolStatsController {
  constructor(private readonly svc: SchoolStatsService) {}

  @Get()
  @ApiOperation({ summary: 'School dashboard overview counts' })
  overview(@Tenant() t: TenantContext) {
    return this.svc.overview(t.schemaName, t.schoolId);
  }
}
