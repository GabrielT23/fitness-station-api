import { AuthGuard } from '@modules/auth/providers/auth.guard';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateInvoiceDto, GenerateMonthlyInvoicesDto, UpdateInvoiceStatusDto } from '../dtos/invoiceDto';
import { InvoicesService } from '../services/invoices.service';

type AuthenticatedRequest = { user: AuthUser };

@Controller('/invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @RoleUser('admin')
  async create(@Body() createInvoiceDto: CreateInvoiceDto, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.create(createInvoiceDto, req.user);
  }

  @Get()
  @RoleUser('admin')
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.findAll(req.user);
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.findByUser(userId, req.user);
  }

  @Get('user/:userId/payment-status')
  async getPaymentStatus(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.getPaymentStatus(userId, req.user);
  }

  @Get('billing-check')
  async billingCheck(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.getBillingCheck(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.findOne(id, req.user);
  }

  @Post('generate-monthly')
  @RoleUser('admin')
  async generateMonthly(@Body() dto: GenerateMonthlyInvoicesDto, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.generateMonthly(dto, req.user.companyId);
  }

  @Post('generate-for-user/:userId')
  @RoleUser('admin')
  async generateForUser(
    @Param('userId') userId: string,
    @Body() dto: GenerateMonthlyInvoicesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.generateForUser(userId, req.user, dto.month);
  }

  @Patch('mark-overdue')
  @RoleUser('admin')
  async markOverdue(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.markOverdue(req.user.companyId);
  }

  @Patch(':id/status')
  @RoleUser('admin')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.updateStatus(id, dto, req.user);
  }

  @Delete(':id')
  @RoleUser('admin')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.remove(id, req.user);
  }
}
