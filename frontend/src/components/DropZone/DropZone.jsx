import React, { useCallback, useState } from 'react';
import './DropZone.css';

export default function DropZone({ onUpload, isLoading, onError }) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (isLoading) return;

      const files = Array.from(e.dataTransfer.files);
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf') {
          onUpload(file);
        } else if (onError) {
          onError('Будь ласка, завантажте файл у форматі PDF.');
        }
      }
    },
    [onUpload, isLoading]
  );

  const handleFileInput = useCallback(
    (e) => {
      if (isLoading) return;
      
      const files = Array.from(e.target.files);
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf') {
          onUpload(file);
        } else if (onError) {
          onError('Будь ласка, завантажте файл у форматі PDF.');
        }
      }
    },
    [onUpload, isLoading]
  );

  return (
    <div
      className={`dropzone ${isDragActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="resume-upload"
        accept="application/pdf"
        onChange={handleFileInput}
        disabled={isLoading}
      />
      <label htmlFor="resume-upload" className="dropzone-label">
        <div className="icon">
          {isLoading ? (
            <svg viewBox="0 0 24 24" fill="none" className="spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7 10V9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V10C19.2091 10 21 11.7909 21 14C21 15.4806 20.1956 16.8084 19 17.5M7 10C4.79086 10 3 11.7909 3 14C3 15.4806 3.8044 16.8084 5 17.5M7 10C7.43285 10 7.84965 10.0688 8.24006 10.1959M12 12V21M12 12L15 15M12 12L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <h3>{isLoading ? 'Аналіз резюме...' : 'Завантажте ваше CV'}</h3>
        <p>Перетягніть PDF-файл сюди або натисніть, щоб обрати</p>
        <span className="badge">Тільки PDF (до 5 МБ)</span>
      </label>
    </div>
  );
}
