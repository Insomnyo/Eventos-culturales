// Corta peticiones que tardan demasiado (protección ante conexiones lentas / recursos colgados).
export const requestTimeout = (ms = 15000) => (req, res, next) => {
  res.setTimeout(ms, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: { code: 'timeout', message: 'La solicitud tardó demasiado.', requestId: req.id } });
    }
  });
  next();
};
