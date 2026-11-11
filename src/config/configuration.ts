// filepath: d:\documentos\projetos\pessoais\fitness-station\fitness-station-api\src\config\configuration.ts
import { z as zod } from 'zod';
import { loadEnvFile } from './env-file';
loadEnvFile();

export interface Config {
  port: number;
  databaseUrl: string;
  hashSecret: string;
  jwtSecret: string;
}


export const configuration = (): Config => {
  const envSchema = zod.object({
    PORT: zod.string().min(1).regex(/^\d+$/).default('3000').transform(Number),
    DATABASE_URL: zod.string().min(1).url(),
    HASH_SECRET: zod.string().min(1),
    JWT_SECRET: zod.string().min(1),
  });

  // console.log('Variáveis de ambiente:', process.env);
  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    console.error('Variáveis de ambiente inválidas', parsedEnv.error.format());
    process.exit(1);
  }

  return {
    port: parsedEnv.data?.PORT,
    databaseUrl: parsedEnv.data?.DATABASE_URL,
    hashSecret: parsedEnv.data?.HASH_SECRET,
    jwtSecret: parsedEnv.data?.JWT_SECRET,
  };
};

