-- CreateTable
CREATE TABLE "assessment_sheets" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "altura" DOUBLE PRECISION,
    "peso" DOUBLE PRECISION,
    "bracoD" DOUBLE PRECISION,
    "bracoE" DOUBLE PRECISION,
    "antebracoD" DOUBLE PRECISION,
    "antebracoE" DOUBLE PRECISION,
    "bicepsD" DOUBLE PRECISION,
    "bicepsE" DOUBLE PRECISION,
    "torax1" DOUBLE PRECISION,
    "torax2" DOUBLE PRECISION,
    "cintura" DOUBLE PRECISION,
    "abdomen" DOUBLE PRECISION,
    "quadril" DOUBLE PRECISION,
    "coxaSupD" DOUBLE PRECISION,
    "coxaSupE" DOUBLE PRECISION,
    "coxaMedD" DOUBLE PRECISION,
    "coxaMedE" DOUBLE PRECISION,
    "coxaInfD" DOUBLE PRECISION,
    "coxaInfE" DOUBLE PRECISION,
    "pantD" DOUBLE PRECISION,
    "pantE" DOUBLE PRECISION,
    "imc" DOUBLE PRECISION,
    "gorduraPercent" DOUBLE PRECISION,
    "musculoPercent" DOUBLE PRECISION,
    "visceralFat" DOUBLE PRECISION,
    "idadeCorporal" DOUBLE PRECISION,
    "metabolismoBasal" DOUBLE PRECISION,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_sheets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "assessment_sheets" ADD CONSTRAINT "assessment_sheets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
