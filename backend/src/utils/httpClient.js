import config from '../config/index.js';
import logger from './logger.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
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

class HttpClient {
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url, data, options = {}) {
    return this.request(url, { ...options, method: 'POST', body: data });
  }

  async request(url, options = {}, retryCount = 0) {
    const headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7,ru;q=0.6',
      'User-Agent': getRandomUserAgent(),
      ...(options.headers || {}),
    };

    // Native fetch timeout implementation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || config.scraping.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;
      
      // Cloudflare blocks datacenter IPs, we should fail fast on 403
      const isRetryable = status === 429 || status === 503 || status === 502 || status === 504;

      if (!response.ok) {
        if (isRetryable && retryCount < config.scraping.maxRetries) {
          const backoff = Math.pow(3, retryCount + 1) * 1000;
          logger.warn(`HTTP ${status} → Retry ${retryCount + 1}/${config.scraping.maxRetries} in ${backoff}ms: ${url}`);
          await sleep(backoff);
          return this.request(url, options, retryCount + 1);
        }
        
        const error = new Error(`Request failed with status code ${status}`);
        error.response = { status, data: await response.text().catch(() => '') };
        throw error;
      }

      // Emulate axios response structure
      const data = await response.text();
      return { data, status, headers: response.headers };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError' && retryCount < config.scraping.maxRetries) {
        const backoff = Math.pow(3, retryCount + 1) * 1000;
        logger.warn(`HTTP Timeout → Retry ${retryCount + 1}/${config.scraping.maxRetries} in ${backoff}ms: ${url}`);
        await sleep(backoff);
        return this.request(url, options, retryCount + 1);
      }
      
      throw error;
    }
  }
}

const httpClient = new HttpClient();

export { httpClient, getRandomDelay, sleep, getRandomUserAgent };
