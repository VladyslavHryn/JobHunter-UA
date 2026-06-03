import pdf from 'pdf-parse';
import logger from '../../utils/logger.js';

/**
 * Парсит PDF-файл из буфера в памяти.
 * @param {Buffer} dataBuffer — данные PDF-файла
 * @returns {Promise<string>} — текст резюме
 */
export async function parseResumePdf(dataBuffer) {
  logger.info(`Начинаю парсинг PDF (размер: ${dataBuffer.byteLength} байт)`);

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
    logger.error(`Ошибка парсинга PDF: ${err.message}\nStack: ${err.stack}`);
    throw new Error(`Не удалось прочитать PDF-файл. Ошибка: ${err.message}. Убедитесь, что файл не повреждён.`);
  }
}
