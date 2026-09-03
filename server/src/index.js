import './env.js';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb } from './db.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import postsRoutes from './routes/posts.js';
import searchRoutes from './routes/search.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    await db.get('SELECT 1 as ok');
    res.json({ ok: true, db: db.isPostgres ? 'postgres' : 'sqlite' });
  } catch (err) {
    console.error('[health] database check failed:', err);
    res.status(500).json({ ok: false, error: 'Database is not reachable.' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const port = process.env.PORT || 3001;

try {
  await initDb();
} catch (err) {
  console.error('Failed to set up the database — check DATABASE_URL. Shutting down.');
  console.error(err);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`BlockFeed API listening on http://localhost:${port} (db: ${db.isPostgres ? 'postgres' : 'sqlite'})`);
});
