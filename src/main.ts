import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { configuration } from '@config/configuration';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
  await app.listen(config.port || 3333);
}
bootstrap();
