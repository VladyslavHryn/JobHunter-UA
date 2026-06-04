import BaseScraper from './BaseScraper.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { httpClient, getRandomDelay, sleep } from '../../utils/httpClient.js';

/**
 * Адаптер для robota.ua.
 *
 * Стратегия (3 уровня):
 *   1) Публичный JSON API: GET https://api.robota.ua/vacancy/search
 *      — это тот же XHR запрос, который делает браузер при открытии страницы поиска.
 *      Без корректных Origin/Referer заголовков возвращает 403.
 *   2) RSS fallback: https://robota.ua/rss/vacancies?keyWords=...
 *      — стабильный XML-фид, работает без авторизации.
 *   3) Если оба варианта провалились — возвращаем пустой массив (не бросаем ошибку).
 *
 * ПОЧЕМУ НЕ HTML-скрапинг:
 *   Сайт работает на Angular SSR — при HTTP запросе без браузера приходит
 *   пустой шаблон, Angular компоненты (santa-vacancy-card, alliance-vacancy-card-desktop)
 *   рендерятся клиентом и недоступны через Cheerio.
 */
export default class RobotaUaScraper extends BaseScraper {
  constructor() {
    super('Robota.ua');
    this.baseUrl = 'https://robota.ua';
    this.apiUrl = 'https://api.robota.ua/vacancy/search';
    this.rssUrl = 'https://robota.ua/rss/vacancies';
  }

  async search(params, env = {}) {
    // --- Уровень 1: официальный публичный API ---
    try {
      const results = await this.searchViaApi(params, env);
      if (results.length > 0) {
        logger.info(`[Robota.ua] API вернул ${results.length} вакансий`);
        return results;
      }
      logger.warn('[Robota.ua] API вернул 0 результатов, пробую RSS');
    } catch (err) {
      logger.warn(`[Robota.ua] API недоступен (${err.message}), переключаюсь на RSS`);
    }

    // --- Уровень 2: RSS fallback ---
    try {
      const results = await this.searchViaRss(params, env);
      if (results.length > 0) {
        logger.info(`[Robota.ua] RSS вернул ${results.length} вакансий`);
        return results;
      }
      logger.warn('[Robota.ua] RSS также пуст');
    } catch (err) {
      logger.warn(`[Robota.ua] RSS недоступен: ${err.message}`);
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Level 1: Public JSON API
  // ---------------------------------------------------------------------------

  async searchViaApi(params, env = {}) {
    const allJobs = [];
    const maxPages = config.scraping.maxPagesPerSource;
    const keyword = this.buildKeyword(params);

    for (let page = 0; page < maxPages; page++) {
      const body = {
        keyWords: keyword,
        page,
      };

      const cityId = this.getCityId(params.location);
      if (cityId) body.cityId = cityId;

      logger.info(`[Robota.ua] API POST ${this.apiUrl} page=${page}`);

      let fetchOptions = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8',
          'Origin': this.baseUrl,
          'Referer': `${this.baseUrl}/zapros/${encodeURIComponent(keyword)}/ukraine`,
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
        timeout: 10000,
      };

      let fetchUrl = this.apiUrl;
      if (env && env.SCRAPER_API_KEY) {
        fetchUrl = `http://api.scraperapi.com?api_key=${env.SCRAPER_API_KEY}&url=${encodeURIComponent(this.apiUrl)}`;
        fetchOptions.timeout = 60000;
        fetchOptions.maxRetries = 0;
      }

      const response = await httpClient.post(fetchUrl, JSON.stringify(body), fetchOptions);

      // Make sure the response is JSON (not an HTML error page)
      const contentType = response.headers && typeof response.headers.get === 'function' 
        ? response.headers.get('content-type') || ''
        : response.headers['content-type'] || '';
        
      if (!contentType.includes('application/json')) {
        logger.warn(`[Robota.ua] Неожиданный Content-Type: ${contentType}`);
        break;
      }

      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          logger.warn(`[Robota.ua] Ошибка парсинга JSON: ${e.message}`);
          break;
        }
      }

      // API может вернуть вакансии в разных полях в зависимости от версии
      const vacancies = data.documents || data.vacancies || data.data || data.items || [];
      if (!Array.isArray(vacancies) || vacancies.length === 0) break;

      for (const v of vacancies) {
        const job = this.normalizeApiVacancy(v);
        if (job) allJobs.push(job);
      }

      logger.info(`[Robota.ua] Страница ${page}: ${vacancies.length} вакансий`);

      // Check if there is a next page
      const total = data.total || data.totalCount || data.count || 0;
      const pageSize = vacancies.length;
      const fetched = page * (data.pageSize || pageSize) + pageSize;
      if (fetched >= total || vacancies.length < (data.pageSize || 20)) break;

      if (page < maxPages - 1) {
        await sleep(getRandomDelay());
      }
    }

