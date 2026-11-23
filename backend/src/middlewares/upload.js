// Subida de portada: multer en memoria con límites estrictos. La verificación real del tipo
// (magic bytes) ocurre en storageService; acá solo se limita tamaño y cantidad.
import multer from 'multer';

export const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
}).single('cover');
