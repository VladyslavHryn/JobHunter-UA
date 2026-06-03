import * as cheerio from 'cheerio';
import BaseScraper from './BaseScraper.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { httpClient, getRandomDelay, sleep } from '../../utils/httpClient.js';

/**
 * Адаптер для jobs.dou.ua.
 * Стратегия:
 *   - Основной поиск: https://jobs.dou.ua/vacancies/?search={keyword}
 *   - Для Intern/Junior: дополнительно https://jobs.dou.ua/first-job/
 *   - XHR-запрос для подгрузки вакансий (AJAX "Більше вакансій")
 */
export default class DouScraper extends BaseScraper {
  constructor() {
    super('DOU');
    this.baseUrl = 'https://jobs.dou.ua';
  }

  async search(params) {
    const allJobs = [];

    // Main search by keywords
    const keyword = params.keywords || (params.skills && params.skills[0]) || 'developer';
    const mainJobs = await this.scrapeListPage(
      `${this.baseUrl}/vacancies/?search=${encodeURIComponent(keyword)}`,
      keyword
    );
    allJobs.push(...mainJobs);

    // If intern/junior — also scrape first-job section
    if (['Intern', 'Junior'].includes(params.level)) {
      try {
        const firstJobResults = await this.scrapeListPage(
          `${this.baseUrl}/first-job/`,
          keyword
        );
        const existingUrls = new Set(allJobs.map((j) => j.url));
        for (const job of firstJobResults) {
          if (!existingUrls.has(job.url)) {
            allJobs.push(job);
          }
        }
        logger.info(`[DOU] Розділ "Перша робота": знайдено ${firstJobResults.length} вакансій`);
      } catch (err) {
        logger.warn(`[DOU] Помилка при парсингу /first-job/: ${err.message}`);
      }
    }

    // Also try category-specific search if we have skills
    if (params.skills && params.skills.length > 0) {
      const categoryMap = {
        'JavaScript': 'Front End', 'TypeScript': 'Front End',
        'React': 'Front End', 'Angular': 'Front End', 'Vue': 'Front End',
        'Node.js': 'Front End', 'Python': 'Python',
        'Java': 'Java', 'C#': '.NET', '.NET': '.NET',
        'PHP': 'PHP', 'Ruby': 'Ruby',
        'iOS': 'iOS', 'Swift': 'iOS',
        'Android': 'Android', 'Kotlin': 'Android',
        'DevOps': 'DevOps', 'Docker': 'DevOps', 'Kubernetes': 'DevOps',
        'QA': 'QA', 'Data Science': 'Data Science',
        'Machine Learning': 'Data Science', 'Design': 'Design',
      };

      const matchedCategory = params.skills.find((s) => categoryMap[s]);
      if (matchedCategory) {
        const category = categoryMap[matchedCategory];
        const slug = this.categorySlug(category);
        if (slug) {
          try {
            const catJobs = await this.scrapeListPage(
              `${this.baseUrl}/vacancies/${slug}`,
              keyword
            );
            const existingUrls = new Set(allJobs.map((j) => j.url));
            for (const job of catJobs) {
              if (!existingUrls.has(job.url)) {
                allJobs.push(job);
              }
            }
          } catch (err) {
            logger.warn(`[DOU] Помилка при парсингу категорії ${category}: ${err.message}`);
          }
        }
      }
    }

    logger.info(`[DOU] Парсинг завершено, знайдено ${allJobs.length} вакансій`);
    return allJobs;
  }

