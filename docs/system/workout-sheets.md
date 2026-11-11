# Workout sheets, workouts and exercises

A workout sheet (ficha de treino) is a training plan for a client. It has workouts (treinos), and
each workout has exercises (exercícios). Admins build sheets for their gym and link them to clients.
A client reads the sheets linked to them and picks one as the active sheet. Three modules form this
domain: `workoutSheets` (sheets, links, active sheet), `workouts` and `exercises`.

## Where it is

| File | Role |
|---|---|
| `src/modules/workoutSheets/controllers/workoutSheets.controller.ts` | routes `/workoutSheets/*` |
| `src/modules/workoutSheets/services/workoutSheets.service.ts` | sheets, links, active sheet, nested creation |
| `src/modules/workoutSheets/workoutSheetScope.ts` | read and manage scopes, shared by workouts and exercises |
| `src/modules/workoutSheets/repositories/` | `IWorkoutSheetsRepository` and its Prisma implementation |
| `src/modules/workoutSheets/dtos/workoutSheetDto.ts` | sheet, link and active-sheet bodies, with nested `WorkoutDto` and `ExerciseDto` |
| `src/modules/workouts/` | routes `/workouts/*`: controller, service, repository, dtos |
| `src/modules/exercises/` | routes `/exercises/*`: controller, service, repository, dtos |
| `src/test/unit/workoutSheets/` | unit tests, including `routeAccess.spec.ts` |
| `src/test/unit/workouts/` and `src/test/unit/exercises/` | unit tests |

## Data

- Table `workout_sheets` (`WorkoutSheet`): `name`, `type` (`default` or `custom`), `isActive`
  (admin flag, default false), `companyId`.
- Table `workouts` (`Workout`): `name`, `workoutSheetId` (cascade delete with its sheet).
- Table `exercises` (`Exercise`): `name`, `reps`, `sets`, `muscleGroup` (`CHEST`, `BACK`, `LEGS`,
  `SHOULDERS`, `ARMS`, `CORE`), `restPeriod` (unit not stated in the code), `videoLink` (optional),
  `workoutId` (cascade delete with its workout).
- Table `workout_sheet_users` (`WorkoutSheetUsers`): link between a sheet and a user, with a
  composite key. Deleting either side removes the link.
- `users.activeWorkoutSheetId`: the client's active sheet. Set to null when that sheet is deleted.
  Migration: `prisma/migrations/20261110130033_add_active_workout_sheet_to_user`.

## Routes: sheets

| Method and path | Who | What it does |
|---|---|---|
| `POST /workoutSheets` | admin | Creates a sheet in the caller's company, optionally with `users` (linked), and `workouts` with their `exercises`. Body `companyId` is ignored. |
| `PUT /workoutSheets/:id` | admin | Changes `name`, `type`, `isActive`. |
| `POST /workoutSheets/link-sheet-user` | admin | Body `{ userId, workoutSheetId }`. Both must be in the company. Returns `{ message }`. |
| `POST /workoutSheets/unlink-sheet-user` | admin | Removes the link. Clears the client's active sheet if it was this one. |
| `GET /workoutSheets` | admin | Every sheet of the company. |
| `GET /workoutSheets/client` | client (admins too) | The sheets linked to the caller. Each item's `isActive` is true when it is the caller's active sheet. |
| `PATCH /workoutSheets/client/set-active` | client (admins too) | Body `{ workoutSheetId? }`. Sets the caller's active sheet; a missing or `null` value clears it. The sheet must be linked, else 404 `Ficha não vinculada a este usuário`. Returns `{ message: 'Ficha ativa atualizada' }`. |
| `PATCH /workoutSheets/set-active-for-user` | admin | Body `{ userId, workoutSheetId? }`. Same rule for a user of the company. |
| `GET /workoutSheets/:id` | client (admins too) | An admin reads any sheet of the company. A client reads only linked sheets. Otherwise 404 `WorkoutSheet not found`. |
| `DELETE /workoutSheets/:id` | admin | Deletes the sheet, its workouts, exercises and links. |

## Routes: workouts and exercises

| Method and path | Who | What it does |
|---|---|---|
| `POST /workouts` | admin | Body `name`, `workoutSheetId`. The sheet must be in the company. |
| `GET /workouts` | client (admins too) | Workouts of the sheets the caller can read. |
| `GET /workouts/:id` | client (admins too) | One workout, same scope. 404 `Workout not found`. |
| `PATCH /workouts/:id` | admin | Changes `name`, or moves it with `workoutSheetId` (same company only). |
| `DELETE /workouts/:id` | admin | Deletes the workout and its exercises. |
| `POST /exercises` | admin | Body `name`, `reps`, `sets`, `muscleGroup`, `restPeriod`, optional `videoLink`, `workoutId`. The workout must be in the company. |
| `GET /exercises` | client (admins too) | Exercises of the sheets the caller can read. |
| `GET /exercises/:id` | client (admins too) | One exercise, same scope. 404 `Exercise not found`. |
| `PATCH /exercises/:id` | admin | Partial update. |
| `DELETE /exercises/:id` | admin | Deletes the exercise. |

## How it works

- **Creating a sheet** takes the company from the admin. Every id in `users` must belong to the
  company, otherwise the whole request is refused (404 `User not found`). Then the sheet, the links,
  the workouts and the exercises are written one after another.
- **Read scope** (`readSheetScope`): an admin sees the company's sheets. A client sees only the
  company's sheets linked to them (`WorkoutSheetUsers`). Workouts and exercises inherit this through
  their sheet.
- **Manage scope** (`manageSheetScope`): the company only. Writes are admin routes anyway.
- **Moving a workout** to another sheet requires that sheet to be in the company.
- **Unlinking** a sheet clears the client's `activeWorkoutSheetId` if it pointed to that sheet.
- **Client's list** (`findAllByUserId`) sets `isActive` from `users.activeWorkoutSheetId`, not from
  the sheet's own `isActive` column.

## Points of attention

- `POST /workoutSheets` writes the sheet, links, workouts and exercises without a transaction. A
  failure part-way leaves a partial sheet.
- `type` is a free string in the DTO, but the database enum accepts only `default` and `custom`.
  `muscleGroup` has the same mismatch. An invalid value reaches the database and fails there (500)
  instead of 400.
- The sheet's `isActive` column is an admin flag. A client's choice is `users.activeWorkoutSheetId`.
- Sheet update uses `PUT`; workout and exercise updates use `PATCH`.
- In exercise updates, falsy numbers (`0`) are ignored (`if (dto.reps)`).
- Some messages are in English (`WorkoutSheet not found`, `Workout not found`, `Exercise not found`,
  `User not found`); the rest of the API uses pt-BR.