    return allJobs;
  }

  normalizeApiVacancy(v) {
    try {
      const id = v.id || v.vacancyId || v.vacancy_id;
      const title = v.name || v.title || v.vacancyName || '';
      if (!title) return null;

      const company =
        v.companyName ||
        v.company?.name ||
        v.employer?.name ||
        v.company ||
        '';

      const location =
        v.cityName ||
        v.city?.name ||
        v.location?.name ||
        v.location ||
        '';

      // Build vacancy URL
      let url = v.link || v.url || '';
      
      // If URL is relative (or empty), build it
      if (!url && id) {
        const companyId = v.notebookId || v.companyId || v.company?.id || '';
        url = companyId
          ? `/company${companyId}/vacancy${id}`
          : `/vacancy/${id}`;
      }
      
      // Очищаем от мусора (двойные слэши в конце и т.д.)
      url = url.replace(/\/+$/, '');

      if (url && !url.startsWith('http')) {
        url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
      }

      let logo = v.companyLogo || v.company?.logo || v.logo || '';
      if (logo && logo.includes('defaultlogo')) {
        logo = '';
      } else if (logo && !logo.startsWith('http')) {
        logo = `https://robota.ua/images/logotype/${logo.replace(/^\/+/, '')}`;
      }

      return this.normalizeJob({
        id,
        title,
        company,
        location,
        salary: this.formatSalary(v),
        description: v.shortDescription || v.description || v.snippet || '',
        url,
        logo,
        postedAt: v.publishedDate || v.created_at || v.date || null,
        requirements: v.shortDescription || v.description || '',
      });
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Level 2: RSS fallback
  // ---------------------------------------------------------------------------

  async searchViaRss(params, env = {}) {
    const keyword = this.buildKeyword(params);
    // cityId намеренно не передаём — RSS его не поддерживает
    const targetUrl = `${this.rssUrl}?keyWords=${encodeURIComponent(keyword)}`;
    logger.info(`[Robota.ua] RSS GET ${targetUrl}`);

    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Origin': 'https://robota.ua',
        'Referer': 'https://robota.ua/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        'Sec-Ch-Ua-Platform': '"Windows"',
    };

    let fetchOptions = { headers, timeout: 10000 };
    let fetchUrl = targetUrl;
    
    if (env && env.SCRAPER_API_KEY) {
      fetchUrl = `http://api.scraperapi.com?api_key=${env.SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}`;
      fetchOptions.timeout = 60000;
      fetchOptions.maxRetries = 0;
    }

    const response = await httpClient.get(fetchUrl, fetchOptions);

    const xml = response.data;
    logger.info(`[Robota.ua] RSS ответ: ${xml.length} байт, первые 200: ${String(xml).slice(0, 200)}`);

    const jobs = this.parseRss(xml);
    logger.info(`[Robota.ua] RSS распарсил ${jobs.length} вакансий`);
    return jobs;
  }

  parseRss(xml) {
    const jobs = [];

    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const item of items) {
      const title = this.extractXml(item, 'title');

      // <link> in RSS often lacks a closing tag - use <guid> as a reliable fallback
      let link = this.extractXmlLink(item);
      if (!link) link = this.extractXml(item, 'guid');

      // Decode HTML entities in URL (&amp; → &)
      link = this.decodeHtml(link || '');

      // Clear double slashes at the end
      link = (link || '').replace(/\/+$/, '');

      // Ensure absolute URL
      if (link && !link.startsWith('http')) {
        link = `${this.baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
      }

      const description = this.extractXml(item, 'description');
      const pubDate = this.extractXml(item, 'pubDate');
      const company = this.extractXml(item, 'author') ||
        (description.match(/Компанія:\s*([^\n<]+)/)?.[1] || '');

      if (!title) continue;

      jobs.push(
        this.normalizeJob({
          title: this.decodeHtml(title),
          url: link,
          company: this.decodeHtml(company),
          description: this.decodeHtml(this.stripHtml(description)).slice(0, 500),
          postedAt: pubDate ? new Date(pubDate).toISOString() : null,
        })
      );
    }

    // Diagnostic: log the first URL to verify format
    if (jobs.length > 0) {
      logger.info(`[Robota.ua] RSS sample URL: ${jobs[0].url}`);
    }

    return jobs;
  }

  /**
   * Special extractor for <link> tag in RSS.
   * In RSS 2.0 <link> often lacks a closing tag or is written non-standardly.
   * Trying several patterns.
   */
  extractXmlLink(xml) {
    // Pattern 1: <link>URL</link>
    let m = xml.match(/<link[^>]*>([^<]+)<\/link>/i);
    if (m?.[1]?.trim()) return m[1].trim();

    // Pattern 2: <link>URL\n (no closing tag, up to next tag)
    m = xml.match(/<link[^>]*>\s*([^\s<][^<]*?)\s*(?:<|$)/i);
    if (m?.[1]?.startsWith('http')) return m[1].trim();

    // Pattern 3: <atom:link href="URL">
    m = xml.match(/<atom:link[^>]+href=["']([^"']+)["']/i);
    if (m?.[1]) return m[1];

    return '';
  }

  stripHtml(str) {
    return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  decodeHtml(str) {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  formatSalary(v) {
    if (v.salary) return String(v.salary);
    const min = v.salaryFrom || v.salary_from || v.salaryMin;
    const max = v.salaryTo || v.salary_to || v.salaryMax;
    if (min && max) return `${min} – ${max} грн`;
    if (min) return `від ${min} грн`;
    if (max) return `до ${max} грн`;
    return '';
  }

  buildKeyword(params) {
    const parts = [];
    if (params.keywords) parts.push(params.keywords);
    // Do not add skills to keyword - otherwise the request becomes too specific
    return parts.join(' ') || 'developer';
  }

  getCityId(location) {
    if (!location || location === 'Remote') return 0;
    const cityMap = {
      'Київ': 1, 'Kyiv': 1, 'Kiev': 1,
      'Львів': 2, 'Lviv': 2,
      'Одеса': 3, 'Odessa': 3, 'Odesa': 3,
      'Дніпро': 4, 'Dnipro': 4, 'Dnepropetrovsk': 4,
      'Вінниця': 6, 'Vinnytsia': 6,
      'Запоріжжя': 8, 'Zaporizhzhia': 8,
      'Харків': 21, 'Kharkiv': 21,
      'Полтава': 22, 'Poltava': 22,
    };
    return cityMap[location] || 0;
  }
}
