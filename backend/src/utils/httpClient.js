import axios from 'axios';
import config from '../config/index.js';
import logger from './logger.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay() {
  const { min, max } = config.scraping.delayBetweenRequests;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const httpClient = axios.create({
  timeout: config.scraping.requestTimeout,
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7,ru;q=0.6',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  },
});

// Request interceptor: rotate User-Agent per request
httpClient.interceptors.request.use((reqConfig) => {
  reqConfig.headers['User-Agent'] = getRandomUserAgent();
  return reqConfig;
});

// Response interceptor: retry on 429, 503, network errors
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error.config;
    if (!cfg) return Promise.reject(error);

    cfg.__retryCount = cfg.__retryCount || 0;

    const status = error.response?.status;
    const isRetryable =
      status === 429 ||
      status === 503 ||
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT';

    if (isRetryable && cfg.__retryCount < config.scraping.maxRetries) {
      cfg.__retryCount += 1;
      const backoff = Math.pow(3, cfg.__retryCount) * 1000; // 3s, 9s, 27s
      logger.warn(
        `HTTP ${status || error.code} → Retry ${cfg.__retryCount}/${config.scraping.maxRetries} in ${backoff}ms: ${cfg.url}`
      );
      await sleep(backoff);
      cfg.headers['User-Agent'] = getRandomUserAgent();
      return httpClient(cfg);
    }

    return Promise.reject(error);
  }
);

export { httpClient, getRandomDelay, sleep, getRandomUserAgent };
