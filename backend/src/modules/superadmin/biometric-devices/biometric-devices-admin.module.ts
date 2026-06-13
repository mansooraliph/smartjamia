import { Module } from '@nestjs/common';
import { BiometricDevicesAdminController } from './biometric-devices-admin.controller';
import { BiometricDevicesAdminService } from './biometric-devices-admin.service';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';

@Module({
  controllers: [BiometricDevicesAdminController],
  providers: [BiometricDevicesAdminService, SuperadminGuard],
})
export class BiometricDevicesAdminModule {}
