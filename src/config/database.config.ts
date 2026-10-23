import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Configuracao da ligacao PostgreSQL.
 *
 * IMPORTANTE: a extensao PostGIS tem de estar ativa na base de dados
 * antes de correres a app pela primeira vez:
 *   CREATE EXTENSION IF NOT EXISTS postgis;
 *
 * synchronize=true so em desenvolvimento. Em producao usar migrations
 * (typeorm migration:generate / migration:run) para nao perder dados.
 */
export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'angotour',
  autoLoadEntities: true,
  // O esquema so muda por migrations. Em desenvolvimento, DB_SYNC=true no .env
  // continua a criar tabelas automaticamente. As migrations correm no arranque
  // quando DB_SYNC nao esta ligado.
  synchronize: process.env.DB_SYNC === 'true',
  migrations: [__dirname + '/../migrations/*.js'],
  migrationsRun: process.env.DB_SYNC !== 'true',
});
