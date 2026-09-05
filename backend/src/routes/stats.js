'use strict';
const express = require('express');
const router  = express.Router();
const prisma  = require('../prisma');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// GET dashboard summary stats
router.get('/dashboard', async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const today = todayStr();

    // Today's day log
    const todayLog = await prisma.dayLog.findUnique({ where: { date: today } });

    // Last 7 days for weekly avg
    const last7 = await prisma.dayLog.findMany({
      where: {
        userId,
        date: { lte: today },
        status: { in: ['done','partial'] }
      },
      orderBy: { date: 'desc' },
      take: 7,
      select: { totalScore: true }
    });
    const weekAvg = last7.length
      ? Math.round(last7.reduce((s,l)=>s+l.totalScore,0)/last7.length)
      : 0;

    // This month consistency
    const monthPrefix = today.slice(0,7);
    const monthLogs = await prisma.dayLog.findMany({
      where: { userId, date: { startsWith: monthPrefix } },
      select: { status: true }
    });
    const daysInMonth = new Date().getDate();
    const doneDays = monthLogs.filter(l=>['done','partial'].includes(l.status)).length;

    // Best score
    const best = await prisma.dayLog.findFirst({
      where: { userId },
      orderBy: { totalScore: 'desc' },
      select: { totalScore: true, date: true }
    });

    res.json({
      today: {
        score: todayLog?.totalScore || 0,
        tasksDone: todayLog?.tasksDone || 0,
        tasksTotal: todayLog?.tasksTotal || 0,
        studySecs: todayLog?.studySecs || 0,
        status: todayLog?.status || 'pending'
      },
      weekAvg,
      monthConsistency: {
        done: doneDays,
        total: daysInMonth,
        pct: daysInMonth ? Math.round((doneDays/daysInMonth)*100) : 0
      },
      best: best || { totalScore: 0, date: null }
    });
  } catch(e) { next(e); }
});

// GET subject performance from task logs
router.get('/subjects', async (req, res, next) => {
  try {
    const { userId, days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth()+1).padStart(2,'0')}-${String(since.getDate()).padStart(2,'0')}`;

    const taskLogs = await prisma.taskLog.findMany({
      where: {
        date: { gte: sinceStr },
        task: { userId }
      },
      include: { task: { select: { subject: true, maxPts: true, emoji: true } } }
    });

    // Group by subject
    const subjects = {};
    taskLogs.forEach(l => {
      const s = l.task.subject;
      if (!subjects[s]) subjects[s] = { name: s, emoji: l.task.emoji, sessions: 0, totalPts: 0, maxPts: 0, studySecs: 0 };
      subjects[s].sessions++;
      subjects[s].totalPts += l.earnedPts;
      subjects[s].maxPts += l.task.maxPts;
      subjects[s].studySecs += l.elapsedSecs;
    });

    const result = Object.values(subjects).map(s => ({
      ...s,
      avgPct: s.maxPts ? Math.round((s.totalPts/s.maxPts)*100) : 0
    })).sort((a,b) => b.avgPct - a.avgPct);

    res.json(result);
  } catch(e) { next(e); }
});

module.exports = router;
