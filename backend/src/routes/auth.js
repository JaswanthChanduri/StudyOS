const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, track } = req.body;
    if (!name || !username || !password)
      return res.status(400).json({ error: 'name, username, password required' });

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(400).json({ error: 'Username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, username, password: hashed, track: track || 'Data Science' }
    });

    // create default settings
    await prisma.userSettings.create({ data: { userId: user.id } });

    // seed default tasks for this user
    await seedDefaultTasks(user.id);

    const token = makeToken(user);
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, track: user.track } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password required' });

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = makeToken(user);
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, track: user.track } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
const auth = require('../middleware/auth');
router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { settings: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

async function seedDefaultTasks(userId) {
  const defaults = [
    { name:'Excel Practice',         subject:'Excel',      emoji:'📊', startTime:'08:00', endTime:'09:00', estMins:60,  maxPts:15, priority:'high', blockName:'Morning Block',  sortOrder:1,  isDefault:true },
    { name:'Data Science Class',     subject:'Data Sci',   emoji:'🔬', startTime:'10:00', endTime:'10:40', estMins:40,  maxPts:12, priority:'high', blockName:'Coaching Block', sortOrder:2,  isDefault:true },
    { name:'Lab Practice',           subject:'Data Sci',   emoji:'🧪', startTime:'11:00', endTime:'12:30', estMins:90,  maxPts:8,  priority:'high', blockName:'Coaching Block', sortOrder:3,  isDefault:true },
    { name:'Communication Class',    subject:'Comm',       emoji:'🗣️', startTime:'13:00', endTime:'14:00', estMins:60,  maxPts:5,  priority:'med',  blockName:'Coaching Block', sortOrder:4,  isDefault:true },
    { name:'PL/SQL Session',         subject:'SQL',        emoji:'🗃️', startTime:'16:45', endTime:'17:00', estMins:15,  maxPts:3,  priority:'med',  blockName:'Coaching Block', sortOrder:5,  isDefault:true },
    { name:'Python Study',           subject:'Python',     emoji:'🐍', startTime:'17:30', endTime:'19:00', estMins:90,  maxPts:20, priority:'high', blockName:'Evening Block',  sortOrder:6,  isDefault:true },
    { name:'SQL Practice',           subject:'SQL',        emoji:'🗃️', startTime:'19:15', endTime:'20:45', estMins:90,  maxPts:17, priority:'high', blockName:'Evening Block',  sortOrder:7,  isDefault:true },
    { name:'AI-900 Revision',        subject:'AI-900',     emoji:'🤖', startTime:'21:15', endTime:'22:00', estMins:45,  maxPts:10, priority:'high', blockName:'Evening Block',  sortOrder:8,  isDefault:true },
    { name:'Video Editing',          subject:'Video',      emoji:'🎬', startTime:'22:00', endTime:'22:30', estMins:30,  maxPts:5,  priority:'low',  blockName:'Evening Block',  sortOrder:9,  isDefault:true },
    { name:'Communication Practice', subject:'Comm',       emoji:'💬', startTime:'22:30', endTime:'22:45', estMins:15,  maxPts:5,  priority:'med',  blockName:'Evening Block',  sortOrder:10, isDefault:true },
  ];
  for (const t of defaults) {
    await prisma.task.create({ data: { userId, ...t } });
  }
}

module.exports = router;
