import type { Prisma } from '@prisma/client';
import type { AuthUser } from '@modules/auth/providers/auth.guard';

/**
 * Sheets an actor may change or delete: always limited to the actor's company.
 * Mutations are admin-only at the controller, so this is the only scope needed for writes.
 */
export function manageSheetScope(actor: AuthUser): Prisma.WorkoutSheetWhereInput {
  return { companyId: actor.companyId };
}

/**
 * Sheets an actor may read. Admins see every sheet of their company;
 * clients see only the sheets linked to them (and still within their company).
 */
export function readSheetScope(actor: AuthUser): Prisma.WorkoutSheetWhereInput {
  if (actor.role === 'admin') return { companyId: actor.companyId };
  return {
    companyId: actor.companyId,
    WorkoutSheetUsers: { some: { userId: actor.id } },
  };
}
