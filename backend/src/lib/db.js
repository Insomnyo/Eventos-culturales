// Pool de conexiones MySQL/MariaDB. TODAS las consultas son parametrizadas (placeholders "?"):
// los valores nunca se concatenan en el SQL → sin inyección SQL.
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',   // las fechas JS ↔ DATETIME se interpretan siempre en UTC
});

// La sesión de cada conexión también trabaja en UTC (para CURRENT_TIMESTAMP y similares).
pool.pool.on('connection', (connection) => connection.query("SET time_zone = '+00:00'"));

/** Ejecuta una consulta parametrizada y devuelve las filas. */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Ejecuta `work(conn)` dentro de UNA transacción de base de datos.
 * Si lanza un error → ROLLBACK; si termina bien → COMMIT.
 * READ COMMITTED: tras tomar un bloqueo de fila (SELECT ... FOR UPDATE) toda lectura posterior
 * ve lo último confirmado por otras transacciones (con REPEATABLE READ se podría leer una foto vieja).
 */
export async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}
