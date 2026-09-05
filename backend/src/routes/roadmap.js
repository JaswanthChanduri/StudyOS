const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// GET /api/roadmap — get all progress for user
router.get('/', async (req, res) => {
  try {
    const progress = await prisma.roadmapProgress.findMany({ where: { userId: req.userId } });
    // Convert to { topicId: [completedSubs] }
    const result = {};
    progress.forEach(p => {
      try { result[p.topicId] = JSON.parse(p.completedSubs); } catch { result[p.topicId] = []; }
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/roadmap/:roadmapId/:topicId — update completed subs for a topic
router.put('/:roadmapId/:topicId', async (req, res) => {
  try {
    const { completedSubs } = req.body; // array of strings
    if (!Array.isArray(completedSubs)) return res.status(400).json({ error: 'completedSubs must be array' });
    const progress = await prisma.roadmapProgress.upsert({
      where: { userId_roadmapId_topicId: { userId: req.userId, roadmapId: req.params.roadmapId, topicId: req.params.topicId } },
      create: { userId: req.userId, roadmapId: req.params.roadmapId, topicId: req.params.topicId, completedSubs: JSON.stringify(completedSubs) },
      update: { completedSubs: JSON.stringify(completedSubs) }
    });
    res.json(progress);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
