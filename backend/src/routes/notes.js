const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// GET /api/notes
router.get('/', async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.userId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }]
    });
    res.json(notes);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/notes
router.post('/', async (req, res) => {
  try {
    const { title, content, color, tags } = req.body;
    const note = await prisma.note.create({
      data: { userId: req.userId, title: title || 'Untitled', content: content || '', color: color || '#6c63ff', tags: tags || '' }
    });
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  try {
    const note = await prisma.note.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!note) return res.status(404).json({ error: 'Not found' });
    const { title, content, color, isPinned, tags } = req.body;
    const updated = await prisma.note.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(color !== undefined && { color }),
        ...(isPinned !== undefined && { isPinned }),
        ...(tags !== undefined && { tags }),
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  try {
    const note = await prisma.note.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!note) return res.status(404).json({ error: 'Not found' });
    await prisma.note.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
