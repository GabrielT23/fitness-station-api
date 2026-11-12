// filepath: d:\documentos\projetos\pessoais\fitness-station\fitness-station-api\src\modules\companies\repositories\implementations\prisma-companies-repository.ts
import { Injectable } from '@nestjs/common';
import { ICompaniesRepository } from '../ICompanies-repository';

import { Company } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
} from '@modules/companies/dtos/companyDTO';

@Injectable()
export class CompaniesRepository implements ICompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(company: CreateCompanyDto): Promise<Company> {
    const newCompany = await this.prisma.company.create({ data: company });
    return newCompany;
  }

  async update(
    id: string,
    company: Partial<UpdateCompanyDto>,
  ): Promise<Company> {
    const companyUpdate = await this.prisma.company.update({
      where: { id },
      data: company,
    });
    return companyUpdate;
  }

  async findAll(): Promise<Company[]> {
    const companies = this.prisma.company.findMany();
    return companies;
  }

  async findById(id: string): Promise<Company | null> {
    const company = await this.prisma.company.findUnique({ where: { id } });
    return company;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.company.delete({
      where: { id },
    });
  }
}
