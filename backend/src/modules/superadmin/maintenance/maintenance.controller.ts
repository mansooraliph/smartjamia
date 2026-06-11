import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { MaintenanceService } from './maintenance.service';

@ApiTags('superadmin/maintenance')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/maintenance')
export class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  @Post('run-expiry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run the subscription expiry sweep now' })
  runExpiry() {
    return this.svc.runExpiry();
  }
}
