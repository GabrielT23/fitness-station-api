import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { loadEnvFile } from '../src/config/env-file';

/**
 * Values `configuration()` requires at import time. The document is built from
 * decorators and DTO metadata only, so placeholders are enough when the real
 * environment is not set. Nothing connects to the database.
 */
const PLACEHOLDER_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  HASH_SECRET: 'openapi',
  JWT_SECRET: 'openapi',
};

async function main(): Promise<void> {
  loadEnvFile();
  for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
    process.env[key] ??= value;
  }

  const { AppModule } = await import('../src/app.module');
  const { buildOpenApiDocument } = await import('../src/config/swagger');

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const document = buildOpenApiDocument(app);
  writeFileSync(
    join(__dirname, '..', 'openapi.json'),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  await app.close();
  console.log('openapi.json written');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
