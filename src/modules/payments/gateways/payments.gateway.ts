import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { configuration } from '@config/configuration';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, pingInterval: 8000, pingTimeout: 20000 })
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Injected by the Nest WebSocket adapter after construction; never read before it is set.
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(PaymentsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string)?.replace('Bearer ', '');
    this.logger.log(`[connect] socket.id=${client.id} | token=${token ? 'presente' : 'ausente'}`);

    if (!token) {
      this.logger.warn(`[connect] socket.id=${client.id} rejeitado — sem token`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token, { secret: configuration().jwtSecret });
      this.logger.log(`[connect] socket.id=${client.id} autenticado como userId=${payload.id}`);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[connect] socket.id=${client.id} rejeitado — token inválido: ${reason}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[disconnect] socket.id=${client.id}`);
  }

  @SubscribeMessage('join_invoice')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() invoiceId: string) {
    client.join(`invoice:${invoiceId}`);
    const rooms = Array.from(client.rooms).join(', ');
    this.logger.log(`[join_invoice] socket.id=${client.id} entrou na sala invoice:${invoiceId} | salas: [${rooms}]`);
  }

  emitPaymentConfirmed(invoiceId: string) {
    const room = `invoice:${invoiceId}`;
    const sockets = this.server.sockets.adapter.rooms.get(room);
    const count = sockets?.size ?? 0;
    this.logger.log(`[emit payment.confirmed] sala=${room} | clientes na sala: ${count}`);
    this.server.to(room).emit('payment.confirmed', { invoiceId });
    this.logger.log(`[emit payment.confirmed] evento enviado para ${count} cliente(s)`);
  }
}
