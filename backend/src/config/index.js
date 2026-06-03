const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  joobleApiKey: process.env.JOOBLE_API_KEY || '',
  apifyToken: process.env.APIFY_TOKEN || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
  useApifyForWorkUa: !!process.env.APIFY_TOKEN || process.env.NODE_ENV === 'production',
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
