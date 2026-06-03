import BaseScraper from './BaseScraper.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import axios from 'axios';

/**
 * Адаптер для Jooble — использует официальный REST API.
 * POST https://jooble.org/api/{API_KEY}
 */
export default class JoobleScraper extends BaseScraper {
  constructor() {
    super('Jooble');
    this.apiKey = config.joobleApiKey;
    this.baseUrl = 'https://ua.jooble.org/api';
  }

  async search(params) {
    if (!this.apiKey) {
      logger.warn('[Jooble] API-ключ не указан. Пропускаю Jooble. Укажите JOOBLE_API_KEY в .env');
      return [];
    }

    const allJobs = [];
    const maxPages = config.scraping.maxPagesPerSource;

    for (let page = 1; page <= maxPages; page++) {
      try {
        const requestBody = {
          keywords: params.keywords,
          location: params.location === 'Remote' ? '' : params.location,
          page: page.toString(),
          searchMode: 1,
        };

        const response = await axios.post(
          `${this.baseUrl}/${this.apiKey}`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: config.scraping.requestTimeout,
          }
        );

        const data = response.data;
        logger.info(`[Jooble] Запрос к API выполнен (${response.status} OK), страница ${page}`);

        if (!data.jobs || data.jobs.length === 0) {
          break;
        }

        for (const job of data.jobs) {
          allJobs.push(
            this.normalizeJob({
              id: job.id || `jooble-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title: job.title || '',
              company: job.company || '',
              location: job.location || '',
              salary: job.salary || '',
              description: this.stripHtml(job.snippet || ''),
              url: job.link || '',
              postedAt: job.updated || null,
            })
          );
        }

        // If total results are fewer than expected, no more pages
        if (allJobs.length >= (data.totalCount || 0)) {
          break;
        }
      } catch (err) {
        logger.error(`[Jooble] Ошибка на странице ${page}: ${err.message}`);
        if (page === 1) throw err; // Fail if even the first page fails
        break;
      }
    }

    return allJobs;
  }

  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
