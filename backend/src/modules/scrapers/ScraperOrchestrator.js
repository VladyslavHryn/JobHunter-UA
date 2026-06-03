import JoobleScraper from './JoobleScraper.js';
import WorkUaScraper from './WorkUaScraper.js';
import RobotaUaScraper from './RobotaUaScraper.js';
import DouScraper from './DouScraper.js';
import logger from '../../utils/logger.js';

/**
 * Оркестратор: запускает все адаптеры параллельно через Promise.allSettled(),
 * собирает результаты, дедуплицирует, формирует предупреждения.
 */
export default class ScraperOrchestrator {
  constructor() {
    this.scrapers = [
      new JoobleScraper(),
      // new WorkUaScraper(), // Тимчасово відключено через агресивний Cloudflare захист
      new RobotaUaScraper(),
      new DouScraper(),
    ];
  }

  /**
   * Запускает поиск по всем источникам.
   * @param {Object} params — параметры поиска (keywords, location, level, skills, experience)
   * @returns {Promise<{ jobs: Object[], warnings: string[], stats: Object }>}
   */
  async searchAll(params) {
    logger.info('═══════════════════════════════════════════');
    logger.info('Запуск поиска по всем источникам...');
    logger.info(`Ключевые слова: "${params.keywords}"`);
    logger.info(`Навыки: ${params.skills?.join(', ') || 'не указаны'}`);
    logger.info(`Город: ${params.location || 'любой'}, Уровень: ${params.level}`);
    logger.info('═══════════════════════════════════════════');

    const startTime = Date.now();
    const warnings = [];
    const stats = { total: 0, bySource: {} };

    // Run all scrapers in parallel — each is isolated
    const results = await Promise.allSettled(
      this.scrapers.map((scraper) => scraper.safeFetch(params))
    );

    let allJobs = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { source, jobs, error } = result.value;

        if (error) {
          warnings.push(`⚠️ ${source}: ${error}`);
          stats.bySource[source] = { count: 0, error };
          logger.warn(`✗ ${source}: ${error}`);
        } else {
          stats.bySource[source] = { count: jobs.length, error: null };
          allJobs.push(...jobs);
          logger.info(`✓ ${source}: ${jobs.length} вакансий`);
        }
      } else {
        // Promise rejected (shouldn't happen with safeFetch, but just in case)
        const scraperName = 'Unknown';
        warnings.push(`⚠️ ${scraperName}: Непредвиденная ошибка`);
        logger.error(`✗ Rejection: ${result.reason?.message || result.reason}`);
      }
    }

    // Deduplicate by URL
    allJobs = this.deduplicateJobs(allJobs);

    stats.total = allJobs.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info('═══════════════════════════════════════════');
    logger.info(`Поиск завершён за ${elapsed}с. Итого: ${allJobs.length} уникальных вакансий`);
    for (const [source, data] of Object.entries(stats.bySource)) {
      logger.info(`  ${data.error ? '✗' : '✓'} ${source}: ${data.count} вакансий${data.error ? ` (${data.error})` : ''}`);
    }
    logger.info('═══════════════════════════════════════════');

    return { jobs: allJobs, warnings, stats };
  }

  /**
   * Дедупликация по URL и по title+company.
   */
  deduplicateJobs(jobs) {
    const seen = new Map();

    for (const job of jobs) {
      // Primary key: normalized URL
      const urlKey = job.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

      // Secondary key: title + company
      const contentKey = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;

      if (!seen.has(urlKey) && !seen.has(contentKey)) {
        seen.set(urlKey, job);
        if (contentKey.length > 3) {
          seen.set(contentKey, job);
        }
      }
    }

    // Return only unique values (skip content keys that are duplicates)
    const unique = [];
    const addedUrls = new Set();

    for (const [key, job] of seen) {
      const urlKey = job.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
      if (!addedUrls.has(urlKey)) {
        addedUrls.add(urlKey);
        unique.push(job);
      }
    }

    return unique;
  }
}
