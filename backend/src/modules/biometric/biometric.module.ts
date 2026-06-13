import { Module } from '@nestjs/common';
import { IclockController } from './iclock.controller';
import { IclockService } from './iclock.service';

/**
 * Device push-protocol (ZKTeco/ESSL). Master + tenant repositories are obtained
 * via the named DataSources ('master' / 'data') + TenantSchemaService, so no
 * forFeature registration is needed here.
 */
@Module({
  controllers: [IclockController],
  providers: [IclockService],
  exports: [IclockService],
})
export class BiometricModule {}
