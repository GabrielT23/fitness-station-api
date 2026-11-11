import * as dotenv from 'dotenv';

/**
 * Loads the local .env file. Skipped under jest (NODE_ENV=test) so the suite
 * never depends on a developer's machine: the test setup provides every value.
 */
export function loadEnvFile(): void {
  if (process.env.NODE_ENV === 'test') return;
  dotenv.config();
}
