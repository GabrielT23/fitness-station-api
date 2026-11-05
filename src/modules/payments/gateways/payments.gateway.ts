import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { configuration } from '@config/configuration';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class PaymentsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(PaymentsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string)?.replace('Bearer ', '');
      if (!token) { client.disconnect(); return; }
      this.jwtService.verify(token, { secret: configuration().jwtSecret });
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('join_invoice')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() invoiceId: string) {
    client.join(`invoice:${invoiceId}`);
    this.logger.debug(`Client joined room invoice:${invoiceId}`);
  }

  emitPaymentConfirmed(invoiceId: string) {
    this.server.to(`invoice:${invoiceId}`).emit('payment.confirmed', { invoiceId });
    this.logger.log(`Payment confirmed emitted for invoice ${invoiceId}`);
  }
}
