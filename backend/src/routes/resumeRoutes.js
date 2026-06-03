import { Router } from 'express';
import fs from 'fs';
import upload from '../middleware/upload.js';
import { parseResumePdf } from '../modules/resume/resumeParser.js';
import { extractResumeData } from '../modules/resume/resumeExtractor.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/resume/upload
 * Загружает PDF-резюме, парсит и извлекает данные.
 * 
 * Request: multipart/form-data, field "resume" (PDF, max 5MB)
 * Response: { success, resumeData: { jobTitle, skills, experience, level, location } }
 */
router.post('/upload', upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Файл не загружен. Пожалуйста, выберите PDF-файл резюме.',
      });
    }

    logger.info(`Получен файл: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} КБ)`);

    // Parse PDF → raw text
    const rawText = await parseResumePdf(req.file.path);

    // Extract structured data
    const resumeData = extractResumeData(rawText);

    // Clean up the uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch {
      // Ignore cleanup errors
    }

    res.json({
      success: true,
      resumeData,
    });
  } catch (err) {
    // Clean up on error too
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    next(err);
  }
});

export default router;
