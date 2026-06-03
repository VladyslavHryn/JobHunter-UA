import React, { useState, useEffect } from 'react';
import './SearchPanel.css';

export default function SearchPanel({ resumeData, onSearch, isLoading }) {
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [experience, setExperience] = useState(0);

  useEffect(() => {
    if (resumeData) {
      setJobTitle(resumeData.jobTitle || '');
      setLocation(resumeData.location || '');
      setSkills(resumeData.skills || []);
      setExperience(resumeData.experience || 0);
    }
  }, [resumeData]);


  const handleAddSkill = (e) => {
    if (e.key === 'Enter' && newSkill.trim()) {
      e.preventDefault();
      if (!skills.includes(newSkill.trim())) {
        setSkills([...skills, newSkill.trim()]);
      }
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleStartSearch = () => {
    onSearch({
      keywords: jobTitle,
      location,
      skills,
      experience,
    });
  };

  return (
    <div className="search-panel glass">
      <h2 className="search-panel-title">
        {resumeData ? 'Перевірте та налаштуйте параметри пошуку' : 'Введіть параметри для пошуку'}
      </h2>
      
      <div className="search-form">
        <div className="form-group">
          <label>Посада (ключові слова)</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Наприклад: React Developer"
            className="input-field"
          />
        </div>
        
        <div className="form-group">
          <label>Місто (або Remote)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Київ, Lviv, Remote..."
            className="input-field"
          />
        </div>
        
        <div className="form-group full-width">
          <label>Навички (впливають на скоринг)</label>
          <div className="skills-container">
            {skills.map((skill, idx) => (
              <span key={idx} className="skill-chip">
                {skill}
                <button onClick={() => handleRemoveSkill(skill)} type="button">×</button>
              </span>
            ))}
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={handleAddSkill}
              placeholder="Додати навичку (Enter)"
              className="skill-input"
            />
          </div>
        </div>
        
        <div className="form-group full-width">
          <label>Досвід роботи (років)</label>
          <input
            type="number"
            min="0"
            max="50"
            value={experience}
            onChange={(e) => setExperience(Number(e.target.value))}
            className="input-field"
            style={{ maxWidth: '150px' }}
          />
        </div>
      </div>

      <button 
        className={`search-btn ${isLoading ? 'loading' : ''}`}
        onClick={handleStartSearch}
        disabled={isLoading || (!jobTitle && skills.length === 0)}
      >
        <span className="btn-text">
          {isLoading ? 'Шукаємо вакансії...' : 'Знайти вакансії'}
        </span>
        <div className="btn-glow"></div>
      </button>
    </div>
  );
}
