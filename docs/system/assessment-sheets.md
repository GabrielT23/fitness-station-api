# Assessment sheets (avaliações físicas)

A physical assessment records a client's date and body measurements. Admins record and edit them
for the students of their gym. A client reads their own.

## Where it is

| File | Role |
|---|---|
| `src/modules/assessmentSheets/controllers/assessmentSheets.controller.ts` | routes `/assessment-sheets/*` |
| `src/modules/assessmentSheets/services/assessmentSheets.service.ts` | read and write scopes, user checks |
| `src/modules/assessmentSheets/repositories/` | `IAssessmentSheetsRepository` and its Prisma implementation |
| `src/modules/assessmentSheets/dtos/assessmentSheetDto.ts` | create and update bodies |
| `src/test/unit/assessmentSheets/assessmentSheets.service.spec.ts` | unit tests |

## Data

Table `assessment_sheets` (model `AssessmentSheet`): `date`, `userId` (cascade on user delete),
27 optional numeric measurements, timestamps. Created by
`prisma/migrations/20261102140100_add_assessment_sheets`.

The measurement columns are named in Portuguese (`altura`, `peso`, `bracoD`, `coxaSupE`, ...).
This is legacy: they stay as they are until there is a migration plan. Their English meanings are
in `docs/glossary.md`.

## Routes

| Method and path | Who | What it does |
|---|---|---|
| `POST /assessment-sheets` | admin | Body `date` (ISO), `userId` (must be in the company), and any measurements as numbers. |
| `GET /assessment-sheets` | admin | Every sheet of the company. |
| `GET /assessment-sheets/client` | client (admins too) | The caller's own sheets. |
| `GET /assessment-sheets/user/:userId` | admin | The sheets of one user of the company. |
| `GET /assessment-sheets/:id` | client (admins too) | An admin reads any sheet of the company; a client reads only their own. 404 `AssessmentSheet not found`. |
| `PATCH /assessment-sheets/:id` | admin | Partial update, company scope. |
| `DELETE /assessment-sheets/:id` | admin | Deletes the sheet. Returns `{ message: 'AssessmentSheet deleted successfully' }`. |

## Rules

- Reads: an admin is limited to the company; a client to their own `userId`
  (`readScopeOf`).
- Writes: an admin is limited to the company (`writeScopeOf`). A sheet of another gym is reported as
  not found.
- The sheet has no `companyId` column. Its company is the company of its user, checked on create
  (`existsUserInCompany`, 404 `Usuário não encontrado`).
- A client asking for another user's list gets 403 `Acesso negado às avaliações de outro usuário`.

## Points of attention

- The measurement names are Portuguese (legacy). Do not rename them without a migration plan (see
  `docs/glossary.md`).
- Several sheets on the same date are allowed.
- `torax1` and `torax2` are not explained in the code; the glossary keeps them as "chest, measurement
  1 and 2".
- Create passes the validated body straight to Prisma; the company check happens before it.
- The "not found" message is in English here, while the rest of the API mostly uses pt-BR.
