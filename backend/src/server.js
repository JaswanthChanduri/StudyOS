require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
const prisma = require('./prisma');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── STATIC FILES ─────────────────────────────────────────────────────────────
// Serve desktop frontend from /frontend-desktop
app.use('/desktop', express.static(path.join(__dirname, '../../frontend-desktop')));
// Serve mobile frontend from /frontend-mobile
app.use('/mobile', express.static(path.join(__dirname, '../../frontend-mobile')));
// Default root → desktop
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend-desktop/index.html'));
});

// ─── HEALTH CHECK (used by Electron to detect server ready) ──────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/tasks',     require('./routes/tasks'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/notes',     require('./routes/notes'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/roadmap',   require('./routes/roadmap'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/ai',        require('./routes/ai'));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', time: new Date().toISOString() });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
  res.status(404).send('Not found');
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── CRON: fire due reminders every minute ────────────────────────────────────
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 61000);
    const due = await prisma.reminder.findMany({
      where: { isActive: true, isFired: false, remindAt: { gte: now, lte: soon } }
    });
    for (const r of due) {
      // mark as fired — frontend polls /api/reminders/due to pick these up
      await prisma.reminder.update({ where: { id: r.id }, data: { isFired: true } });

      // If repeat, schedule next occurrence
      if (r.repeatType === 'daily') {
        const next = new Date(r.remindAt);
        next.setDate(next.getDate() + 1);
        await prisma.reminder.create({
          data: { userId: r.userId, title: r.title, description: r.description, remindAt: next, repeatType: 'daily' }
        });
      } else if (r.repeatType === 'weekly') {
        const next = new Date(r.remindAt);
        next.setDate(next.getDate() + 7);
        await prisma.reminder.create({
          data: { userId: r.userId, title: r.title, description: r.description, remindAt: next, repeatType: 'weekly' }
        });
      }
    }
  } catch (err) {
    console.error('Cron error:', err.message);
  }
});

// ─── CRON: auto-close yesterday's day at midnight ────────────────────────────
cron.schedule('0 0 * * *', async () => {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const existing = await prisma.dayLog.findUnique({
        where: { userId_date: { userId: user.id, date: yesterday } }
      });
      if (!existing) {
        // No activity yesterday — mark as missed
        await prisma.dayLog.create({
          data: { userId: user.id, date: yesterday, score: 0, status: 'missed' }
        });
      }
    }
  } catch (err) {
    console.error('Midnight cron error:', err.message);
  }
});

// ─── START ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    app.listen(PORT, () => {
      console.log(`\n🚀 StudyOS Server running at http://localhost:${PORT}`);
      console.log(`   Desktop app:  http://localhost:${PORT}/desktop`);
      console.log(`   Mobile app:   http://localhost:${PORT}/mobile`);
      console.log(`   API:          http://localhost:${PORT}/api`);
      console.log(`   Health:       http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
