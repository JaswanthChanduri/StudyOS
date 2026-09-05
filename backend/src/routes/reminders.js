const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// GET /api/reminders
router.get('/', async (req, res) => {
  try {
    const reminders = await prisma.reminder.findMany({
      where: { userId: req.userId },
      orderBy: { remindAt: 'asc' }
    });
    res.json(reminders);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/reminders
router.post('/', async (req, res) => {
  try {
    const { title, description, remindAt, repeatType } = req.body;
    if (!title || !remindAt) return res.status(400).json({ error: 'title and remindAt required' });
    const reminder = await prisma.reminder.create({
      data: {
        userId: req.userId,
        title,
        description: description || '',
        remindAt: new Date(remindAt),
        repeatType: repeatType || 'none'
      }
    });
    res.status(201).json(reminder);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/reminders/due  ← MUST be before /:id
router.get('/due', async (req, res) => {
  try {
    const now = new Date();
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
    console.log(`[Reminders/due] Checking for user ${req.userId} between ${fiveMinsAgo.toISOString()} and ${now.toISOString()}`);

    const due = await prisma.reminder.findMany({
      where: {
        userId: req.userId,
        isActive: true,
        isFired: false,
        remindAt: { gte: fiveMinsAgo, lte: now }
      }
    });

    console.log(`[Reminders/due] Found ${due.length} due reminders`);

    for (const r of due) {
      if (r.repeatType === 'daily') {
        const next = new Date(r.remindAt);
        next.setDate(next.getDate() + 1);
        await prisma.reminder.update({ where: { id: r.id }, data: { remindAt: next } });
      } else if (r.repeatType === 'weekly') {
        const next = new Date(r.remindAt);
        next.setDate(next.getDate() + 7);
        await prisma.reminder.update({ where: { id: r.id }, data: { remindAt: next } });
      } else {
        await prisma.reminder.update({ where: { id: r.id }, data: { isFired: true } });
      }
    }

    res.json(due);
  } catch (err) {
    console.error('[Reminders/due]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders/test-alarm  ← for manual alarm testing
router.get('/test-alarm', async (req, res) => {
  res.json([{ id: 'test', title: 'Test Alarm', description: 'Alarm system is working!' }]);
});

// PUT /api/reminders/:id
router.put('/:id', async (req, res) => {
  try {
    const r = await prisma.reminder.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    const { title, description, remindAt, repeatType, isActive, isFired } = req.body;
    const updated = await prisma.reminder.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(remindAt !== undefined && { remindAt: new Date(remindAt) }),
        ...(repeatType !== undefined && { repeatType }),
        ...(isActive !== undefined && { isActive }),
        ...(isFired !== undefined && { isFired }),
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  try {
    const r = await prisma.reminder.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    await prisma.reminder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
