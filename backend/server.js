const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config();
const apiRoutes = require('./routes/api');
const { createPool } = require('./db');
const { runMigrations } = require('./migrate');

const app = express();
const port = Number(process.env.PORT) || 5000;
const appRoot = path.resolve(__dirname, '..');
app.disable('x-powered-by');
// Render terminates TLS and forwards the client address in X-Forwarded-For.
app.set('trust proxy', process.env.TRUST_PROXY_HOPS === undefined ? 1 : Number(process.env.TRUST_PROXY_HOPS));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map((item) => item.trim().replace(/\/$/, '')) : ['http://localhost:5173', 'https://new-doctors-appointment-lw1hfg7og-devaharsha119-3699.vercel.app'], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const frontendDist = path.join(appRoot, 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false, fallthrough: true }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
}
app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ message: 'Invalid JSON body' });
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Uploaded file exceeds the configured size limit' });
  if (error?.name === 'MulterError') return res.status(400).json({ message: 'Invalid file upload' });
  console.error('Unhandled request error:', error?.message || error);
  return res.status(500).json({ message: 'The request could not be completed' });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  const pool = createPool();
  await pool.query('SELECT 1');
  await runMigrations(pool);
  app.locals.pool = pool;
  const server = app.listen(port, () => console.log(`Server listening on port ${port}`));
  const shutdown = async () => { server.close(); await pool.end(); process.exit(0); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { server, pool };
}

if (require.main === module) start().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exitCode = 1;
});

module.exports = { app, start };
