'use strict';
const express = require('express');
const router  = express.Router();
const prisma  = require('../prisma');

// GET all users (for profile switcher)
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id:true, name:true, role:true, track:true, createdAt:true }
    });
    res.json(users);
  } catch(e) { next(e); }
});

// POST create user
router.post('/', async (req, res, next) => {
  try {
    const { name, role, track } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const user = await prisma.user.create({
      data: { name: name.trim(), role: role||'Learner', track: track||'Data Science Track' }
    });
    res.status(201).json(user);
  } catch(e) { next(e); }
});

// GET single user
router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id:true, name:true, role:true, track:true, createdAt:true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch(e) { next(e); }
});

// PUT update user profile
router.put('/:id', async (req, res, next) => {
  try {
    const { name, role, track } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, role, track },
      select: { id:true, name:true, role:true, track:true }
    });
    res.json(user);
  } catch(e) { next(e); }
});

// PUT save Claude API key for user
router.put('/:id/apikey', async (req, res, next) => {
  try {
    const { claudeApiKey } = req.body;
    await prisma.user.update({
      where: { id: req.params.id },
      data: { claudeApiKey }
    });
    res.json({ success: true, message: 'API key saved' });
  } catch(e) { next(e); }
});

// GET check if user has API key set
router.get('/:id/apikey/status', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { claudeApiKey: true }
    });
    res.json({ hasKey: !!(user?.claudeApiKey?.trim()) });
  } catch(e) { next(e); }
});

// DELETE user
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(e) { next(e); }
});

module.exports = router;
