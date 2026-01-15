import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

  // Security middleware
  app.use(helmet());

  // CORS configuration
  const corsOrigin = configService.get<string[]>('app.cors.origin', [
    'http://localhost:3000',
  ]);
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  // Global API prefix (per CLAUDE.md: /api/v1/)
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API documentation (non-production only)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BodaInsure API')
      .setDescription(
        'Digital insurance platform API for Kenya bodaboda riders',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('kyc', 'KYC and document management')
      .addTag('payments', 'Payment processing')
      .addTag('policies', 'Policy management')
      .addTag('organizations', 'Organization management')
      .addTag('notifications', 'Notification management')
      .addTag('reports', 'Reporting and analytics')
      .addTag('Accounting - GL', 'Chart of Accounts and General Ledger')
      .addTag('Accounting - Settlements', 'Partner settlement management')
      .addTag('Accounting - Reconciliation', 'Bank reconciliation')
      .addTag('Accounting - Reports', 'Financial reports')
      .addTag('Accounting - Export', 'Data export to CSV/Excel')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
    logger.log(`Swagger documentation available at /docs`);
  }

  await app.listen(port);
  logger.log(`BodaInsure API running on port ${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`API prefix: /${apiPrefix}`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', err);
  process.exit(1);
});
