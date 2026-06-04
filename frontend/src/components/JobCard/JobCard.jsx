import React, { useState } from 'react';
import './JobCard.css';

export default function JobCard({ job }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongDescription = job.description && job.description.length > 250;
  // Score color calculation
  const getScoreClass = (score) => {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  // Source badge color
  const getSourceClass = (source) => {
    return `source-${source.toLowerCase().replace('.', '')}`;
  };

  // Generate an avatar if no logo
  const initial = job.company ? job.company.charAt(0).toUpperCase() : '?';

  // Format ISO dates to readable strings (e.g. 26 May 2026)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Fallback if already formatted
    const months = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div className="company-logo">
          {job.logo ? (
            <img src={job.logo} alt={`Логотип компанії ${job.company || 'невідомо'}`} />
          ) : (
            <div className="company-initial">{initial}</div>
          )}
        </div>
        
        <div className="job-info-main">
          <h3 className="job-title">
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              {job.title}
            </a>
          </h3>
          <div className="company-name">{job.company}</div>
        </div>
        
        <div className="job-source-badge">
          <span className={`badge ${getSourceClass(job.source)}`}>
            {job.source}
          </span>
        </div>
      </div>

      <div className="job-meta">
        {job.salary && (
          <div className="meta-pill salary-pill highlight">
            <span className="icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
            </span>
            {job.salary}
          </div>
        )}
        {job.location && (
          <div className="meta-pill">
            <span className="icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            {job.location}
          </div>
        )}
        {job.postedAt && (
          <div className="meta-pill date-pill">
            <span className="icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            {formatDate(job.postedAt)}
          </div>
        )}
      </div>

      <div className={`job-description ${isExpanded ? 'expanded' : ''}`}>
        {job.description}
      </div>
      
      {isLongDescription && (
        <button 
          className="toggle-desc-btn" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Згорнути опис' : 'Читати повністю'}
        </button>
      )}

      {job.matchDetails && (
        <div className="job-match-details">
          {job.matchDetails.requiredExperience !== null && (
            <div className="experience-req">
              <strong>Досвід:</strong> {job.matchDetails.requiredExperience > 0 ? `від ${job.matchDetails.requiredExperience} років` : 'Без досвіду'}
            </div>
          )}
          
          {job.matchDetails.pros.length > 0 && (
            <ul className="match-pros">
              {job.matchDetails.pros.map((pro, i) => (
                <li key={i}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', display: 'inline-block', verticalAlign: 'middle'}}><path d="M20 6L9 17l-5-5"/></svg>
                  {pro}
                </li>
              ))}
            </ul>
          )}
          
          {job.matchDetails.cons.length > 0 && (
            <ul className="match-cons">
              {job.matchDetails.cons.map((con, i) => (
                <li key={i}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', display: 'inline-block', verticalAlign: 'middle'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {con}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="job-card-footer">
        <a 
          href={job.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="apply-btn"
        >
          Відгукнутися
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: '6px', marginBottom: '-2px'}}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    </div>
  );
}
