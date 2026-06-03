import { Hono } from 'hono';
import { parseResumePdf } from '../modules/resume/resumeParser.js';
import { extractResumeData } from '../modules/resume/resumeExtractor.js';
import logger from '../utils/logger.js';

const router = new Hono();

/**
 * POST /api/resume/upload
 * Загружает PDF-резюме, парсит и извлекает данные (in-memory).
 * 
 * Request: multipart/form-data, field "resume" (PDF, max 5MB)
 * Response: { success, resumeData: { jobTitle, skills, experience, level, location } }
 */
router.post('/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['resume'];

    if (!file || typeof file === 'string') {
      return c.json({
        success: false,
        error: 'Файл не загружен. Пожалуйста, выберите PDF-файл резюме.',
      }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({
        success: false,
        error: 'Файл слишком большой. Максимальный размер: 5 МБ.',
      }, 400);
    }

    logger.info(`Получен файл: ${file.name} (${(file.size / 1024).toFixed(1)} КБ)`);

    // Parse PDF → raw text in-memory
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rawText = await parseResumePdf(buffer);

    // Extract structured data
    const resumeData = extractResumeData(rawText);

    return c.json({
      success: true,
      resumeData,
    });
  } catch (err) {
    logger.error(`Upload error: ${err.message}`);
    return c.json({
      success: false,
      error: err.message || 'Ошибка обработки файла.',
    }, 500);
  }
});


/**
 * POST /api/resume/extract
 * Извлекает данные из сырого текста резюме.
 * 
 * Request: application/json, { rawText: string }
 * Response: { success, resumeData: { jobTitle, skills, experience, level, location } }
 */
router.post('/extract', async (c) => {
  try {
    const body = await c.req.json();
    const { rawText } = body;

    if (!rawText || typeof rawText !== 'string') {
      return c.json({
        success: false,
        error: 'Отсутствует текст резюме.',
      }, 400);
    }

    logger.info(`Получен текст резюме (${rawText.length} символов)`);

    // Extract structured data
    const resumeData = extractResumeData(rawText);

    return c.json({
      success: true,
      resumeData,
    });
  } catch (err) {
    logger.error(`Extract error: ${err.message}`);
    return c.json({
      success: false,
      error: err.message || 'Ошибка обработки текста резюме.',
    }, 500);
  }
});

export default router;
