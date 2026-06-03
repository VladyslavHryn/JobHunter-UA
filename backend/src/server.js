import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import logger from './utils/logger.js';
import resumeRoutes from './routes/resumeRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// ── Middleware ────────────────────────────────────────────
// Дозволяємо запити з локалхосту та з будь-якого задеплоєного фронтенду
app.use(cors({
  origin: true, // Дозволяє всі origin, ідеально для Vercel
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  if (req.url !== '/api/health' && req.url !== '/') {
    logger.info(`→ ${req.method} ${req.url}`);
  }
  next();
});

// ── Routes ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/resume', resumeRoutes);
app.use('/api/search', searchRoutes);

// ── Error Handler ────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info('═══════════════════════════════════════════');
  logger.info(`🚀 JobHunter UA Backend запущен`);
  logger.info(`   Порт: ${config.port}`);
  logger.info(`   Режим: ${config.nodeEnv}`);
  logger.info(`   Jooble API: ${config.joobleApiKey ? '✓ настроен' : '✗ не указан'}`);
  logger.info(`   Время: ${new Date().toLocaleString('uk-UA')}`);
  logger.info('═══════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM получен. Завершаю...');
  server.close(() => {
    logger.info('Сервер остановлен.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT получен. Завершаю...');
  server.close(() => {
    process.exit(0);
  });
});

export default app;
