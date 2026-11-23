import { query } from '../lib/db.js';
import { logger } from '../utils/logger.js';

/**
 * Registra una acción crítica (quién, qué, cuándo, desde dónde) en audit_logs y en el log de
 * aplicación. Un fallo de auditoría se registra pero no rompe la operación principal.
 */
export async function logAudit({ actorId, action, entity, entityId, metadata = {}, ip }) {
  logger.info({ audit: true, actorId, action, entity, entityId, metadata }, `AUDIT ${action}`);
  try {
    await query(
      'INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [actorId ?? null, action, entity, entityId ? String(entityId) : null, JSON.stringify(metadata), ip ?? null],
    );
  } catch (err) {
    logger.error({ err: err.message, action }, 'No se pudo persistir el registro de auditoría');
  }
}
