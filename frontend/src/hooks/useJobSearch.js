import { useState, useCallback, useMemo } from 'react';
import { uploadResume, searchJobs } from '../api/jobApi.js';

/**
 * Custom hook: управление полным циклом поиска вакансий.
 * States: idle → uploading → parsed → searching → done / error
 */
export function useJobSearch() {
  const [status, setStatus] = useState('idle'); // idle | uploading | parsed | searching | done | error
  const [resumeData, setResumeData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    city: '',
    sources: [],
    minScore: 0,
    minSalary: 0,
  });

export function parseMaxSalaryUah(salaryStr) {
  if (!salaryStr) return 0;
  const s = String(salaryStr).toLowerCase().replace(/\s/g, '');
  const matches = s.match(/\d+/g);
  if (!matches) return 0;
  
  let maxNum = Math.max(...matches.map(Number));
  
  let isUSD = s.includes('$') || s.includes('usd') || s.includes('дол');
  if (s.includes('eur') || s.includes('євр') || s.includes('евр') || s.includes('€')) {
      maxNum *= 44;
  } else if (isUSD || (maxNum < 15000 && maxNum > 300)) {
      maxNum *= 41.5;
  }
  return maxNum;
}

function extractCities(locationString) {
  if (!locationString) return [];
  const cities = new Set();
  const parts = locationString.split(/[,/]| та | и | and /i);
  
  for (let part of parts) {
    part = part.replace(/\([^)]*\)/g, '').trim();
    const lower = part.toLowerCase();
    
    if (!part || lower.match(/віддален|remote|удален|дистанц|гібрид|гибрид|за кордоном|abroad|релокейт|relocate|офіс|office|всюди|anywhere|полный день|неполный день/)) {
      continue;
    }

    if (lower.match(/^киев|kiev|kyiv$/)) part = 'Київ';
    else if (lower.match(/^львов|lviv$/)) part = 'Львів';
    else if (lower.match(/^одесса|odesa|odessa$/)) part = 'Одеса';
    else if (lower.match(/^харьков|kharkiv$/)) part = 'Харків';
    else if (lower.match(/^днепр|днєпр|dnipro|dnepropetrovsk$/)) part = 'Дніпро';
    else if (lower.match(/^винница|vinnytsia$/)) part = 'Вінниця';
    else if (lower.match(/^запорожье|zaporizhzhia$/)) part = 'Запоріжжя';
    else if (lower.match(/^николаев|mykolaiv$/)) part = 'Миколаїв';
    else if (lower.match(/^чернигов|chernihiv$/)) part = 'Чернігів';
    else if (lower.match(/^полтава|poltava$/)) part = 'Полтава';
    else if (lower.match(/^херсон|kherson$/)) part = 'Херсон';
    else if (lower.match(/^хмельницкий|khmelnytskyi$/)) part = 'Хмельницький';
    else if (lower.match(/^черкассы|cherkasy$/)) part = 'Черкаси';
    else if (lower.match(/^житомир|zhytomyr$/)) part = 'Житомир';
    else if (lower.match(/^черновцы|chernivtsi$/)) part = 'Чернівці';
    else if (lower.match(/^сумы|sumy$/)) part = 'Суми';
    else if (lower.match(/^ровно|rivne$/)) part = 'Рівне';
    else if (lower.match(/^ивано-франковск|ивано-франківськ|ivano-frankivsk$/)) part = 'Івано-Франківськ';
    else if (lower.match(/^тернополь|ternopil$/)) part = 'Тернопіль';
    else if (lower.match(/^луцк|lutsk$/)) part = 'Луцьк';
    else if (lower.match(/^ужгород|uzhhorod$/)) part = 'Ужгород';
    
    // Capitalize first letter if it's a raw english/ukrainian string
    if (part.length > 0) {
      part = part.charAt(0).toUpperCase() + part.slice(1);
      cities.add(part);
    }
  }
  return Array.from(cities);
}

  /**
   * Шаг 1: Загрузка резюме
   */
  const handleUpload = useCallback(async (file) => {
    try {
      setStatus('uploading');
      setError(null);
      setJobs([]);
      setWarnings([]);
      setStats(null);

      const data = await uploadResume(file);
      setResumeData(data);
      setStatus('parsed');
      return data;
    } catch (err) {
      setError(err.message);
      setStatus('error');
      throw err;
    }
  }, []);

  /**
   * Шаг 2: Запуск поиска
   */
  const handleSearch = useCallback(async (overrides = null) => {
    if (!resumeData && !overrides) {
      setError('Сначала загрузите резюме');
      return;
    }

    try {
      setStatus('searching');
      setError(null);

      const result = await searchJobs(resumeData, overrides);
      setJobs(result.jobs);
      setWarnings(result.warnings);
      setStats(result.stats);
      setStatus('done');
      return result;
    } catch (err) {
      setError(err.message);
      setStatus('error');
      throw err;
    }
  }, [resumeData]);

  /**
   * Клиентская фильтрация (мгновенная, без запросов)
   */
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Filter by city
    if (filters.city) {
      if (filters.city === 'Remote') {
        result = result.filter((j) =>
          (j.location || '').toLowerCase().match(/remote|удален|віддален|дистанц/)
        );
      } else {
        result = result.filter((j) => {
          const jobCities = extractCities(j.location);
          return jobCities.includes(filters.city);
        });
      }
    }

    // Filter by source
    if (filters.sources.length > 0) {
      result = result.filter((j) => filters.sources.includes(j.source));
    }

    // Filter by minimum score
    if (filters.minScore > 0) {
      result = result.filter((j) => (j.score || 0) >= filters.minScore);
    }

    // Filter by minimum salary
    if (filters.minSalary > 0) {
      result = result.filter((j) => parseMaxSalaryUah(j.salary) >= filters.minSalary);
    }

    return result;
  }, [jobs, filters]);

  /**
   * Уникальные города из результатов (для фильтра)
   */
  const availableCities = useMemo(() => {
    const cities = new Set();
    for (const job of jobs) {
      const jobCities = extractCities(job.location);
      for (const c of jobCities) {
        cities.add(c);
      }
    }
    return Array.from(cities).sort();
  }, [jobs]);

  /**
   * Уникальные источники из результатов
   */
  const availableSources = useMemo(() => {
    const sources = new Set();
    for (const job of jobs) {
      if (job.source) {
        sources.add(job.source);
      }
    }
    return Array.from(sources).sort();
  }, [jobs]);

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResumeData(null);
    setJobs([]);
    setWarnings([]);
    setStats(null);
    setError(null);
    setFilters({ city: '', sources: [], minScore: 0, minSalary: 0 });
  }, []);

  return {
    status,
    resumeData,
    setResumeData,
    jobs: filteredJobs,
    allJobs: jobs,
    warnings,
    stats,
    error,
    filters,
    availableCities,
    availableSources,
    handleUpload,
    handleSearch,
    updateFilters,
    reset,
    setError,
  };
}
