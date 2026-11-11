import { JwtModuleOptions } from '@nestjs/jwt';
import { configuration } from '@config/configuration';

const config = configuration();

/** Lifetime of every access token issued by login and refresh. */
export const ACCESS_TOKEN_TTL = '15m';

export const jwtConfig: JwtModuleOptions = {
  secret: config.jwtSecret,
  signOptions: {
    expiresIn: ACCESS_TOKEN_TTL,
  },
};
