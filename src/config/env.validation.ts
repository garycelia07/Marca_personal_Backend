import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, MinLength, validateSync } from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv, { message: 'NODE_ENV debe ser development, production o test' })
  NODE_ENV?: NodeEnv;

  @IsOptional()
  @IsNumberString({}, { message: 'PORT debe ser numérico' })
  PORT?: string;

  @IsNotEmpty({
    message: 'DATABASE_URL es obligatorio (connection string pooled de Supabase Postgres, ver .env.example)',
  })
  DATABASE_URL!: string;

  @IsNotEmpty({
    message: 'DIRECT_URL es obligatorio (connection string directa de Supabase Postgres, usada para migraciones)',
  })
  DIRECT_URL!: string;

  @IsNotEmpty({
    message:
      'JWT_SECRET es obligatorio: sin este valor la API no puede firmar/verificar tokens de forma segura. ' +
      'Generar uno con, por ejemplo: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  })
  @MinLength(16, { message: 'JWT_SECRET debe tener al menos 16 caracteres (idealmente 32+, aleatorio)' })
  JWT_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(
      `Configuración de entorno inválida — la API no puede arrancar:\n- ${messages.join('\n- ')}`,
    );
  }

  return validated;
}
