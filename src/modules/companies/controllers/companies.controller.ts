// filepath: d:\documentos\projetos\pessoais\fitness-station\fitness-station-api\src\modules\companies\controllers\companies.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';
import { CompaniesService } from '../services/companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from '../dtos/companyDTO';

@Controller('companies')
@UseGuards(AuthGuard)
@RoleUser('admin')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    return await this.companiesService.create(createCompanyDto);
  }

  @Get()
  async findAll(@Req() req: { user: AuthUser }) {
    return await this.companiesService.findAll(req.user.companyId);
  }

  @Get(':id')
  async findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return await this.companiesService.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ) {
    return await this.companiesService.update(
      id,
      req.user.companyId,
      updateCompanyDto,
    );
  }

  @Delete(':id')
  async remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return await this.companiesService.remove(id, req.user.companyId);
  }
}
