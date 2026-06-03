import logger from '../../utils/logger.js';

// ──────────────────────────────────────────────
// Dictionaries for entity extraction
// ──────────────────────────────────────────────

const TECH_SKILLS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C\\+\\+', 'C', 'Go', 'Golang', 'Rust',
  'PHP', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'R', 'Dart', 'Lua', 'Perl', 'Haskell',
  'Elixir', 'Clojure', 'Objective-C', 'Solidity', 'MATLAB',
  // Frontend
  'React', 'React\\.js', 'ReactJS', 'Angular', 'Vue', 'Vue\\.js', 'VueJS', 'Svelte', 'Next\\.js',
  'NextJS', 'Nuxt', 'Nuxt\\.js', 'Gatsby', 'jQuery', 'Redux', 'MobX', 'Zustand', 'Tailwind',
  'TailwindCSS', 'Bootstrap', 'Material UI', 'MUI', 'Chakra UI', 'Ant Design', 'SASS', 'SCSS',
  'LESS', 'Styled Components', 'CSS Modules', 'Webpack', 'Vite', 'Rollup', 'Babel',
  'HTML', 'HTML5', 'CSS', 'CSS3',
  // Backend
  'Node\\.js', 'NodeJS', 'Express', 'Express\\.js', 'NestJS', 'Nest\\.js', 'Fastify', 'Koa',
  'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'ASP\\.NET', '\\.NET', 'Laravel',
  'Symfony', 'Rails', 'Ruby on Rails', 'Gin', 'Fiber', 'Actix',
  // Databases
  'SQL', 'MySQL', 'PostgreSQL', 'Postgres', 'MongoDB', 'Redis', 'Elasticsearch',
  'SQLite', 'Oracle', 'MS SQL', 'MariaDB', 'Cassandra', 'DynamoDB', 'Firebase',
  'Firestore', 'Supabase', 'Prisma', 'Sequelize', 'TypeORM', 'Mongoose',
  // DevOps / Cloud
  'Docker', 'Kubernetes', 'K8s', 'AWS', 'Azure', 'GCP', 'Google Cloud', 'Terraform',
  'Ansible', 'Jenkins', 'CI/CD', 'GitHub Actions', 'GitLab CI', 'Nginx', 'Apache',
  'Linux', 'Bash', 'Shell', 'PowerShell',
  // Data / AI / ML
  'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn', 'Pandas', 'NumPy', 'Spark',
  'Hadoop', 'Airflow', 'Kafka', 'RabbitMQ', 'Tableau', 'Power BI',
  // Mobile
  'React Native', 'Flutter', 'SwiftUI', 'Xamarin', 'Ionic', 'Cordova',
  // Testing
  'Jest', 'Mocha', 'Cypress', 'Playwright', 'Selenium', 'Puppeteer', 'JUnit',
  'PyTest', 'Vitest', 'Testing Library', 'Storybook',
  // Tools / Other
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Figma',
  'REST', 'RESTful', 'GraphQL', 'gRPC', 'WebSocket', 'OAuth', 'JWT',
  'Microservices', 'Agile', 'Scrum', 'Kanban', 'Design Patterns', 'OOP',
  'Functional Programming', 'Clean Architecture', 'DDD', 'SOLID',
  'API', 'SDK',
];

const UKRAINIAN_CITIES = [
  'Київ', 'Kyiv', 'Kiev',
  'Харків', 'Kharkiv', 'Kharkov',
  'Одеса', 'Odesa', 'Odessa',
  'Дніпро', 'Dnipro',
  'Львів', 'Lviv',
  'Запоріжжя', 'Zaporizhzhia',
  'Вінниця', 'Vinnytsia',
  'Полтава', 'Poltava',
  'Чернігів', 'Chernihiv',
  'Черкаси', 'Cherkasy',
  'Житомир', 'Zhytomyr',
  'Суми', 'Sumy',
  'Рівне', 'Rivne',
  'Миколаїв', 'Mykolaiv',
  'Тернопіль', 'Ternopil',
  'Луцьк', 'Lutsk',
  'Хмельницький', 'Khmelnytskyi',
  'Ужгород', 'Uzhhorod',
  'Івано-Франківськ', 'Ivano-Frankivsk',
  'Кропивницький', 'Kropyvnytskyi',
  'Чернівці', 'Chernivtsi',
];

const REMOTE_KEYWORDS = [
  'remote', 'удалённо', 'удаленно', 'віддалено', 'дистанционно', 'дистанційно',
  'work from home', 'wfh', 'home office',
];

