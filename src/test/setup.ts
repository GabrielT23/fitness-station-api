import { ConfigModule } from '@nestjs/config';
import { configuration } from '@config/configuration';

// Fake environment for every test. The machine's .env is never loaded under jest,
// and these assignments win over anything already set in the shell.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/fitness_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.HASH_SECRET = 'test-hash-secret';
process.env.PORT = '3001';
process.env.MP_ACCESS_TOKEN = 'TEST-fake-mp-access-token';
process.env.MP_WEBHOOK_SECRET = 'test-mp-webhook-secret';

// Configure test module
beforeAll(async () => {
  await ConfigModule.forRoot({
    load: [configuration],
    isGlobal: true,
  });
});

// Global test timeout
jest.setTimeout(30000);
