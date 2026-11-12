import { Reflector } from '@nestjs/core';
import { RoleUser } from '@modules/auth/role.decorator';
import { PlansController } from '@modules/plans/controllers/plans.controller';

describe('PlansController access', () => {
  const reflector = new Reflector();

  it('requires the admin role at class level, so every plan route is admin-only', () => {
    expect(reflector.get(RoleUser, PlansController)).toBe('admin');
  });

  it('does not override the admin requirement on any handler', () => {
    const handlers = [
      'create',
      'findAll',
      'findOne',
      'update',
      'remove',
    ] as const;
    for (const name of handlers) {
      expect(
        reflector.get(RoleUser, PlansController.prototype[name]),
      ).toBeUndefined();
    }
  });
});
