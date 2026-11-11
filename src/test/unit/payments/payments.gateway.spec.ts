import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { configuration } from '@config/configuration';
import { PaymentsGateway } from '@modules/payments/gateways/payments.gateway';

const secret = configuration().jwtSecret;

interface FakeSocket {
  id: string;
  handshake: { auth: { token?: string } };
  disconnect: jest.Mock;
  join: jest.Mock;
  rooms: Set<string>;
}

function fakeSocket(token?: string): FakeSocket {
  return {
    id: 'socket-1',
    handshake: { auth: token === undefined ? {} : { token } },
    disconnect: jest.fn(),
    join: jest.fn(),
    rooms: new Set(['socket-1']),
  };
}

describe('PaymentsGateway', () => {
  let gateway: PaymentsGateway;
  let jwt: JwtService;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jwt = new JwtService({ secret });
    gateway = new PaymentsGateway(jwt);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleConnection', () => {
    it('disconnects a socket that sends no token', () => {
      const socket = fakeSocket();
      gateway.handleConnection(socket as unknown as Socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects a socket with an invalid token', () => {
      const socket = fakeSocket('not-a-jwt');
      gateway.handleConnection(socket as unknown as Socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects a socket whose token was signed with another secret', () => {
      const forged = new JwtService({ secret: 'other' }).sign({ id: 'u1' });
      const socket = fakeSocket(forged);
      gateway.handleConnection(socket as unknown as Socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('keeps a socket with a valid token connected, accepting a Bearer prefix', () => {
      const token = jwt.sign({ id: 'u1', role: 'client' }, { secret });
      const socket = fakeSocket(`Bearer ${token}`);
      gateway.handleConnection(socket as unknown as Socket);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoin', () => {
    it('joins the invoice room', () => {
      const socket = fakeSocket();
      gateway.handleJoin(socket as unknown as Socket, 'inv-1');
      expect(socket.join).toHaveBeenCalledWith('invoice:inv-1');
    });
  });

  describe('handleDisconnect', () => {
    it('logs the disconnect without side effects', () => {
      const socket = fakeSocket();
      expect(() => gateway.handleDisconnect(socket as unknown as Socket)).not.toThrow();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('emitPaymentConfirmed', () => {
    it('emits payment.confirmed to the invoice room', () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = {
        sockets: { adapter: { rooms: new Map([['invoice:inv-1', new Set(['a', 'b'])]]) } },
        to,
      } as unknown as Server;

      gateway.emitPaymentConfirmed('inv-1');

      expect(to).toHaveBeenCalledWith('invoice:inv-1');
      expect(emit).toHaveBeenCalledWith('payment.confirmed', { invoiceId: 'inv-1' });
    });

    it('still emits when nobody is in the room', () => {
      const emit = jest.fn();
      gateway.server = {
        sockets: { adapter: { rooms: new Map() } },
        to: jest.fn().mockReturnValue({ emit }),
      } as unknown as Server;

      gateway.emitPaymentConfirmed('inv-2');

      expect(emit).toHaveBeenCalledWith('payment.confirmed', { invoiceId: 'inv-2' });
    });
  });
});
