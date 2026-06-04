import logger from '../../utils/logger.js';

/**
 * Scoring Engine: calculates relevance percentage (0-100%)
 * of a vacancy relative to resume data.
 *
 * Factors:
 *   - Skills Match (45%) - skills match
 *   - Title Match  (25%) - position match
 *   - Experience   (20%) - experience match
 *   - Location     (10%) - city match
 *
 * Penalties:
 *   - Strict experience requirement with zero resume experience
 *   - Senior level with Intern resume
 */

const WEIGHTS = {
  skills: 0.45,
  title: 0.25,
  experience: 0.20,
  location: 0.10,
};

/**
 * Calculates score for each vacancy.
 * @param {Object[]} jobs - array of vacancies
 * @param {Object} resumeData - data from resume
 * @returns {Object[]} - vacancies with `score` field (0-100), sorted descending
 */
export function scoreAndRankJobs(jobs, resumeData) {
  logger.info(`Начинаю скоринг ${jobs.length} вакансий...`);

  const scoredJobs = jobs.map((job) => {
    const skillsResult = calculateSkillsMatch(job, resumeData);
    const skillsScore = skillsResult.score;
    const titleScore = calculateTitleMatch(job, resumeData);
    const experienceScore = calculateExperienceMatch(job, resumeData);
    const locationScore = calculateLocationMatch(job, resumeData);

    let rawScore =
      skillsScore * WEIGHTS.skills +
      titleScore * WEIGHTS.title +
      experienceScore * WEIGHTS.experience +
      locationScore * WEIGHTS.location;

    // Apply penalties
    const penaltyInfo = calculatePenalty(job, resumeData);
    rawScore *= penaltyInfo.penalty;

    const score = Math.round(Math.max(0, Math.min(100, rawScore)));

    // Generate Pros and Cons
    const pros = [];
    const cons = [];

    if (skillsResult.matched.length > 0) {
      pros.push(`Навички: ${skillsResult.matched.join(', ')}`);
    } else if (resumeData.skills?.length > 0) {
      cons.push('Не знайдено ключових навичок');
    }

    if (experienceScore === 100) {
      pros.push('Підходить по досвіду');
    }

    if (locationScore >= 70) {
      pros.push('Підходить локація');
    } else {
      cons.push('Інша локація');
    }

    if (penaltyInfo.reason) {
      cons.push(penaltyInfo.reason);
    }

    const requiredExperience = extractRequiredExperience(`${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase());

    return { 
      ...job, 
      score,
      matchDetails: {
        pros,
        cons,
        requiredExperience
      }
    };
  });

  // Sort by score descending
  scoredJobs.sort((a, b) => b.score - a.score);

  // Filter out jobs with a score of 0 (hard penalties applied)
  const filteredJobs = scoredJobs.filter((job) => job.score > 0);

  const avgScore = filteredJobs.length > 0
    ? Math.round(filteredJobs.reduce((sum, j) => sum + j.score, 0) / filteredJobs.length)
    : 0;
  logger.info(`Скоринг завершён. Средний score: ${avgScore}%, макс: ${filteredJobs[0]?.score || 0}%`);

  return filteredJobs;
}

/**
 * Skills match: what % of resume skills are mentioned in vacancy description.
 */
function calculateSkillsMatch(job, resumeData) {
  if (!resumeData.skills || resumeData.skills.length === 0) {
    return { score: 50, matched: [] }; // No skills = neutral
  }

  const jobText = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
  let matchedCount = 0;
  const matched = [];

  for (const skill of resumeData.skills) {
    const skillLower = skill.toLowerCase();
    // Handle multi-word skills and variations
    const variations = getSkillVariations(skillLower);

    for (const variant of variations) {
      if (jobText.includes(variant)) {
        matchedCount++;
        matched.push(skill);
        break;
      }
    }
  }

  const ratio = matchedCount / resumeData.skills.length;
  return { score: ratio * 100, matched };
}

/**
 * Position title match.
 */
function calculateTitleMatch(job, resumeData) {
  if (!resumeData.jobTitle) return 40; // No title = low-neutral

  const resumeTitle = resumeData.jobTitle.toLowerCase();
  const jobTitle = job.title.toLowerCase();
  const jobText = `${jobTitle} ${job.description}`.toLowerCase();

  // Exact containment
  if (jobTitle.includes(resumeTitle) || resumeTitle.includes(jobTitle)) {
    return 100;
  }

  // Token overlap
  const resumeTokens = tokenize(resumeTitle);
  const jobTokens = tokenize(jobTitle);

  if (resumeTokens.length === 0 || jobTokens.length === 0) return 30;

  let matchCount = 0;
  for (const token of resumeTokens) {
    if (token.length < 3) continue;
    if (jobTokens.some((jt) => jt.includes(token) || token.includes(jt))) {
      matchCount++;
    }
  }

  const ratio = matchCount / Math.max(resumeTokens.length, 1);
  return ratio * 100;
}

/**
 * Experience match.
 */
function calculateExperienceMatch(job, resumeData) {
  const jobText = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();

  // Extract required experience from vacancy
  const requiredYears = extractRequiredExperience(jobText);

  if (requiredYears === null) return 80; // No requirement = good match

  const resumeYears = resumeData.experience || 0;

  if (resumeYears >= requiredYears) {
    return 100;
  }

  // Proportional score
  if (requiredYears === 0) return 100;
  const ratio = resumeYears / requiredYears;
  return Math.min(100, ratio * 100);
}

/**
 * Location match.
 */
function calculateLocationMatch(job, resumeData) {
  if (!resumeData.location) return 70; // No preference = decent

  const jobLocation = (job.location || '').toLowerCase();
  const resumeLocation = resumeData.location.toLowerCase();

  // Remote matches everything
  if (jobLocation.includes('remote') || jobLocation.includes('удален') ||
      jobLocation.includes('віддален') || jobLocation.includes('дистанц')) {
    return 100;
  }

  if (resumeLocation === 'remote') {
    // User wants remote, job isn't remote
    return jobLocation.includes('remote') ? 100 : 30;
  }

  // City match
  if (jobLocation.includes(resumeLocation) || resumeLocation.includes(jobLocation)) {
    return 100;
  }

  return 40; // Different city
}

/**
 * Penalties for severe mismatches.
 */
function calculatePenalty(job, resumeData) {
  const jobText = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
  let penalty = 1.0;
  let reason = null;


  // Penalty for senior-level requirements when resume is intern/junior
  const levelPenalties = {
    Intern: { senior: 0, lead: 0, middle: 0.2 },
    Junior: { senior: 0, lead: 0, middle: 0.6 },
  };

  if (resumeData.level && levelPenalties[resumeData.level]) {
    const penalties = levelPenalties[resumeData.level];

    if (jobText.match(/\bsenior\b|\bsr\b|\bсеньор\b|\bсіньйор\b|\bведущий\b/)) {
      penalty *= penalties.senior;
      reason = 'Вимагається Senior рівень';
    } else if (jobText.match(/\blead\b|\bprincipal\b|\bтимлид\b|\bтімлід\b|\barchitect\b/)) {
      penalty *= penalties.lead;
      reason = 'Вимагається Lead/Architect рівень';
    } else if (jobText.match(/\bmiddle\b|\bmid\b|\bмидл\b|\bмідл\b/) && resumeData.level === 'Intern') {
      penalty *= penalties.middle;
      reason = 'Вимагається Middle рівень';
    }
  }

  // Penalty for hard experience requirements
  const requiredYears = extractRequiredExperience(jobText);
  const resumeYears = resumeData.experience || 0;

  if (requiredYears !== null && requiredYears > 0 && resumeYears === 0) {
    // Zero experience vs required experience
    if (requiredYears >= 2) {
      penalty = 0; // Strict filter
      reason = `Вимагається ${requiredYears}+ років досвіду`;
    } else {
      penalty *= 0.5;
      reason = `Бажано ${requiredYears}+ років досвіду (у вас 0)`;
    }
  } else if (requiredYears !== null && requiredYears > resumeYears) {
      const gap = requiredYears - resumeYears;
      if (gap >= 3) {
          penalty = 0;
          reason = `Бракує досвіду (потрібно ${requiredYears}, у вас ${resumeYears})`;
      } else if (gap >= 2) {
          penalty *= 0.3;
          reason = `Менше досвіду ніж потрібно (вимагається ${requiredYears}р)`;
      } else {
          penalty *= 0.7;
      }
  }

  return { penalty, reason };
}

/**
 * Extracts required experience from vacancy text.
 */
function extractRequiredExperience(text) {
  const patterns = [
    // Matches "5+ years of commercial experience" or "3+ years of software development experience"
    /(\d+)\+?\s*(?:years?|років|рок(?:ів|и|у)|лет|год(?:а|ов)?)\s*(?:of\s+)?[^.!?\n]{0,60}?(?:experience|досвід|опыт)/i,
    /(?:experience|досвід|опыт)\s*[:\-—]?\s*(\d+)\+?\s*(?:years?|років|лет|год)/i,
    /(?:від|from|от)\s*(\d+)\s*(?:years?|років|лет|год)/i,
    /(\d+)\+\s*(?:years?|років|лет|год)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * String tokenization: splits into words, removes stop words.
 */
function tokenize(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'junior', 'middle', 'senior', 'lead', 'intern', 'trainee',
    'developer', 'engineer', 'розробник', 'інженер',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));
}

/**
 * Skill name variations for fuzzy matching.
 */
function getSkillVariations(skill) {
  const variations = [skill];

  const variantMap = {
    'javascript': ['js', 'javascript', 'ecmascript'],
    'typescript': ['ts', 'typescript'],
    'react': ['react', 'reactjs', 'react.js'],
    'vue': ['vue', 'vuejs', 'vue.js'],
    'angular': ['angular', 'angularjs'],
    'node.js': ['node', 'nodejs', 'node.js'],
    'next.js': ['next', 'nextjs', 'next.js'],
    'express': ['express', 'expressjs', 'express.js'],
    'c#': ['c#', 'csharp', 'c sharp'],
    'c++': ['c++', 'cpp'],
    '.net': ['.net', 'dotnet', 'dot net'],
    'postgresql': ['postgresql', 'postgres', 'psql'],
    'mongodb': ['mongodb', 'mongo'],
    'docker': ['docker', 'контейнер'],
    'kubernetes': ['kubernetes', 'k8s'],
    'css': ['css', 'css3'],
    'html': ['html', 'html5'],
    'python': ['python', 'py'],
    'golang': ['golang', 'go lang'],
    'react native': ['react native', 'react-native'],
  };

  const mapped = variantMap[skill];
  if (mapped) {
    variations.push(...mapped);
  }

  return [...new Set(variations)];
}
