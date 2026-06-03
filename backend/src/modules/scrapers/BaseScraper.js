import logger from '../../utils/logger.js';

/**
 * Абстрактный базовый класс для всех скраперов/адаптеров.
 * Для добавления нового источника — наследуйте этот класс и реализуйте search().
 */
export default class BaseScraper {
  constructor(name) {
    this.name = name;
  }

  /**
   * Выполняет поиск вакансий. ОБЯЗАТЕЛЬНО переопределить в наследниках.
   * @param {Object} params
   * @param {string} params.keywords — ключевые слова для поиска
   * @param {string} params.location — город или 'Remote'
   * @param {string} params.level — уровень (Intern/Junior/Middle/Senior)
   * @param {string[]} params.skills — массив навыков
   * @param {number} params.experience — опыт в годах
   * @returns {Promise<Object[]>} — массив нормализованных вакансий
   */
  async search(params) {
    throw new Error(`search() не реализован в адаптере "${this.name}"`);
  }

  /**
   * Нормализует сырые данные вакансии в единый формат.
   */
  normalizeJob(raw) {
    return {
      id: raw.id || `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: (raw.title || '').trim(),
      company: (raw.company || 'Компания не указана').trim(),
      location: (raw.location || '').trim(),
      salary: (raw.salary || '').trim(),
      description: (raw.description || '').trim(),
      url: (raw.url || '').trim(),
      source: this.name,
      logo: raw.logo || '',
      postedAt: raw.postedAt || null,
      requirements: raw.requirements || '',
    };
  }

  /**
   * Безопасный запуск поиска с перехватом ошибок.
   */
  async safeFetch(params) {
    try {
      logger.info(`[${this.name}] Начинаю поиск: keywords="${params.keywords}", location="${params.location}"`);
      const results = await this.search(params);
      logger.info(`[${this.name}] Найдено ${results.length} вакансий`);
      return { source: this.name, jobs: results, error: null };
    } catch (err) {
      logger.error(`[${this.name}] Ошибка: ${err.message}`);
      return { source: this.name, jobs: [], error: err.message };
    }
  }
}
