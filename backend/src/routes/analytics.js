const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/analytics/streaks
router.get('/streaks', async (req, res) => {
  try {
    const logs = await prisma.dayLog.findMany({
      where: { userId: req.userId, score: { gt: 0 } },
      orderBy: { date: 'asc' }
    });

    if (logs.length === 0) return res.json({ current: 0, longest: 0, thisMonth: 0, totalDays: 0 });

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const activeDates = new Set(logs.map(l => l.date));

    // Current streak — count backwards from today or yesterday
    let current = 0;
    let checkDate = new Date();
    if (!activeDates.has(today)) checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      const k = checkDate.toISOString().slice(0, 10);
      if (activeDates.has(k)) { current++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }

    // Longest streak
    let longest = 0, run = 0, prevDate = null;
    [...activeDates].sort().forEach(d => {
      if (prevDate) {
        const diff = Math.round((new Date(d) - new Date(prevDate)) / 86400000);
        run = diff === 1 ? run + 1 : 1;
      } else { run = 1; }
      if (run > longest) longest = run;
      prevDate = d;
    });
    if (current > longest) longest = current;

    // This month
    const thisMonth = today.slice(0, 7);
    const thisMonthDays = [...activeDates].filter(d => d.startsWith(thisMonth)).length;

    res.json({ current, longest, thisMonth: thisMonthDays, totalDays: activeDates.size });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/history?days=90
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const logs = await prisma.dayLog.findMany({
      where: { userId: req.userId, date: { gte: since } },
      orderBy: { date: 'asc' }
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/summary
router.get('/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const month = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [todayLog, weekLogs, monthLogs, allLogs] = await Promise.all([
      prisma.dayLog.findUnique({ where: { userId_date: { userId: req.userId, date: today } } }),
      prisma.dayLog.findMany({ where: { userId: req.userId, date: { gte: week }, score: { gt: 0 } } }),
      prisma.dayLog.findMany({ where: { userId: req.userId, date: { gte: month }, score: { gt: 0 } } }),
      prisma.dayLog.findMany({ where: { userId: req.userId, score: { gt: 0 } }, orderBy: { score: 'desc' }, take: 1 }),
    ]);

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b.score, 0) / arr.length) : 0;

    res.json({
      today: todayLog?.score || 0,
      weekAvg: avg(weekLogs),
      monthAvg: avg(monthLogs),
      bestScore: allLogs[0]?.score || 0,
      bestDate: allLogs[0]?.date || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
