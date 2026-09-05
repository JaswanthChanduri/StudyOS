'use strict';
const express = require('express');
const router  = express.Router();
const prisma  = require('../prisma');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// GET all stopwatch logs for user
router.get('/', async (req, res, next) => {
  try {
    const { userId, limit = 30 } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const logs = await prisma.stopwatchLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });
    res.json(logs.map(l => ({ ...l, laps: JSON.parse(l.laps) })));
  } catch(e) { next(e); }
});

// POST save a stopwatch session
router.post('/', async (req, res, next) => {
  try {
    const { userId, label, totalSecs, laps } = req.body;
    if (!userId || totalSecs === undefined)
      return res.status(400).json({ error: 'userId and totalSecs required' });
    const log = await prisma.stopwatchLog.create({
      data: {
        userId,
        label: label || 'Session',
        totalSecs,
        laps: JSON.stringify(laps || []),
        date: todayStr()
      }
    });
    res.status(201).json({ ...log, laps: JSON.parse(log.laps) });
  } catch(e) { next(e); }
});

// DELETE stopwatch log
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.stopwatchLog.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(e) { next(e); }
});

module.exports = router;
