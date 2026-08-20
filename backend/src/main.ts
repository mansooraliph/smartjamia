import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { raw } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { StorageService } from './common/storage/storage.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
    rawBody: true, // needed for Razorpay webhook signature verification
  });

  // Biometric devices POST arbitrary content-types (often text/plain or
  // octet-stream) that the default body parsers skip — capture the raw buffer
  // for all /iclock routes so the push-protocol handlers can read it.
  app.use('/iclock', raw({ type: () => true, limit: '10mb' }));

  const config = app.get(ConfigService);
  const port = Number(config.get<number>('APP_PORT', 3002)) || 3002;
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5175');

  // Serve generated files (TC / receipt / report-card PDFs) at /uploads.
  const storage = app.get(StorageService);
  app.useStaticAssets(storage.baseDir, { prefix: '/uploads/' });

  // Biometric device push-protocol routes live at the server root (devices call
  // /iclock/... directly), so exclude them from the /api/v1 prefix.
  app.setGlobalPrefix('api/v1', { exclude: ['iclock/(.*)'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Any localhost/127.0.0.1 origin is allowed in dev so the Vite frontend
  // (5175) and Expo web (port varies — 8081, 19006, ...) both work without
  // hardcoding each dev server's port. Production is locked to FRONTEND_URL.
  const isProd = config.get<string>('NODE_ENV') === 'production';
  app.enableCors({
    origin: isProd
      ? [frontendUrl]
      : (origin, callback) => {
          if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
            return callback(null, true);
          }
          callback(new Error(`Not allowed by CORS: ${origin}`), false);
        },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-School-Slug',
      'X-Requested-With',
    ],
  });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EduPro API')
    .setDescription('EduPro Academic Management SaaS — REST API v1')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addApiKey({ type: 'apiKey', name: 'X-School-Slug', in: 'header' }, 'tenant')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  logger.log(`🚀 EduPro API running on http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
