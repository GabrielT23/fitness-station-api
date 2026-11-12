// filepath: d:\documentos\projetos\pessoais\fitness-station\fitness-station-api\src\modules\companies\repositories\ICompanies-repository.ts
import { Company } from '@prisma/client';
import { CreateCompanyDto, UpdateCompanyDto } from '../dtos/companyDTO';

export abstract class ICompaniesRepository {
  abstract create(company: CreateCompanyDto): Promise<Company>;
  abstract update(
    id: string,
    company: Partial<UpdateCompanyDto>,
  ): Promise<Company>;
  abstract findAll(): Promise<Company[]>;
  abstract findById(id: string): Promise<Company | null>;
  abstract deleteById(id: string): Promise<void>;
}