const JOB_TITLE_HEADERS = [
  /(?:desired\s+)?position\s*[:\-—]\s*(.+)/i,
  /(?:желаемая\s+)?(?:должность|позиция)\s*[:\-—]\s*(.+)/i,
  /(?:бажана\s+)?(?:посада|позиція)\s*[:\-—]\s*(.+)/i,
  /(?:job\s+)?title\s*[:\-—]\s*(.+)/i,
  /role\s*[:\-—]\s*(.+)/i,
  /objective\s*[:\-—]\s*(.+)/i,
  /summary\s*[:\-—]\s*(.+)/i,
];

const LEVEL_KEYWORDS = {
  intern: ['intern', 'trainee', 'стажёр', 'стажер', 'стажування', 'internship', 'практикант'],
  junior: ['junior', 'jr', 'джуниор', 'джуніор', 'начинающий', 'початківець'],
  middle: ['middle', 'mid', 'мидл', 'мідл'],
  senior: ['senior', 'sr', 'сеньор', 'сіньйор', 'ведущий', 'провідний'],
  lead: ['lead', 'principal', 'тимлид', 'тімлід', 'team lead', 'tech lead'],
};

// ──────────────────────────────────────────────
// Extraction functions
// ──────────────────────────────────────────────

/**
 * Извлекает желаемую позицию из текста резюме
 */
