import React, { useState, useEffect } from 'react';
import './ProgressBar.css';

export default function ProgressBar({ isVisible }) {
  const [step, setStep] = useState(0);

  const steps = [
    'Ініціалізація скраперів...',
    'Пошук на Work.ua...',
    'Аналіз Robota.ua...',
    'Перевірка вакансій DOU...',
    'Отримання даних Jooble API...',
    'Обчислення релевантності...',
    'Майже готово...'
  ];

  useEffect(() => {
    if (!isVisible) {
      setStep(0);
      return;
    }

    // Simulate progress steps (the actual backend request takes ~5-15s)
    const interval = setInterval(() => {
      setStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible, steps.length]);

  if (!isVisible) return null;

  const progressPercentage = Math.min(((step + 1) / steps.length) * 100, 95);

  return (
    <div className="progress-container glass">
      <div className="progress-text-wrapper">
        <span className="progress-step-text">{steps[step]}</span>
        <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
      </div>
      <div className="progress-bar-bg">
        <div 
          className="progress-bar-fill gradient-border"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
    </div>
  );
}
