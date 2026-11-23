import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { pool } from './lib/db.js';
import { ensureUploadDirs } from './services/storageService.js';

// Verifica la conexión a MySQL antes de abrir el puerto: si XAMPP no está iniciado, el mensaje es claro.
try {
  await pool.query('SELECT 1');
  await ensureUploadDirs();
} catch (err) {
  logger.fatal(`No se pudo conectar a MySQL en ${env.DB_HOST}:${env.DB_PORT} (base "${env.DB_NAME}"): ${err.message}`);
  logger.fatal('¿Está iniciado el módulo MySQL de XAMPP y ejecutaste backend/sql/base_de_datos_mysql.sql en HeidiSQL?');
  process.exit(1);
}

const app = createApp();
const server = app.listen(env.PORT, () => logger.info(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`));

// Timeouts del servidor HTTP (mitigan ataques tipo Slowloris).
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

const shutdown = (signal) => {
  logger.info(`${signal} recibido: cerrando servidor...`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Errores no capturados: se registran y se sale (el orquestador reinicia el proceso).
process.on('unhandledRejection', (reason) => { logger.fatal({ reason: String(reason) }, 'unhandledRejection'); process.exit(1); });
process.on('uncaughtException', (err) => { logger.fatal({ err: err.message, stack: err.stack }, 'uncaughtException'); process.exit(1); });
