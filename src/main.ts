import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { configuration } from '@config/configuration';
import { loadEnvFile } from '@config/env-file';
import { setupSwagger } from '@config/swagger';

loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Deadlines on every HTTP connection so a slow or stalled client cannot hold
  // a socket forever. headersTimeout must stay above keepAliveTimeout.
  const server = app.getHttpServer();
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;
  // Behind exactly one proxy (Cloud Run front end): use the client IP from
  // X-Forwarded-For so the login rate limit is per client, not per proxy.
  app.set('trust proxy', 1);
  const config = configuration();
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableCors({
    allowedHeaders: ['content-type', 'authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  setupSwagger(app);
  await app.listen(config.port || 3333);
}
bootstrap();
