import './env.js';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb } from './db.js';
import { ADMIN_BOOTSTRAP_EMAIL, promoteIfBootstrapAdmin } from './utils/adminBootstrap.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import postsRoutes from './routes/posts.js';
import searchRoutes from './routes/search.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import supportRoutes from './routes/support.js';

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
app.use('/api/support', supportRoutes);

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

if (ADMIN_BOOTSTRAP_EMAIL) {
  const existing = await db.get('SELECT id, email, role FROM users WHERE email = ?', [ADMIN_BOOTSTRAP_EMAIL]);
  if (existing) {
    if (existing.role !== 'admin') {
      await promoteIfBootstrapAdmin(db, existing);
      console.log(`ADMIN_BOOTSTRAP_EMAIL matched an existing account (${ADMIN_BOOTSTRAP_EMAIL}) — promoted it to admin.`);
    }
  } else {
    console.log(`ADMIN_BOOTSTRAP_EMAIL is set to "${ADMIN_BOOTSTRAP_EMAIL}" — that account will automatically become admin as soon as it signs up.`);
  }
}

app.listen(port, () => {
  console.log(`RoBuzz API listening on http://localhost:${port} (db: ${db.isPostgres ? 'postgres' : 'sqlite'})`);
});
