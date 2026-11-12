// filepath: d:\documentos\projetos\pessoais\fitness-station\fitness-station-api\src\modules\companies\repositories\companies-repository.provider.ts
import { Provider } from '@nestjs/common';
import { CompaniesRepository } from './implementations/prisma-companies-repository';
import { ICompaniesRepository } from './ICompanies-repository';

export const companiesRepositoryProvider: Provider<ICompaniesRepository> = {
  provide: ICompaniesRepository,
  useClass: CompaniesRepository,
};
