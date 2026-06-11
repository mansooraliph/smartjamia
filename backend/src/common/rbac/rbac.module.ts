import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * Global so RolesGuard (used across every feature module) can inject
 * PermissionsService without each module re-providing it.
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class RbacModule {}
