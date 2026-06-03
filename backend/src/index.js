import { Hono } from 'hono';
import { cors } from 'hono/cors';
import searchRoutes from './routes/searchRoutes.js';
import resumeRoutes from './routes/resumeRoutes.js';

const app = new Hono();

// Global middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Routes
app.get('/', (c) => c.text('🚀 JobHunter UA Backend is running on Cloudflare Workers!'));
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/search', searchRoutes);
app.route('/api/resume', resumeRoutes);

// Error handling
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500);
});

export default app;
