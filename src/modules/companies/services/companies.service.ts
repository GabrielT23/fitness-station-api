// filepath: d:\documentos\projetos\pessoais\fitness-station\fitness-station-api\src\modules\companies\services\companies.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyDto, UpdateCompanyDto } from '../dtos/companyDTO';
import { ICompaniesRepository } from '../repositories/ICompanies-repository';
import { Company } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepository: ICompaniesRepository) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    return await this.companiesRepository.create(createCompanyDto);
  }

  /** Returns only the caller's own company, as a one-item array. */
  async findAll(companyId: string): Promise<Company[]> {
    const company = await this.companiesRepository.findById(companyId);
    return company ? [company] : [];
  }

  async findOne(id: string, companyId: string): Promise<Company> {
    this.assertOwnCompany(id, companyId);
    const company = await this.companiesRepository.findById(id);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async update(
    id: string,
    companyId: string,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<Company> {
    this.assertOwnCompany(id, companyId);
    const company = await this.companiesRepository.findById(id);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    // Only the name is writable: the body's `id` must never reach Prisma.
    return await this.companiesRepository.update(id, {
      name: updateCompanyDto.name,
    });
  }

  async remove(id: string, companyId: string): Promise<void> {
    this.assertOwnCompany(id, companyId);
    const company = await this.companiesRepository.findById(id);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    await this.companiesRepository.deleteById(id);
  }

  /** Other companies are reported as not found, not forbidden, so ids are not probed. */
  private assertOwnCompany(id: string, companyId: string): void {
    if (id !== companyId) throw new NotFoundException('Empresa não encontrada');
  }
}
