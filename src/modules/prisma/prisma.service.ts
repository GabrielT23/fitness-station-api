import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Client-side timeouts appended to DATABASE_URL (Prisma query-string params). */
const CLIENT_TIMEOUT_PARAMS: Record<string, string> = {
  connect_timeout: '10',
  pool_timeout: '10',
  socket_timeout: '30',
};

/**
 * Appends connect/pool/socket timeouts to a database URL. A parameter already
 * present in the URL is left untouched; the URL is returned as-is when nothing
 * needs adding.
 */
export function withClientTimeouts(url: string): string {
  const queryStart = url.indexOf('?');
  const base = queryStart === -1 ? url : url.slice(0, queryStart);
  const query = queryStart === -1 ? '' : url.slice(queryStart + 1);
  const present = new Set(query.split('&').map((pair) => pair.split('=')[0]));

  const additions = Object.entries(CLIENT_TIMEOUT_PARAMS)
    .filter(([key]) => !present.has(key))
    .map(([key, value]) => `${key}=${value}`);
  if (additions.length === 0) return url;

  const joined = [query, ...additions].filter((part) => part.length > 0).join('&');
  return `${base}?${joined}`;
}

/**
 * The password hash is omitted from every User query by default so it can
 * never leak through an API response (directly or via `include: { user: true }`).
 * Code that really needs it (login, password change) must opt in with
 * `omit: { password: false }`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<{
    omit: { user: { password: true } };
    transactionOptions: { maxWait: number; timeout: number };
  }>
  implements OnModuleInit
{
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    super({
      ...(databaseUrl ? { datasourceUrl: withClientTimeouts(databaseUrl) } : {}),
      omit: { user: { password: true } },
      transactionOptions: { maxWait: 5000, timeout: 10000 },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
