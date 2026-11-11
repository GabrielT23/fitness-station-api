import { withClientTimeouts } from '@modules/prisma/prisma.service';

describe('withClientTimeouts', () => {
  const BASE = 'postgresql://user:pass@db.internal:5432/fitness';

  it('appends connect, pool and socket timeouts to a bare URL', () => {
    expect(withClientTimeouts(BASE)).toBe(
      `${BASE}?connect_timeout=10&pool_timeout=10&socket_timeout=30`,
    );
  });

  it('keeps existing query params and appends the missing ones after them', () => {
    expect(withClientTimeouts(`${BASE}?schema=public&sslmode=require`)).toBe(
      `${BASE}?schema=public&sslmode=require&connect_timeout=10&pool_timeout=10&socket_timeout=30`,
    );
  });

  it('never overrides a timeout the URL already sets', () => {
    expect(
      withClientTimeouts(`${BASE}?connect_timeout=3&socket_timeout=60`),
    ).toBe(`${BASE}?connect_timeout=3&socket_timeout=60&pool_timeout=10`);
  });

  it('returns the URL unchanged when all three timeouts are present', () => {
    const url = `${BASE}?connect_timeout=1&pool_timeout=2&socket_timeout=3`;
    expect(withClientTimeouts(url)).toBe(url);
  });

  it('does not treat a parameter whose name only contains a timeout name as present', () => {
    expect(withClientTimeouts(`${BASE}?x_connect_timeout=5`)).toBe(
      `${BASE}?x_connect_timeout=5&connect_timeout=10&pool_timeout=10&socket_timeout=30`,
    );
  });
});
