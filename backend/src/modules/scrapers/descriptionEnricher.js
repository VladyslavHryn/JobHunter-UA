import * as cheerio from 'cheerio';
import { httpClient, sleep } from '../../utils/httpClient.js';
import logger from '../../utils/logger.js';

/**
 * Догружает полный текст страниц для топ-N вакансий.
 *
 * Стратегия:
 *   - Обрабатываем батчами по BATCH_SIZE параллельно
 *   - Между батчами — пауза BATCH_DELAY мс
 *   - Таймаут на каждый запрос — 8 сек
 *   - Если страница не загрузилась — оставляем оригинальное описание
 */

const BATCH_SIZE  = 5;    // параллельных запросов за раз
const BATCH_DELAY = 800;  // мс между батчами
const PAGE_TIMEOUT = 8000;

export async function enrichTopJobs(jobs) {
  const enriched = [];
  const total = jobs.length;
  let success = 0;
  let failed  = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(job => fetchFullText(job))
    );

    for (let j = 0; j < results.length; j++) {
      const job = batch[j];
      const result = results[j];

      if (result.status === 'fulfilled' && result.value) {
        enriched.push({ ...job, ...result.value });
        success++;
      } else {
        // Не загрузилось — оставляем как есть, не роняем весь поиск
        enriched.push(job);
        failed++;
      }
    }

    const done = Math.min(i + BATCH_SIZE, total);
    logger.info(`[Enricher] ${done}/${total} вакансій оброблено (✓${success} ✗${failed})`);

    if (done < total) {
      await sleep(BATCH_DELAY);
    }
  }

  logger.info(`[Enricher] Готово: ${success} збагачено, ${failed} пропущено`);
  return enriched;
}

async function fetchFullText(job) {
  if (!job.url || !job.url.startsWith('http')) return null;

  try {
    const response = await httpClient.get(job.url, {
      timeout: PAGE_TIMEOUT,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uk,en-US;q=0.9,en;q=0.8',
        'Referer': (() => { try { return new URL(job.url).origin + '/'; } catch { return ''; } })(),
      },
    });

    const fullText = extractText(response.data, job.url);
    if (!fullText || fullText.length < 100) return null;

    return {
      description: fullText.slice(0, 3000),
      requirements: extractRequirements(fullText),
      fullTextLoaded: true,
    };
  } catch {
    return null;
  }
}

/**
 * Универсальный экстрактор текста — работает для DOU, Work.ua, Robota.ua, Jooble.
 * Пробует специфичные селекторы для каждого сайта, потом общие.
 */
function extractText(html, url) {
  const $ = cheerio.load(html);

  // Убираем мусор
  $('script, style, noscript, iframe, nav, footer, header, .cookie, .banner, .ad').remove();

  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return ''; }
  })();

  // Специфичные селекторы для каждого сайта
  const siteSelectors = {
    'jobs.dou.ua':   ['.vacancy-section', '.b-typo.vacancy-section', '#job-description', '.b-typo'],
    'www.work.ua':   ['#job-description', '.card-body', 'div[id*="description"]'],
    'work.ua':       ['#job-description', '.card-body', 'div[id*="description"]'],
    'robota.ua':     ['alliance-vacancy-description', '.description', '[class*="vacancy-description"]'],
    'www.robota.ua': ['alliance-vacancy-description', '.description', '[class*="vacancy-description"]'],
    'ua.jooble.org': ['.vacancy_description', '[class*="description"]', 'article'],
    'jooble.org':    ['.vacancy_description', '[class*="description"]', 'article'],
  };

  const selectors = siteSelectors[hostname] || [];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 150) {
      return cleanText(el.text());
    }
  }

  // Общий fallback — ищем самый длинный смысловой блок
  let bestText = '';
  $('div, article, section, main').each((_, el) => {
    const $el = $(el);
    // Пропускаем навигацию и шапки
    if ($el.find('nav, header, ul li').length > 5) return;
    const text = $el.text().trim();
    if (text.length > bestText.length && text.length < 15000) {
      bestText = text;
    }
  });

  return cleanText(bestText);
}

/**
 * Вытаскивает блок с требованиями — ищет секции по ключевым словам.
 */
function extractRequirements(fullText) {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  const reqKeywords = /вимог|требован|requirement|qualification|досвід|experience|must.have|обов.язков/i;
  const stopKeywords = /умови|условия|пропонує|предлагает|benefit|offer|контакт|contact/i;

  let capturing = false;
  const reqLines = [];

  for (const line of lines) {
    if (!capturing && reqKeywords.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (stopKeywords.test(line) && reqLines.length > 2) break;
      if (line.length < 200) reqLines.push(line);
      if (reqLines.length >= 20) break;
    }
  }

  return reqLines.join('\n').trim() || fullText.slice(0, 800);
}

function cleanText(text) {
  return text
    .replace(/\t/g, ' ')
    .replace(/ {3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n')
    .trim();
}
