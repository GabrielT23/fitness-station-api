import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

const swaggerConfig = new DocumentBuilder()
  .setTitle('Fitness Station API')
  .addBearerAuth()
  .build();

/** Builds the OpenAPI document. Needs no listening server and no database. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, swaggerConfig);
}

/** Serves the Swagger UI at /docs and the raw JSON at /docs-json. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app));
}
