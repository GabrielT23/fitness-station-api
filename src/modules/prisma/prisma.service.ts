import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The password hash is omitted from every User query by default so it can
 * never leak through an API response (directly or via `include: { user: true }`).
 * Code that really needs it (login, password change) must opt in with
 * `omit: { password: false }`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<{ omit: { user: { password: true } } }>
  implements OnModuleInit
{
  constructor() {
    super({ omit: { user: { password: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