  async scrapeListPage(url, keyword) {
    const jobs = [];

    try {
      logger.info(`[DOU] Запит: ${url}`);

      const response = await httpClient.get(url, {
        headers: {
          'Referer': `${this.baseUrl}/vacancies/`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $ = cheerio.load(response.data);
      const csrfToken = $('input[name="csrfmiddlewaretoken"]').val() || '';

      this.parseVacancyList($, jobs);

      if (jobs.length > 0) {
        await sleep(getRandomDelay());
        try {
          const moreJobs = await this.loadMoreVacancies(url, csrfToken, $);
          jobs.push(...moreJobs);
        } catch {
          // Ignore XHR errors — we already have initial results
        }
      }
    } catch (err) {
      logger.error(`[DOU] Помилка при завантаженні ${url}: ${err.message}`);
      throw err;
    }

    return jobs;
  }

  parseVacancyList($, jobs) {
    const vacancySelectors = [
      '.l-vacancy',
      '.vacancy',
      'li.l-vacancy',
      'div.vacancy-item',
    ];

    let $vacancies = $([]);
    for (const sel of vacancySelectors) {
      $vacancies = $(sel);
      if ($vacancies.length > 0) break;
    }

    $vacancies.each((_i, el) => {
      const $el = $(el);
      const job = this.parseVacancyCard($, $el);
      if (job) jobs.push(job);
    });
  }

  parseVacancyCard($, $el) {
    try {
      const $titleLink = $el.find('a.vt, a[class*="title"], .title a').first();
      const title = $titleLink.text().trim();
      const url = $titleLink.attr('href') || '';

      if (!title || title.length < 3) return null;

      const company = $el.find('a.company, .company a, strong a[href*="company"]').first().text().trim()
        || $el.find('.company').first().text().trim();

      const infoText = $el.find('.cities, .city, span.cities').first().text().trim();
      let location = '';
      let salary = '';

      if (infoText) {
        const salaryMatch = infoText.match(/(\$[\d,.\s\-–—]+|\d[\d\s]*[-–—]\s*\d[\d\s]*(?:грн|usd|\$))/i);
        if (salaryMatch) {
          salary = salaryMatch[1].trim();
        }
        location = infoText.replace(/\$[\d,.\s\-–—]+/g, '').replace(/,\s*$/, '').trim();
      }

      if (!salary) {
        const salaryEl = $el.find('.salary, [class*="salary"]').first().text().trim();
        if (salaryEl) salary = salaryEl;
      }

      const description = $el.find('.sh-info, .vacancy-excerpt, div.text, .des').first().text().trim();
      const dateText = $el.find('.date, .time, [class*="date"]').first().text().trim();

      return this.normalizeJob({
        title,
        company,
        location,
        salary,
        description: description.slice(0, 500),
        url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
        postedAt: dateText || null,
        requirements: description,
      });
    } catch (err) {
      logger.warn(`[DOU] Помилка парсингу картки: ${err.message}`);
      return null;
    }
  }

  async loadMoreVacancies(pageUrl, csrfToken, $) {
    const moreJobs = [];

    try {
      const xhrUrl = `${this.baseUrl}/vacancies/xhr-load/`;
      const countEl = $('div.more-btn a, a.more-btn, [class*="more"]');
      if (countEl.length === 0) return moreJobs;

      const response = await httpClient.post(
        xhrUrl,
        `csrfmiddlewaretoken=${csrfToken}&count=20`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': pageUrl,
            'X-Requested-With': 'XMLHttpRequest',
          },
        }
      );

      if (response.data && response.data.html) {
        const $more = cheerio.load(response.data.html);
        this.parseVacancyList($more, moreJobs);
      }
    } catch {
      // XHR load more is best-effort
    }

    return moreJobs;
  }

  categorySlug(category) {
    const slugMap = {
      'Front End': '?category=Front+End',
      'Python': '?category=Python',
      'Java': '?category=Java',
      '.NET': '?category=.NET',
      'PHP': '?category=PHP',
      'Ruby': '?category=Ruby',
      'iOS': '?category=iOS',
      'Android': '?category=Android',
      'DevOps': '?category=DevOps',
      'QA': '?category=QA',
      'Data Science': '?category=Data+Science',
      'Design': '?category=Design',
    };
    return slugMap[category] || '';
  }
}
