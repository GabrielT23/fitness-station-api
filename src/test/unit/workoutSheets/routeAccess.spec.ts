import type { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkoutSheetsController } from '@modules/workoutSheets/controllers/workoutSheets.controller';
import { WorkoutsController } from '@modules/workouts/controllers/workouts.controller';
import { ExercisesController } from '@modules/exercises/controllers/exercises.controller';
import { AuthGuard } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';

/**
 * Route access regression: every handler must be behind AuthGuard and resolve to the
 * role listed here (handler-level role overrides the class-level one, as in Nest).
 */
describe('route access', () => {
  const reflector = new Reflector();

  function guardsOf(controller: Type<unknown>, handler?: object): unknown[] {
    return [
      ...(Reflect.getMetadata('__guards__', controller) ?? []),
      ...(handler ? (Reflect.getMetadata('__guards__', handler) ?? []) : []),
    ];
  }

  function expectRoutes(
    controller: Type<unknown>,
    expected: Record<string, 'admin' | 'client'>,
  ) {
    for (const [method, role] of Object.entries(expected)) {
      const handler = controller.prototype[method];
      expect({
        method,
        guarded: guardsOf(controller, handler).includes(AuthGuard),
      }).toEqual({ method, guarded: true });
      expect({
        method,
        role: reflector.getAllAndOverride(RoleUser, [handler, controller]),
      }).toEqual({ method, role });
    }
  }

  it('workoutSheets: every route is guarded and role-scoped', () => {
    expectRoutes(WorkoutSheetsController, {
      create: 'admin',
      update: 'admin',
      linkUserToWorkoutSheet: 'admin',
      unLinkUserToWorkoutSheet: 'admin',
      findAll: 'admin',
      findAllByUserId: 'client',
      setMyActiveSheet: 'client',
      setActiveForUser: 'admin',
      findOne: 'client',
      remove: 'admin',
    });
  });

  it('workouts: mutations stay admin-only, reads open to linked clients', () => {
    expectRoutes(WorkoutsController, {
      create: 'admin',
      findAll: 'client',
      findOne: 'client',
      update: 'admin',
      remove: 'admin',
    });
  });

  it('exercises: mutations stay admin-only, reads open to linked clients', () => {
    expectRoutes(ExercisesController, {
      create: 'admin',
      findAll: 'client',
      findOne: 'client',
      update: 'admin',
      remove: 'admin',
    });
  });
});
