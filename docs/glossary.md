# Glossary

Product terms are in Brazilian Portuguese, the product's language. Code names are in English.
Use the code name in code and the product term in the interface and in product text.

Naming conventions: TypeScript `camelCase` for variables and fields, `PascalCase` for classes and
Prisma models. Database tables are plural `snake_case` (`@@map`). Routes keep the names the web client
already uses (`/workoutSheets`, `/assessment-sheets`); they are not renamed without agreement.

Product text (error messages the app returns) stays in pt-BR and is not translated here.

## Gym, people and access

| Product term (pt-BR) | Meaning | Code name |
|---|---|---|
| academia | the gym: the tenant every record belongs to | `Company`, table `companies`, `src/modules/companies/` |
| empresa | the same as academia, as the API words it (`Empresa não encontrada`) | `Company` |
| aluno, cliente | a person who trains at the gym | `User` with `Role.client` |
| administrador, admin | gym staff with full control of their gym | `User` with `Role.admin` |
| usuário | any person with a login | `User`, table `users` |
| congelar, descongelar | suspend or restore an account (no login, no invoices) | `isFrozen`; routes `freeze`, `unfreeze` |
| excluir (conta) | delete, keeping the history | soft delete, `deletedAt` |
| último pagamento | last payment recorded by an admin | `lastPayment`, route `set-payment` |
| vincular, desvincular (ficha ao aluno) | link or unlink a sheet to a client | `WorkoutSheetUsers`, routes `link-sheet-user`, `unlink-sheet-user` |
| ficha ativa | the sheet a client is following now | `activeWorkoutSheetId` |

## Plans and billing

| Product term (pt-BR) | Meaning | Code name |
|---|---|---|
| plano, mensalidade | the recurring monthly fee a client pays | `Plan`, table `plans`, `value` |
| plano exclusivo | a plan that generates no invoices | `isExclusive` |
| tolerância (dias) | days after the due date before an invoice is overdue | `toleranceDays` |
| fatura | the charge for one month of one client | `Invoice`, table `invoices` |
| mês de referência | month the invoice refers to, `YYYY-MM` | `referenceMonth` |
| vencimento | due date | `dueDate` |
| em aberto, não paga | unpaid | `UNPAID` |
| atrasada, vencida | overdue | `OVERDUE` |
| paga | paid | `PAID` |
| cancelada | cancelled | `CANCELLED` |
| credor (situação) | no debt | `CREDITOR` (payment-status) |
| devedor (situação) | has unpaid or overdue invoices | `DEBTOR` (payment-status) |
| aviso de fatura em aberto | the client has an unpaid invoice | `UNPAID_WARNING` (billing-check) |
| bloqueado por atraso | the client has an overdue invoice | `BLOCKED` (billing-check) |
| PIX | instant payment method; here through Mercado Pago | `payments` domain, `mpPaymentId` |
| gerar fatura do mês | create the month's invoices | `generate-monthly`, `generate-for-user` |
| marcar atrasadas | mark overdue invoices | `mark-overdue` |

## Training

| Product term (pt-BR) | Meaning | Code name |
|---|---|---|
| ficha de treino | a training plan for a client | `WorkoutSheet`, table `workout_sheets` |
| tipo da ficha | `default` (padrão) or `custom` (personalizada) | `WorkoutType`, `type` |
| treino | a workout inside a sheet | `Workout`, table `workouts` |
| exercício | an exercise inside a workout | `Exercise`, table `exercises` |
| grupo muscular | muscle group: CHEST (peito), BACK (costas), LEGS (pernas), SHOULDERS (ombros), ARMS (braços), CORE (core, abdômen) | `MuscleGroup` |
| repetições | reps | `reps` |
| séries | sets | `sets` |
| descanso | rest period | `restPeriod` (unit not stated in the code) |
| vídeo | video link of the exercise | `videoLink` |

## Physical assessment

Avaliação física is `AssessmentSheet`, table `assessment_sheets`. Its measurement columns keep
Portuguese names. They are legacy: do not rename them without a migration plan (a Prisma migration
that renames the columns and keeps the data, plus the API and the web client changed together).

| Column | Portuguese | English |
|---|---|---|
| `date` | data | date of the assessment |
| `altura` | altura | height |
| `peso` | peso | weight |
| `bracoD`, `bracoE` | braço direito, braço esquerdo | arm, right and left |
| `antebracoD`, `antebracoE` | antebraço direito, esquerdo | forearm, right and left |
| `bicepsD`, `bicepsE` | bíceps direito, esquerdo | biceps, right and left |
| `torax1`, `torax2` | tórax | chest, measurement 1 and 2 (the code does not say which points) |
| `cintura` | cintura | waist |
| `abdomen` | abdômen | abdomen |
| `quadril` | quadril | hip |
| `coxaSupD`, `coxaSupE` | coxa superior, direita e esquerda | upper thigh, right and left |
| `coxaMedD`, `coxaMedE` | coxa média, direita e esquerda | middle thigh, right and left |
| `coxaInfD`, `coxaInfE` | coxa inferior, direita e esquerda | lower thigh, right and left |
| `pantD`, `pantE` | panturrilha (abreviada), direita e esquerda | calf, right and left |
| `imc` | índice de massa corporal | BMI |
| `gorduraPercent` | gordura corporal, percentual | body fat, percent |
| `musculoPercent` | massa muscular, percentual | muscle mass, percent |
| `visceralFat` | gordura visceral | visceral fat |
| `idadeCorporal` | idade corporal | body age |
| `metabolismoBasal` | metabolismo basal | basal metabolic rate |

The English column above is the meaning only; the database and the API use the Portuguese column names.
