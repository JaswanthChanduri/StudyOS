const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

function todayKey() {
  return new Date().toISOString().slice(0,10);
}

// GET /api/tasks — get all tasks for user with today's session status
router.get('/', async (req, res) => {
  try {
    const today = todayKey();
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId, isActive: true },
      orderBy: [{ blockName: 'asc' }, { sortOrder: 'asc' }],
      include: {
        sessions: { where: { date: today } }
      }
    });
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks — create a new task
router.post('/', async (req, res) => {
  try {
    const { name, subject, emoji, startTime, endTime, estMins, maxPts, priority, blockName } = req.body;
    if (!name || !subject || !startTime || !endTime || !estMins || !maxPts)
      return res.status(400).json({ error: 'Missing required fields' });

    const count = await prisma.task.count({ where: { userId: req.userId } });
    const task = await prisma.task.create({
      data: {
        userId: req.userId,
        name, subject,
        emoji: emoji || '📚',
        startTime, endTime,
        estMins: parseInt(estMins),
        maxPts: parseInt(maxPts),
        priority: priority || 'med',
        blockName: blockName || 'Custom',
        sortOrder: count + 1,
        isDefault: false
      }
    });
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id — update a task
router.put('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { name, subject, emoji, startTime, endTime, estMins, maxPts, priority, blockName, isActive, sortOrder } = req.body;
    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(subject !== undefined && { subject }),
        ...(emoji !== undefined && { emoji }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(estMins !== undefined && { estMins: parseInt(estMins) }),
        ...(maxPts !== undefined && { maxPts: parseInt(maxPts) }),
        ...(priority !== undefined && { priority }),
        ...(blockName !== undefined && { blockName }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
      }
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

// GET /api/tasks/sessions/today
router.get('/sessions/today', async (req, res) => {
  try {
    const today = todayKey();
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId, isActive: true },
      orderBy: [{ blockName: 'asc' }, { sortOrder: 'asc' }],
      include: { sessions: { where: { date: today } } }
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id/session — upsert today's session
router.put('/:id/session', async (req, res) => {
  try {
    const today = todayKey();
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { status, quality, earnedPts, elapsedSecs, notes, startedAt, completedAt } = req.body;

    const session = await prisma.taskSession.upsert({
      where: { taskId_date: { taskId: req.params.id, date: today } },
      create: {
        taskId: req.params.id,
        date: today,
        status: status || 'pending',
        quality: quality || null,
        earnedPts: earnedPts || 0,
        elapsedSecs: elapsedSecs || 0,
        notes: notes || '',
        startedAt: startedAt ? new Date(startedAt) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
      },
      update: {
        ...(status !== undefined && { status }),
        ...(quality !== undefined && { quality }),
        ...(earnedPts !== undefined && { earnedPts }),
        ...(elapsedSecs !== undefined && { elapsedSecs }),
        ...(notes !== undefined && { notes }),
        ...(startedAt !== undefined && { startedAt: new Date(startedAt) }),
        ...(completedAt !== undefined && { completedAt: new Date(completedAt) }),
      }
    });
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/day/close — archive today, calculate score, update streak
router.post('/day/close', async (req, res) => {
  try {
    const today = todayKey();
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId, isActive: true },
      include: { sessions: { where: { date: today } } }
    });

    let score = 0, tasksDone = 0, tasksSkipped = 0, studySecs = 0, maxScore = 0;
    tasks.forEach(t => {
      maxScore += t.maxPts;
      const s = t.sessions[0];
      if (s) {
        score += s.earnedPts;
        studySecs += s.elapsedSecs;
        if (s.status === 'done' || s.status === 'partial') tasksDone++;
        if (s.status === 'skipped') tasksSkipped++;
      }
    });

    const status = score >= 70 ? 'done' : score >= 30 ? 'partial' : 'missed';

    const dayLog = await prisma.dayLog.upsert({
      where: { userId_date: { userId: req.userId, date: today } },
      create: { userId: req.userId, date: today, score, maxScore, tasksDone, tasksTotal: tasks.length, tasksSkipped, studySecs, status },
      update: { score, maxScore, tasksDone, tasksTotal: tasks.length, tasksSkipped, studySecs, status }
    });

    res.json({ dayLog, score, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
