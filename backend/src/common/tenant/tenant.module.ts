import { Global, Module } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantSchemaService } from './tenant-schema.service';
import { SchemaMigrationService } from './schema-migration.service';
import { TenantUserService } from './tenant-user.service';

/**
 * Global tenant module so services like SuperadminModule can inject
 * TenantSchemaService / TenantResolverService without importing this
 * module everywhere.
 */
@Global()
@Module({
  providers: [
    TenantResolverService,
    TenantSchemaService,
    SchemaMigrationService,
    TenantUserService,
  ],
  exports: [
    TenantResolverService,
    TenantSchemaService,
    SchemaMigrationService,
    TenantUserService,
  ],
})
export class TenantModule {}
