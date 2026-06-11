import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';

import { masterDataSourceOptions } from './database/master-datasource';
import { dataDataSourceOptions } from './database/data-datasource';

import { TenantModule } from './common/tenant/tenant.module';
import { RbacModule } from './common/rbac/rbac.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { StorageModule } from './common/storage/storage.module';
import { PdfModule } from './common/pdf/pdf.module';
import { ExportModule } from './common/export/export.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PublicModule } from './modules/public/public.module';
import { BillingModule } from './modules/tenant/billing/billing.module';
import { SuperadminModule } from './modules/superadmin/superadmin.module';
import { SchoolModule } from './modules/tenant/school.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    TypeOrmModule.forRootAsync({
      name: 'master',
      inject: [ConfigService],
      useFactory: () => masterDataSourceOptions,
    }),

    TypeOrmModule.forRootAsync({
      name: 'data',
      inject: [ConfigService],
      useFactory: () => dataDataSourceOptions,
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('THROTTLE_TTL', 60)) * 1000,
          limit: Number(config.get('THROTTLE_LIMIT', 100)),
        },
      ],
    }),

    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6381)),
          password: config.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),

    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),

    StorageModule,
    PdfModule,
    ExportModule,
    TenantModule,
    RbacModule,
    AuthModule,
    PublicModule,
    BillingModule,
    SuperadminModule,
    SchoolModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
