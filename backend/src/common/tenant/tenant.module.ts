import { Global, Module } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantSchemaService } from './tenant-schema.service';
import { SchemaMigrationService } from './schema-migration.service';

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
  ],
  exports: [
    TenantResolverService,
    TenantSchemaService,
    SchemaMigrationService,
  ],
})
export class TenantModule {}
