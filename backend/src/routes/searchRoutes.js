import { Router } from 'express';
import ScraperOrchestrator from '../modules/scrapers/ScraperOrchestrator.js';
import { scoreAndRankJobs } from '../modules/matching/scoringEngine.js';
import { enrichTopJobs } from '../modules/scrapers/descriptionEnricher.js';
import logger from '../utils/logger.js';

const router = Router();
const orchestrator = new ScraperOrchestrator();

/**
 * POST /api/search
 * Запускает поиск вакансий по данным из резюме.
 *
 * Архитектура:
 *  1. Собираем все вакансии со списков (быстро)
 *  2. Быстрый предварительный скоринг по краткому описанию
 *  3. Берём топ-50 и докачиваем полные страницы (батчами по 5, с паузой)
 *  4. Финальный скоринг с полным текстом (включая требования к опыту)
 *  5. Остаток вакансий идёт в конец со своим предварительным скором
 */
router.post('/', async (req, res, next) => {
  try {
    const resumeData = req.body.resumeData || {};
    const overrides = req.body.overrides || {};

    // Явный опыт из UI-поля имеет приоритет над данными резюме
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
      return res.status(400).json({
        success: false,
        error: 'Не вдалось визначити ключові слова для пошуку. Вкажіть посаду або навички вручну.',
      });
    }

    logger.info('Запуск пошуку вакансій...');

    // Шаг 1: Собираем все вакансии со списков
    const { jobs, warnings, stats } = await orchestrator.searchAll(searchParams);

    // Шаг 2: Быстрый предварительный скоринг по краткому описанию
    const resumeContext = {
      ...resumeData,
      experience: userExperience,
      jobTitle: searchParams.keywords,
    };
    const preRanked = scoreAndRankJobs(jobs, resumeContext);

    // Шаг 3: Берём топ-15 и докачиваем полные описания (зменшено для швидкості)
    const TOP_N = 15;
    const topJobs  = preRanked.slice(0, TOP_N);
    const restJobs = preRanked.slice(TOP_N);

    logger.info(`Докачую повні описи для топ-${topJobs.length} вакансій...`);
    const enrichedTop = await enrichTopJobs(topJobs);

    // Шаг 4: Финальный скоринг с полным текстом
    const finalTopRanked = scoreAndRankJobs(enrichedTop, resumeContext);

    const finalRanked = [
      ...finalTopRanked,
      ...restJobs,
    ];

    logger.info(`Пошук завершено. Відправляю ${finalRanked.length} вакансій клієнту.`);

    res.json({ success: true, jobs: finalRanked, warnings, stats });
  } catch (err) {
    next(err);
  }
});

export default router;
