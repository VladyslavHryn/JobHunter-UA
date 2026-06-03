import fs from 'fs';
import pdf from 'pdf-parse';
import logger from '../../utils/logger.js';

/**
 * Парсит PDF-файл и извлекает текстовое содержимое.
 * @param {string} filePath — путь к PDF-файлу
 * @returns {Promise<string>} — текст резюме
 */
export async function parseResumePdf(filePath) {
  logger.info(`Начинаю парсинг PDF: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Файл не найден: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);

  if (dataBuffer.length === 0) {
    throw new Error('Загруженный файл пуст');
  }

  try {
    const data = await pdf(dataBuffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error(
        'Не удалось извлечь текст из PDF. Возможно, файл содержит только изображения (скан). Попробуйте загрузить текстовый PDF.'
      );
    }

    logger.info(
      `Резюме успешно распарсено: ${data.numpages} страниц(ы), ${data.text.length} символов`
    );

    return data.text;
  } catch (err) {
    if (err.message.includes('изображения') || err.message.includes('пуст')) {
      throw err;
    }
    logger.error(`Ошибка парсинга PDF: ${err.message}`);
    throw new Error('Не удалось прочитать PDF-файл. Убедитесь, что файл не повреждён.');
  }
}
