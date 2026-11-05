import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@modules/auth/providers/auth.guard';
import { PaymentsService } from '../services/payments.service';
import { CreatePixDto } from '../dtos/payments.dto';

@Controller('/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('pix/:invoiceId')
  @UseGuards(AuthGuard)
  async createPix(
    @Req() req: any,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreatePixDto,
  ) {
    return this.paymentsService.createPixPayment(invoiceId, req.user.id, dto);
  }

  // Sem guard — validado pelo x-signature do Mercado Pago
  @Post('webhook')
  async handleWebhook(@Req() req: any) {
    return this.paymentsService.handleWebhook(req.body, req.headers);
  }
}
