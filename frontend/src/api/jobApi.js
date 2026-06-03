const envUrl = import.meta.env.VITE_API_URL || '/api';
const API_BASE = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Устанавливаем локальный воркер, собранный Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Загружает PDF-резюме, парсит его на фронтенде и отправляет текст на бэкенд для извлечения данных.
 */
export async function uploadResume(file) {
  let rawText = '';
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      rawText += pageText + '\n';
    }
  } catch (error) {
    console.error('PDF JS Error:', error);
    throw new Error(`Не удалось прочитать PDF-файл. Ошибка: ${error.message || error}. Убедитесь, что файл не повреждён.`);
  }

  if (!rawText.trim()) {
    throw new Error('Не удалось извлечь текст из PDF. Возможно, файл содержит только изображения (скан).');
  }

  const response = await fetch(`${API_BASE}/resume/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText }),
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
