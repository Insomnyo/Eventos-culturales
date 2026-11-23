// Portadas en disco local (backend/uploads/covers). No hay carpeta pública: los archivos solo se
// entregan por /api/media/covers/:file con URL firmada y con vencimiento.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../config/env.js';
import { query } from '../lib/db.js';
import { AppError } from '../utils/errors.js';
import { newId } from '../utils/crypto.js';
import { signedCoverUrl } from '../utils/media.js';
import { assertCanManage, getEventOrThrow } from './eventService.js';
import { logAudit } from './auditService.js';

// Whitelist por CONTENIDO real (magic bytes): se ignora el nombre y el Content-Type que declara el cliente.
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const coversDir = () => path.join(env.uploadsDir, 'covers');

export async function ensureUploadDirs() {
  await fs.mkdir(coversDir(), { recursive: true });
}

export async function uploadEventCover(user, eventId, file, ip) {
  if (!file) throw new AppError(400, 'file_required', 'Elegí una imagen para subir.');

  const event = await getEventOrThrow(eventId);
  assertCanManage(event, user);

  const detected = await fileTypeFromBuffer(file.buffer);
  const extension = detected && ALLOWED[detected.mime];
  if (!extension) throw new AppError(415, 'unsupported_media', 'Solo se permiten imágenes JPG, PNG o WebP.');

  // Nombre generado por el servidor (UUID v4): sin path traversal y no adivinable.
  const filename = `${newId()}.${extension}`;
  await ensureUploadDirs();
  await fs.writeFile(path.join(coversDir(), filename), file.buffer, { flag: 'wx' });

  try {
    await query('UPDATE events SET cover_file = ? WHERE id = ?', [filename, eventId]);
  } catch (err) {
    await fs.rm(path.join(coversDir(), filename), { force: true });   // no dejar archivos huérfanos
    throw err;
  }
  if (event.cover_file) await fs.rm(path.join(coversDir(), event.cover_file), { force: true });

  await logAudit({ actorId: user.id, action: 'event.cover_upload', entity: 'event', entityId: eventId, metadata: { mime: detected.mime, bytes: file.size }, ip });
  return { cover_url: signedCoverUrl(filename) };
}
