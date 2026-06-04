import * as cheerio from 'cheerio';
import BaseScraper from './BaseScraper.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { httpClient, getRandomDelay, sleep } from '../../utils/httpClient.js';
import axios from 'axios';

/**
 * Adapter for work.ua - web scraping via Cheerio.
 * URL pattern: https://www.work.ua/jobs-{keyword}/?page={n}
 */
export default class WorkUaScraper extends BaseScraper {
  constructor() {
    super('Work.ua');
    this.baseUrl = 'https://www.work.ua';
  }

  async search(params, env = {}) {
    const token = env.APIFY_TOKEN || config.apifyToken;
    const useApify = !!token || config.useApifyForWorkUa;

    if (useApify) {
      logger.info('[Work.ua] Использование стратегии: Apify API');
      return this.searchApify(params, token);
    } else {
      logger.info('[Work.ua] Использование стратегии: Local (Cheerio)');
      return this.searchLocal(params);
    }
  }

  async searchApify(params, token) {
    if (!token) {
      logger.warn('[Work.ua] Apify Token не найден. Пропускаем...');
      return [];
    }

    try {
      const keyword = this.buildSearchKeyword(params);
      
      const requestBody = {
        keywords: keyword,
        location: params.location === 'Remote' ? '' : (params.location || ''),
        maxItems: config.scraping.maxResultsPerSource || 60,
        fetchDescription: true
      };

      const apifyUrl = `https://api.apify.com/v2/acts/unfenced-group~work-ua-scraper/run-sync-get-dataset-items?token=${token}`;
      
      logger.info(`[Work.ua] Запуск Apify Actor для '${keyword}'... это может занять минуту.`);
      const response = await axios.post(apifyUrl, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      });

      const items = response.data || [];
      logger.info(`[Work.ua] Apify вернул ${items.length} результатов.`);

      return items.map(job => {
        // Translate basic cities from Russian to Ukrainian
        let loc = job.location || '';
        loc = loc.replace(/Киев/g, 'Київ')
                 .replace(/Днепр/g, 'Дніпро')
                 .replace(/Харьков/g, 'Харків')
                 .replace(/Одесса/g, 'Одеса')
                 .replace(/Львов/g, 'Львів')
                 .replace(/Запорожье/g, 'Запоріжжя')
                 .replace(/Николаев/g, 'Миколаїв')
                 .replace(/Винница/g, 'Вінниця');

        return this.normalizeJob({
          title: job.title || '',
          company: job.company || '',
          location: loc,
          salary: job.salaryRaw || '',
          description: job.descriptionText || job.descriptionSnippet || '',
          url: job.url || '',
          logo: job.companyLogoUrl || '',
          requirements: job.skills ? job.skills.join(', ') : ''
        });
      });

    } catch (error) {
      logger.error(`[Work.ua] Ошибка при вызове Apify API: ${error.message}`);
      return [];
    }
  }

  async searchLocal(params) {
    const allJobs = [];
    const maxPages = config.scraping.maxPagesPerSource;

    // Build search keyword from job title + top skills
    const keyword = this.buildSearchKeyword(params);
    const encodedKeyword = encodeURIComponent(keyword).replace(/%20/g, '+');

    for (let page = 1; page <= maxPages; page++) {
      try {
        const url = `${this.baseUrl}/jobs-${encodedKeyword}/?page=${page}`;
        logger.info(`[Work.ua] Запрос: ${url}`);

        let fetchOptions = {
          headers: {
            'Referer': 'https://www.work.ua/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          }
        };

        let fetchUrl = url;
        if (env && env.SCRAPER_API_KEY) {
            fetchUrl = `http://api.scraperapi.com?api_key=${env.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
            logger.info(`[Work.ua] Использую ScraperAPI для обхода блокировок`);
            fetchOptions.timeout = 60000;
            fetchOptions.maxRetries = 0;
        }

        const response = await httpClient.get(fetchUrl, fetchOptions);

        const $ = cheerio.load(response.data);
        const jobCards = $('div.card.card-hover, div.job-link, div[class*="card"]').has('h2 a');

        if (jobCards.length === 0) {
          // Try alternative selector
          const altCards = $('div#pjax-job-list div.card, .card-visited');
          if (altCards.length === 0 && page === 1) {
            logger.warn(`[Work.ua] Не найдено вакансий на странице ${page}. Возможно, структура страницы изменилась.`);
          }
          if (altCards.length === 0) break;

          altCards.each((_i, el) => {
            const job = this.parseJobCard($, $(el));
            if (job) allJobs.push(job);
          });
        } else {
          jobCards.each((_i, el) => {
            const job = this.parseJobCard($, $(el));
            if (job) allJobs.push(job);
          });
        }

        logger.info(`[Work.ua] Страница ${page}: найдено ${jobCards.length} вакансий`);

        // Check if there's a next page
        const hasNextPage = $('ul.pagination li.active + li a').length > 0 ||
                           $('a[aria-label="Next"]').length > 0;
        if (!hasNextPage) break;

        // Polite delay
        if (page < maxPages) {
          await sleep(getRandomDelay());
        }
      } catch (err) {
        logger.error(`[Work.ua] Ошибка на странице ${page}: ${err.message}`);
        break;
      }
    }

    logger.info(`[Work.ua] Парсинг завершен, найдено ${allJobs.length} вакансий`);
    return allJobs;
  }

  parseJobCard($, $card) {
    try {
      // Title and URL
      const $titleLink = $card.find('h2 a').first();
      if (!$titleLink.length) return null;

      const title = $titleLink.text().trim();
      const relativeUrl = $titleLink.attr('href') || '';
      const url = relativeUrl.startsWith('http') ? relativeUrl : `${this.baseUrl}${relativeUrl}`;

      // Company
      const company = $card.find('div.add-top-xs > span > b, div.add-top-xs b, span.company-name, div.mt-xs b, div.mt-xs > span.strong-600, .mr-xs span, .mr-xs strong, span.strong-600')
        .first()
        .text()
        .trim() || $card.find('b, strong').first().text().trim() || '';

      // Salary
      const salaryEl = $card.find('span.text-muted, span[title], div.salary');
      let salary = '';
      salaryEl.each((_i, el) => {
        const text = $(el).text().trim();
        if (text.match(/грн|uah|usd|\$/i) || text.match(/\d+\s*[-–—]\s*\d+/)) {
          salary = text;
          return false;
        }
      });

      // Description
      let description = $card.find('p.overflow, p.cut-bottom, p.text-muted.overflow, div.cut-top')
        .first()
        .text()
        .trim();

      if (!description) {
        // Fallback: take the longest <p> tag in the card that doesn't look like meta info
        let longestP = '';
        $card.find('p').each((_i, el) => {
          const text = $(el).text().trim();
          if (text.length > longestP.length && !text.includes('грн') && !text.includes('·')) {
            longestP = text;
          }
        });
        description = longestP;
      }

      // Location
      const metaText = $card.find('.text-muted, .add-top-xs').text();
      let location = '';
      const cityMatch = metaText.match(/(Київ|Харків|Одеса|Дніпро|Львів|Запоріжжя|Вінниця|Полтава|Remote|Удаленно|Віддалено)/i);
      if (cityMatch) {
        location = cityMatch[1];
      }

      if (!title) return null;

      return this.normalizeJob({
        title,
        company,
        location,
        salary,
        description: description || '',
        url,
        requirements: description || '',
      });
    } catch (err) {
      logger.warn(`[Work.ua] Ошибка парсинга карточки: ${err.message}`);
      return null;
    }
  }

  buildSearchKeyword(params) {
    const parts = [];
    if (params.keywords) {
      parts.push(params.keywords);
    }
    if (params.skills && params.skills.length > 0) {
      parts.push(...params.skills.slice(0, 2));
    }
    return parts.join(' ') || 'developer';
  }
}
