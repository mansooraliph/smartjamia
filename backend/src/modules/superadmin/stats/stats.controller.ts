import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { StatsService } from './stats.service';

@ApiTags('superadmin/stats')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Platform overview counts' })
  overview() {
    return this.stats.overview();
  }
}
