import { AuthGuard } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateInvoiceDto, GenerateMonthlyInvoicesDto, UpdateInvoiceStatusDto } from '../dtos/invoiceDto';
import { InvoicesService } from '../services/invoices.service';

@Controller('/invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @RoleUser('admin')
  async create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Get()
  @RoleUser('admin')
  async findAll() {
    return this.invoicesService.findAll();
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.invoicesService.findByUser(userId);
  }

  @Get('user/:userId/payment-status')
  async getPaymentStatus(@Param('userId') userId: string) {
    return this.invoicesService.getPaymentStatus(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post('generate-monthly')
  @RoleUser('admin')
  async generateMonthly(@Body() dto: GenerateMonthlyInvoicesDto) {
    return this.invoicesService.generateMonthly(dto);
  }

  @Post('generate-for-user/:userId')
  @RoleUser('admin')
  async generateForUser(@Param('userId') userId: string, @Body() dto: GenerateMonthlyInvoicesDto) {
    return this.invoicesService.generateForUser(userId, dto.month);
  }

  @Patch('mark-overdue')
  @RoleUser('admin')
  async markOverdue() {
    return this.invoicesService.markOverdue();
  }

  @Patch(':id/status')
  @RoleUser('admin')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateInvoiceStatusDto) {
    return this.invoicesService.updateStatus(id, dto);
  }

  @Delete(':id')
  @RoleUser('admin')
  async remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
