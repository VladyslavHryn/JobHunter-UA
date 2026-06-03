import React from 'react';
import './Filters.css';

export default function Filters({
  availableCities,
  availableSources,
  currentFilters,
  onFilterChange,
  totalJobs
}) {
  const handleCityChange = (e) => {
    onFilterChange({ city: e.target.value });
  };

  const handleSourceToggle = (source) => {
    const newSources = currentFilters.sources.includes(source)
      ? currentFilters.sources.filter((s) => s !== source)
      : [...currentFilters.sources, source];
    onFilterChange({ sources: newSources });
  };

  const handleScoreChange = (e) => {
    onFilterChange({ minScore: parseInt(e.target.value, 10) });
  };

  return (
    <div className="filters-panel">
      <div className="filters-header">
        <h3>Фільтри та сортування</h3>
      </div>

      <div className="filters-controls">
        <div className="filter-group">
          <label>Локація</label>
          <select 
            className="filter-select" 
            value={currentFilters.city} 
            onChange={handleCityChange}
          >
            <option value="">Всі міста</option>
            <option value="Remote">Тільки Remote</option>
            {availableCities.filter(c => c && c !== 'Remote').map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="filter-group flex-2">
          <label>Джерела (показати тільки обрані)</label>
          <div className="source-toggles">
            {['Work.ua', 'Robota.ua', 'DOU', 'Jooble'].map((src) => {
              const isAvailable = availableSources.includes(src);
              const isActive = currentFilters.sources.includes(src);
              
              return (
                <button
                  key={src}
                  className={`source-toggle ${isActive ? 'active' : ''} ${!isAvailable ? 'disabled' : ''}`}
                  onClick={() => isAvailable && handleSourceToggle(src)}
                  disabled={!isAvailable}
                  type="button"
                >
                  {src}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-group">
          <label>Точність співпадіння</label>
          <select
            className="filter-select"
            value={currentFilters.minScore}
            onChange={handleScoreChange}
          >
            <option value="0">Будь-яка</option>
            <option value="30">Хороше (30%+)</option>
            <option value="60">Відмінне (60%+)</option>
            <option value="80">Ідеальне (80%+)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
