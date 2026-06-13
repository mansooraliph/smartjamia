import { Module } from '@nestjs/common';
import { BiometricDevicesController } from './biometric-devices.controller';
import { BiometricDevicesService } from './biometric-devices.service';
import { BiometricPremiumGuard } from './biometric-premium.guard';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';

@Module({
  controllers: [BiometricDevicesController],
  providers: [BiometricDevicesService, BiometricPremiumGuard, TenantJwtGuard],
})
export class BiometricDevicesTenantModule {}
