const API_BASE = '/api';

/**
 * Загружает PDF-резюме и получает извлечённые данные.
 */
export async function uploadResume(file) {
  const formData = new FormData();
  formData.append('resume', file);

  const response = await fetch(`${API_BASE}/resume/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Ошибка загрузки (HTTP ${response.status})`);
  }

  return data.resumeData;
}

/**
 * Запускает поиск вакансий.
 */
export async function searchJobs(resumeData, overrides = null) {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeData, overrides }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Ошибка поиска (HTTP ${response.status})`);
  }

  return {
    jobs: data.jobs || [],
    warnings: data.warnings || [],
    stats: data.stats || {},
  };
}
