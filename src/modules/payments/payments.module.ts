import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { AuthModule } from '@modules/auth';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';
import { PaymentsGateway } from './gateways/payments.gateway';
import { PixProvider } from './gateways/pix-provider';
import { MercadoPagoPixProvider } from './gateways/mercadopago-pix.provider';
import { FakePixProvider } from './gateways/fake-pix.provider';

/** Tests run against the deterministic fake; every other environment calls Mercado Pago. */
const pixProviderClass =
  process.env.NODE_ENV === 'test' ? FakePixProvider : MercadoPagoPixProvider;

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsGateway,
    PrismaService,
    { provide: PixProvider, useClass: pixProviderClass },
  ],
})
export class PaymentsModule {}
