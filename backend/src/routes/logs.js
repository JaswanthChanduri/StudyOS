'use strict';
const express = require('express');
const router  = express.Router();
const prisma  = require('../prisma');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// GET or create today's day log
router.get('/today', async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const date = todayStr();
    let dayLog = await prisma.dayLog.findUnique({ where: { date },
      include: { taskLogs: { include: { task: true } } }
    });
    if (!dayLog) {
      dayLog = await prisma.dayLog.create({
        data: { userId, date },
        include: { taskLogs: { include: { task: true } } }
      });
    }
    res.json(dayLog);
  } catch(e) { next(e); }
});

// GET task log for today for a specific task
router.get('/tasklog', async (req, res, next) => {
  try {
    const { taskId, date } = req.query;
    const d = date || todayStr();
    let log = await prisma.taskLog.findUnique({ where: { taskId_date: { taskId, date: d } } });
    if (!log) {
      log = await prisma.taskLog.create({ data: { taskId, date: d } });
    }
    res.json(log);
  } catch(e) { next(e); }
});

// PATCH update task log (status, elapsed, notes, earnedPts etc)
router.patch('/tasklog/:id', async (req, res, next) => {
  try {
    const { status, quality, earnedPts, elapsedSecs, notes, startedAt, completedAt } = req.body;
    const log = await prisma.taskLog.update({
      where: { id: req.params.id },
      data: { status, quality, earnedPts, elapsedSecs, notes, startedAt, completedAt }
    });
    // recalc day totals
    await recalcDayLog(log.date);
    res.json(log);
  } catch(e) { next(e); }
});

// POST save journal/reflection to day log
router.patch('/daylog/:date/journal', async (req, res, next) => {
  try {
    const { reflection, wins, mistakes, tomorrowGoal, moodRating, energyRating, focusRating } = req.body;
    const log = await prisma.dayLog.update({
      where: { date: req.params.date },
      data: { reflection, wins, mistakes, tomorrowGoal, moodRating, energyRating, focusRating }
    });
    res.json(log);
  } catch(e) { next(e); }
});

// GET history - last N days
router.get('/history', async (req, res, next) => {
  try {
    const { userId, days = 180 } = req.query;
    const logs = await prisma.dayLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: parseInt(days),
      select: { date:true, totalScore:true, tasksDone:true, tasksTotal:true,
                studySecs:true, status:true, moodRating:true }
    });
    res.json(logs);
  } catch(e) { next(e); }
});

// GET streak data
router.get('/streak', async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const logs = await prisma.dayLog.findMany({
      where: { userId, status: { in: ['done','partial'] } },
      orderBy: { date: 'desc' },
      select: { date: true, totalScore: true }
    });
    const activeDates = new Set(logs.map(l => l.date));
    const today = todayStr();
    const yesterday = (() => {
      const d = new Date(); d.setDate(d.getDate()-1);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();

    // current streak
    let current = 0;
    let check = new Date();
    if (!activeDates.has(today)) check.setDate(check.getDate()-1);
    for (let i = 0; i < 400; i++) {
      const k = `${check.getFullYear()}-${String(check.getMonth()+1).padStart(2,'0')}-${String(check.getDate()).padStart(2,'0')}`;
      if (activeDates.has(k)) { current++; check.setDate(check.getDate()-1); }
      else break;
    }

    // longest streak
    let longest = 0, run = 0, prev = null;
    [...activeDates].sort().forEach(k => {
      if (prev) {
        const diff = Math.round((new Date(k)-new Date(prev))/86400000);
        run = diff === 1 ? run+1 : 1;
      } else { run = 1; }
      if (run > longest) longest = run;
      prev = k;
    });
    if (current > longest) longest = current;

    // this month
    const monthPrefix = today.slice(0,7);
    const thisMonth = [...activeDates].filter(d => d.startsWith(monthPrefix)).length;

    res.json({ current, longest, thisMonth, totalDays: activeDates.size });
  } catch(e) { next(e); }
});

// Helper: recalculate day log totals from task logs
async function recalcDayLog(date) {
  try {
    const taskLogs = await prisma.taskLog.findMany({
      where: { date },
      include: { task: true }
    });
    const totalScore  = taskLogs.reduce((s,l) => s+l.earnedPts, 0);
    const studySecs   = taskLogs.reduce((s,l) => s+l.elapsedSecs, 0);
    const tasksDone   = taskLogs.filter(l => ['done','partial'].includes(l.status)).length;
    const tasksTotal  = taskLogs.length;
    const status      = totalScore >= 70 ? 'done' : totalScore >= 30 ? 'partial' : tasksDone > 0 ? 'partial' : 'pending';
    await prisma.dayLog.updateMany({
      where: { date },
      data: { totalScore, studySecs, tasksDone, tasksTotal, status }
    });
  } catch(e) { console.error('recalcDayLog error:', e.message); }
}

module.exports = router;
