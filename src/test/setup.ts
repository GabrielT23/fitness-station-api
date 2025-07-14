import { ConfigModule } from '@nestjs/config';
import { configuration } from '@config/configuration';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/fitness_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.HASH_SECRET = 'test-hash-secret';
process.env.PORT = '3001';

// Configure test module
beforeAll(async () => {
  await ConfigModule.forRoot({
    load: [configuration],
    isGlobal: true,
  });
});

// Global test timeout
jest.setTimeout(30000);