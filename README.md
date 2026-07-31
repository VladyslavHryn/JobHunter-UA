# JobHunter UA 🚀

Automated job search in Ukraine based on your resume. The application parses the uploaded PDF resume (skills, experience, job title), and then simultaneously searches for the best vacancies across 4 platforms: **Work.ua, Jooble, Robota.ua, and DOU**.

Each found vacancy is scored on a 100-point relevance scale.

🌍 **Live Demo:** https://jobhunter-frontend-fki6.onrender.com/


<img width="1916" height="971" alt="image" src="https://github.com/user-attachments/assets/43c4233e-07f4-43ef-8ec2-1422631f59f2" />

## Features
- 📄 **Smart PDF Parsing** (extracts job title, skills from a 200+ dictionary, and experience using an NLP algorithm).
- 🕷️ **Modular Scraper Architecture**:
  - Jooble (via official REST API)
  - Work.ua (HTML scraping with blockage bypass and User-Agent rotation, or Apify fallback)
  - Robota.ua (Intercepting internal JSON API + fallback to HTML/RSS)
  - DOU (Intercepting XHR requests, processing the `/first-job/` category for Juniors)
- 🎯 **Scoring Engine**: Ranking algorithm based on skill match (45%), job title match (25%), experience (20%), and location (10%), applying penalties for mismatching levels (e.g. Senior vs Intern).

## Project Structure
The project is split into two independent parts:
- `/backend` — Node.js / Express server.
- `/frontend` — React / Vite client.

## Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

*(Optional)*: For Jooble to work, add your `JOOBLE_API_KEY` to the `.env` file (you can get it for free at https://jooble.org/api/about). Without the key, the system will simply skip Jooble and work with the 3 other sites.

Run the server (port 3001 by default):
```bash
npm run dev
```

### 2. Frontend Setup
In another terminal:
```bash
cd frontend
npm install
npm run dev
```

### 3. Usage
1. Open http://localhost:5173
2. Upload your PDF resume.
3. Review and, if necessary, correct the recognized skills.
4. Click "Find jobs".
5. Use result filters by city or platform.

## Architecture (Clean / Adapter Pattern)
Adding a new job site requires creating just one file in `backend/src/modules/scrapers/`, extending `BaseScraper` and implementing the `search()` method.
