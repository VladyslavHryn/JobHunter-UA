import React, { useState } from 'react';
import { useJobSearch } from './hooks/useJobSearch';

// Components
import DropZone from './components/DropZone/DropZone';
import SearchPanel from './components/SearchPanel/SearchPanel';
import ResumePreview from './components/ResumePreview/ResumePreview';
import Filters from './components/Filters/Filters';
import JobGrid from './components/JobGrid/JobGrid';
import ProgressBar from './components/ProgressBar/ProgressBar';
import Toast from './components/Toast/Toast';

// Simple theme hook
function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('jh-theme') || 'dark';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jh-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  return { theme, toggleTheme };
}

export default function App() {
  const {
    status,
    resumeData,
    jobs,
    allJobs,
    warnings,
    stats,
    error,
    filters,
    availableCities,
    availableSources,
    handleUpload,
    handleSearch,
    updateFilters,
    setError,
  } = useJobSearch();

  const { theme, toggleTheme } = useTheme();

  // Local state for toast notifications
  const [toast, setToast] = useState({ message: null, type: 'info' });

  // Sync hook errors to toast
  React.useEffect(() => {
    if (error) {
      setToast({ message: error, type: 'error' });
    }
  }, [error]);

  // Show warnings as toasts when search finishes
  React.useEffect(() => {
    if (status === 'done' && warnings.length > 0) {
      setToast({ 
        message: `Пошук завершено, але є проблеми:\n${warnings.join('\n')}`, 
        type: 'warning' 
      });
    } else if (status === 'done') {
      setToast({ message: 'Пошук успішно завершено', type: 'success' });
    }
  }, [status, warnings]);

  const onFileUpload = async (file) => {
    try {
      await handleUpload(file);
      setToast({ message: 'Резюме успішно розпізнано', type: 'success' });
    } catch (err) {
      // Error handled by hook + effect
    }
  };

  const onSearchStart = async (searchParams) => {
    try {
      await handleSearch(searchParams);
    } catch (err) {
      // Error handled by hook + effect
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-header__logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            JobHunter UA
          </h1>
          <p className="app-header__subtitle">
            Завантажте резюме або вкажіть навички вручну.
            Ми знайдемо релевантні вакансії на Work.ua, Robota.ua, DOU та Jooble.
          </p>
        </div>
        
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
        >
          {theme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </header>

      <main className="app-content">
        {/* Upload Section */}
        {status === 'idle' || status === 'uploading' ? (
          <div className="input-options">
            <DropZone 
              onUpload={onFileUpload} 
              isLoading={status === 'uploading'} 
              onError={setError}
            />
            <div className="input-divider">
              <span>АБО</span>
            </div>
          </div>
        ) : null}

        {/* Resume Preview & Search Params */}
        {resumeData && <ResumePreview data={resumeData} />}
        
        <SearchPanel 
          resumeData={resumeData} 
          onSearch={onSearchStart}
          isLoading={status === 'searching'} 
        />

        {/* Loading Progress */}
        <ProgressBar isVisible={status === 'searching'} />

        {/* Results Section */}
        {(status === 'done' || (status === 'searching' && allJobs.length > 0)) && (
          <section className="results-section">
            <Filters 
              availableCities={availableCities}
              availableSources={availableSources}
              currentFilters={filters}
              onFilterChange={updateFilters}
              totalJobs={jobs.length}
            />
            
            {stats && status === 'done' && (
              <div className="stats-bar">
                <span><strong>Показано: {jobs.length}</strong></span>
                <span className="stats-divider">·</span>
                <span>Проаналізовано: {stats.total}</span>
                <span className="stats-divider">·</span>
                {Object.entries(stats.bySource).map(([src, info]) => (
                  <span key={src} className="stats-source">
                    {src}: {info.error ? <span className="stats-error">помилка</span> : info.count}
                  </span>
                ))}
              </div>
            )}

            <JobGrid 
              jobs={jobs} 
              isLoading={status === 'searching'} 
            />
          </section>
        )}
      </main>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => {
          setToast({ message: null, type: 'info' });
          if (toast.type === 'error') setError(null);
        }} 
      />
    </div>
  );
}