function extractJobTitle(text) {
  // Try explicit headers first
  for (const pattern of JOB_TITLE_HEADERS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const title = match[1].trim().replace(/[\r\n].*/s, '').trim();
      if (title.length > 2 && title.length < 100) {
        return title;
      }
    }
  }

  // Look for common dev titles in the first few lines
  const firstLines = text.split('\n').slice(0, 15).join(' ');
  const titlePatterns = [
    /\b((?:junior|middle|senior|lead|intern|full[- ]?stack|front[- ]?end|back[- ]?end|devops|qa|software|web|mobile|data|ml|ai|cloud|ui\/ux|product)\s+(?:developer|engineer|architect|designer|analyst|scientist|manager|specialist|розробник|інженер|розробниця))/i,
    /\b((?:frontend|backend|fullstack|devops|qa|sre|ios|android)\s*(?:developer|engineer|dev)?)/i,
    /\b(developer|engineer|розробник|програміст|інженер|тестувальник|дизайнер|аналітик)\b/i,
  ];

  for (const pattern of titlePatterns) {
    const match = firstLines.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Извлекает технические навыки
 */
function extractSkills(text) {
  const found = new Set();
  const normalizedText = text.replace(/\n/g, ' ');

  for (const skill of TECH_SKILLS) {
    // Build case-insensitive word-boundary regex
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Restore intentional regex patterns (like \. for Node.js)
    const regexStr = TECH_SKILLS.includes(skill) ? skill : escapedSkill;

    try {
      const regex = new RegExp(`(?:^|[\\s,;|/()\\[\\]])(?:${regexStr})(?:$|[\\s,;|/()\\[\\]])`, 'i');
      if (regex.test(` ${normalizedText} `)) {
        // Normalize skill name: remove regex escapes
        const cleanSkill = skill
          .replace(/\\\./g, '.')
          .replace(/\\\+/g, '+');
        found.add(cleanSkill);
      }
    } catch {
      // Skip invalid regex patterns
    }
  }

  return Array.from(found);
}

/**
 * Извлекает опыт работы в годах
 */
function extractExperience(text) {
  // Direct statements: "5 years of experience", "опыт работы 3 года"
  const directPatterns = [
    /(\d+)\+?\s*(?:years?|лет|год(?:а|ов)?|рок(?:ів|и|у)?)\s*(?:of\s+)?(?:experience|опыт|досвід)/i,
    /(?:experience|опыт|досвід)\s*[:\-—]?\s*(\d+)\+?\s*(?:years?|лет|год(?:а|ов)?|рок(?:ів|и|у)?)/i,
    /(\d+)\+?\s*(?:years?|лет|год(?:а|ов)?|рок(?:ів|и|у)?)\s*(?:in\s+(?:IT|development|software|tech))/i,
  ];

  for (const pattern of directPatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // Calculate from date ranges: "2020 - 2024", "Jan 2019 - Present"
  const dateRangePattern = /(?:20\d{2}|19\d{2})\s*[-–—]\s*(?:(?:20\d{2}|19\d{2})|(?:present|current|now|по\s*н\.?\s*в\.?|теперішній|дотепер))/gi;
  const ranges = text.match(dateRangePattern);

  if (ranges && ranges.length > 0) {
    let minYear = 9999;
    let maxYear = new Date().getFullYear();

    for (const range of ranges) {
      const years = range.match(/(20\d{2}|19\d{2})/g);
      if (years) {
        for (const y of years) {
          const yr = parseInt(y, 10);
          if (yr < minYear) minYear = yr;
          if (yr > maxYear) maxYear = yr;
        }
      }
      if (/present|current|now|н\.\s*в|теперішній|дотепер/i.test(range)) {
        maxYear = new Date().getFullYear();
      }
    }

    if (minYear < 9999) {
      const experience = maxYear - minYear;
      if (experience >= 0 && experience <= 50) {
        return experience;
      }
    }
  }

  return 0;
}

/**
 * Определяет уровень (Intern/Junior/Middle/Senior/Lead)
 */
function extractLevel(text, experience) {
  const lowerText = text.toLowerCase();

  // Check explicit level mentions (prioritize higher positions of the text)
  const firstPart = lowerText.slice(0, Math.min(lowerText.length, 2000));

  for (const [level, keywords] of Object.entries(LEVEL_KEYWORDS)) {
    for (const kw of keywords) {
      if (firstPart.includes(kw.toLowerCase())) {
        return level.charAt(0).toUpperCase() + level.slice(1);
      }
    }
  }

  // Fallback: infer from experience
  if (experience === 0) return 'Intern';
  if (experience <= 1) return 'Junior';
  if (experience <= 3) return 'Middle';
  if (experience <= 6) return 'Senior';
  return 'Lead';
}

/**
 * Извлекает город или Remote
 */
function extractLocation(text) {
  const lowerText = text.toLowerCase();

  // Check for remote
  for (const kw of REMOTE_KEYWORDS) {
    if (lowerText.includes(kw.toLowerCase())) {
      return 'Remote';
    }
  }

  // Check for Ukrainian cities
  for (const city of UKRAINIAN_CITIES) {
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(text)) {
      // Normalize to the first (Ukrainian) variant
      const index = UKRAINIAN_CITIES.indexOf(city);
      // Find the main name (every 2-3 entries is same city)
      const mainCities = [
        'Київ', 'Харків', 'Одеса', 'Дніпро', 'Львів',
        'Запоріжжя', 'Вінниця', 'Полтава', 'Чернігів', 'Черкаси',
        'Житомир', 'Суми', 'Рівне', 'Миколаїв', 'Тернопіль',
        'Луцьк', 'Хмельницький', 'Ужгород', 'Івано-Франківськ',
        'Кропивницький', 'Чернівці',
      ];
      // Map English names to Ukrainian
      const cityMap = {
        kyiv: 'Київ', kiev: 'Київ',
        kharkiv: 'Харків', kharkov: 'Харків',
        odesa: 'Одеса', odessa: 'Одеса',
        dnipro: 'Дніпро',
        lviv: 'Львів',
        zaporizhzhia: 'Запоріжжя',
        vinnytsia: 'Вінниця',
        poltava: 'Полтава',
        chernihiv: 'Чернігів',
        cherkasy: 'Черкаси',
        zhytomyr: 'Житомир',
        sumy: 'Суми',
        rivne: 'Рівне',
        mykolaiv: 'Миколаїв',
        ternopil: 'Тернопіль',
        lutsk: 'Луцьк',
        khmelnytskyi: 'Хмельницький',
        uzhhorod: 'Ужгород',
        'ivano-frankivsk': 'Івано-Франківськ',
        kropyvnytskyi: 'Кропивницький',
        chernivtsi: 'Чернівці',
      };

      const normalized = cityMap[city.toLowerCase()] || city;
      return normalized;
    }
  }

  return '';
}

// ──────────────────────────────────────────────
// Main extraction pipeline
// ──────────────────────────────────────────────

/**
 * Извлекает структурированные данные из текста резюме.
 * @param {string} rawText — текст, извлечённый из PDF
 * @returns {Object} — структурированные данные резюме
 */
export function extractResumeData(rawText) {
  logger.info('Начинаю извлечение данных из текста резюме...');

  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const experience = extractExperience(text);
  const level = extractLevel(text, experience);
  const skills = extractSkills(text);
  const jobTitle = extractJobTitle(text);
  const location = extractLocation(text);

  const result = {
    jobTitle,
    skills,
    experience,
    level,
    location,
    rawTextPreview: text.slice(0, 500).replace(/\n{3,}/g, '\n\n'),
  };

  logger.info(`Извлечено: позиция="${result.jobTitle}", навыков=${result.skills.length}, ` +
    `опыт=${result.experience} лет, уровень=${result.level}, город=${result.location || 'не указан'}`);

  return result;
}
