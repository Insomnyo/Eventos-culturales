import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { globalLimiter } from './middlewares/rateLimit.js';
import { requestTimeout } from './middlewares/requestTimeout.js';
import { notFoundHandler, errorHandler } from './middlewares/errors.js';
import router from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Detrás de un proxy (Render, Nginx...) req.ip debe ser la IP real del cliente; si no, el rate limit
  // vería siempre la IP del proxy. Configurable: TRUST_PROXY=1.
  app.set('trust proxy', env.TRUST_PROXY);

  // ID por request: se devuelve al cliente en los errores y permite correlacionarlo con los logs.
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  // Cabeceras de seguridad. Esta API solo devuelve JSON, así que la CSP es restrictiva al máximo.
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },   // HSTS (solo se aplica sobre HTTPS)
    referrerPolicy: { policy: 'no-referrer' },
    // X-Content-Type-Options: nosniff, X-Frame-Options, COOP/CORP... vienen activos por defecto en Helmet.
  }));

  // CORS estricto: solo los orígenes listados en FRONTEND_ORIGIN (nunca "*"). credentials: true es necesario
  // únicamente para la cookie del refresh token (SameSite=Strict). El resto de la API usa "Authorization: Bearer".
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true); // sin Origin = curl/healthchecks (no es un navegador)
      return callback(new Error('CORS_NOT_ALLOWED'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
    maxAge: 600,
  }));

  app.use(requestTimeout(15000));
  app.use(globalLimiter);
  app.use(cookieParser());
  app.use(express.json({ limit: '20kb' }));   // límite de tamaño del body (los archivos van por multipart, con su propio límite)

  app.use('/api', router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
