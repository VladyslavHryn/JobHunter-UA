import React from 'react';
import JobCard from '../JobCard/JobCard.jsx';
import './JobGrid.css';

export default function JobGrid({ jobs, isLoading }) {
  if (isLoading) {
    // Skeleton loading state
    return (
      <div className="job-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="job-card-skeleton">
            <div className="skeleton-header">
              <div className="skeleton-logo shimmer-bg"></div>
              <div className="skeleton-title-group">
                <div className="skeleton-title shimmer-bg"></div>
                <div className="skeleton-company shimmer-bg"></div>
              </div>
            </div>
            <div className="skeleton-meta">
              <div className="skeleton-pill shimmer-bg"></div>
              <div className="skeleton-pill shimmer-bg"></div>
            </div>
            <div className="skeleton-desc">
              <div className="skeleton-line shimmer-bg"></div>
              <div className="skeleton-line shimmer-bg"></div>
              <div className="skeleton-line w-70 shimmer-bg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <h3>Вакансій не знайдено</h3>
        <p>Спробуйте змінити фільтри або ключові слова для пошуку.</p>
      </div>
    );
  }

  return (
    <div className="job-grid">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
