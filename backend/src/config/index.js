import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  joobleApiKey: process.env.JOOBLE_API_KEY || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['application/pdf'],
    uploadDir: 'uploads',
  },
  scraping: {
    requestTimeout: 15000,
    maxRetries: 3,
    delayBetweenRequests: { min: 1500, max: 3000 },
    maxPagesPerSource: 3,
    maxResultsPerSource: 60,
  },
};

export default config;
