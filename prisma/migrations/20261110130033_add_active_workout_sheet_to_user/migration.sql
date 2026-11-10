-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activeWorkoutSheetId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_activeWorkoutSheetId_fkey" FOREIGN KEY ("activeWorkoutSheetId") REFERENCES "workout_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
