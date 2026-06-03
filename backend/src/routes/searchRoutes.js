import { Hono } from 'hono';
import ScraperOrchestrator from '../modules/scrapers/ScraperOrchestrator.js';
import { scoreAndRankJobs } from '../modules/matching/scoringEngine.js';
import { enrichTopJobs } from '../modules/scrapers/descriptionEnricher.js';
import logger from '../utils/logger.js';

const router = new Hono();
const orchestrator = new ScraperOrchestrator();

/**
 * POST /api/search
 * Запускает поиск вакансий по данным из резюме.
 */
router.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const resumeData = body.resumeData || {};
    const overrides = body.overrides || {};

    const userExperience = overrides?.experience !== undefined
      ? Number(overrides.experience)
      : (resumeData.experience || 0);

    let baseKeywords = overrides?.keywords || resumeData.jobTitle || '';
    if (!baseKeywords && (overrides?.skills || resumeData.skills)?.length > 0) {
      baseKeywords = (overrides?.skills || resumeData.skills).slice(0, 3).join(' ');
    }

    let autoLevel = 'Junior';
    let keywordModifier = '';

    if (userExperience <= 1) {
      autoLevel = 'Junior';
      if (baseKeywords && !/(junior|intern|trainee|джун|стажер)/i.test(baseKeywords)) {
        keywordModifier = 'Junior ';
      }
    } else if (userExperience >= 2 && userExperience <= 3) {
      autoLevel = 'Middle';
      if (baseKeywords && !/(middle|мидл|мідл)/i.test(baseKeywords)) {
        keywordModifier = 'Middle ';
      }
    } else if (userExperience >= 4) {
      autoLevel = 'Senior';
      if (baseKeywords && !/(senior|lead|сеньйор|сеньор)/i.test(baseKeywords)) {
        keywordModifier = 'Senior ';
      }
    }

    const searchParams = {
      keywords: (keywordModifier + baseKeywords).trim(),
      skills:   overrides?.skills   || resumeData.skills   || [],
      location: overrides?.location || resumeData.location || '',
      level:    autoLevel,
      experience: userExperience,
    };

    if (!searchParams.keywords) {
      return c.json({
        success: false,
        error: 'Не вдалось визначити ключові слова для пошуку. Вкажіть посаду або навички вручну.',
      }, 400);
    }

    logger.info('Запуск пошуку вакансій...');

    const { jobs, warnings, stats } = await orchestrator.searchAll(searchParams);

    const resumeContext = {
      ...resumeData,
      experience: userExperience,
      jobTitle: searchParams.keywords,
    };
    const preRanked = scoreAndRankJobs(jobs, resumeContext);

    const TOP_N = 15;
    const topJobs  = preRanked.slice(0, TOP_N);
    const restJobs = preRanked.slice(TOP_N);

    logger.info(`Докачую повні описи для топ-${topJobs.length} вакансій...`);
    const enrichedTop = await enrichTopJobs(topJobs);

    const finalTopRanked = scoreAndRankJobs(enrichedTop, resumeContext);

    const finalRanked = [
      ...finalTopRanked,
      ...restJobs,
    ];

    logger.info(`Пошук завершено. Відправляю ${finalRanked.length} вакансій клієнту.`);

    return c.json({ success: true, jobs: finalRanked, warnings, stats });
  } catch (err) {
    logger.error(`Search error: ${err.message}`);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default router;
