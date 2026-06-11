import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
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

  const config = app.get(ConfigService);
  const port = Number(config.get<number>('APP_PORT', 3002)) || 3002;
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5175');

  // Serve generated files (TC / receipt / report-card PDFs) at /uploads.
  const storage = app.get(StorageService);
  app.useStaticAssets(storage.baseDir, { prefix: '/uploads/' });

  app.setGlobalPrefix('api/v1');

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

  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5175'],
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
