import logger from '../utils/logger.js';

function errorHandler(err, req, res, _next) {
  logger.error(`Error: ${err.message}`, { stack: err.stack, url: req.url, method: req.method });

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'Файл слишком большой. Максимальный размер — 5 МБ.',
    });
  }

  if (err.message && err.message.includes('PDF')) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Внутренняя ошибка сервера' : err.message,
  });
}

export default errorHandler;
