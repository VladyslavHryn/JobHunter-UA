import React from 'react';
import './ResumePreview.css';

export default function ResumePreview({ data }) {
  if (!data) return null;

  return (
    <div className="resume-preview">
      <div className="resume-header">
        <div className="resume-title-section">
          <span className="label">Знайдена посада</span>
          <h2 className="gradient-text">{data.jobTitle || 'Посада не визначена'}</h2>
        </div>
        
        <div className="resume-meta">
          <div className="meta-item">
            <span className="icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </span>
            <div className="meta-text">
              <span className="label">Рівень</span>
              <span className="value">{data.level}</span>
            </div>
          </div>
          
          <div className="meta-item">
            <span className="icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <div className="meta-text">
              <span className="label">Досвід</span>
              <span className="value">{data.experience} {data.experience === 1 ? 'рік' : 'років'}</span>
            </div>
          </div>
          
          <div className="meta-item">
            <span className="icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div className="meta-text">
              <span className="label">Локація</span>
              <span className="value">{data.location || 'Не вказана'}</span>
            </div>
          </div>
        </div>
      </div>
      
      {data.skills && data.skills.length > 0 && (
        <div className="resume-skills">
          <span className="label">Розпізнані навички ({data.skills.length})</span>
          <div className="skills-list">
            {data.skills.map((skill, i) => (
              <span key={i} className="skill-tag">{skill}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
