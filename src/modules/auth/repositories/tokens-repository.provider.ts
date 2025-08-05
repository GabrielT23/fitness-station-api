import { Provider } from '@nestjs/common';
import { ITokenRepository } from './ITokens-repository';
import { TokenRepository } from './implementations/prisma-tokens-repository';

export const tokensRepositoryProvider: Provider<ITokenRepository> = {
  provide: ITokenRepository,
  useClass: TokenRepository,
};