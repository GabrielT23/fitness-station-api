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
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, pingInterval: 8000, pingTimeout: 20000 })
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Injected by the Nest WebSocket adapter after construction; never read before it is set.
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(PaymentsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

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
      client.data.userId = String(payload.id);
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
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() invoiceId: string) {
    if (!(await this.canWatchInvoice(client.data.userId, invoiceId))) {
      this.logger.warn(`[join_invoice] socket.id=${client.id} negado para invoice:${invoiceId}`);
      return;
    }
    client.join(`invoice:${invoiceId}`);
    const rooms = Array.from(client.rooms).join(', ');
    this.logger.log(`[join_invoice] socket.id=${client.id} entrou na sala invoice:${invoiceId} | salas: [${rooms}]`);
  }

  /** The invoice owner, or an admin of the owner's gym, may follow its payment. */
  async canWatchInvoice(userId: unknown, invoiceId: unknown): Promise<boolean> {
    if (typeof userId !== 'string' || typeof invoiceId !== 'string') return false;
    const [user, invoice] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { user: true } }),
    ]);
    if (!user || user.deletedAt || user.isFrozen || !invoice) return false;
    if (invoice.userId === user.id) return true;
    return user.role === 'admin' && invoice.user.companyId === user.companyId;
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
