const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let s = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    if (!s) s = await prisma.userSettings.create({ data: { userId: req.userId } });
    res.json({
      aiProvider:    s.aiProvider    || 'gemini',
      theme:         s.theme,
      accentColor:   s.accentColor,
      alarmSound:    s.alarmSound,
      notifyEndTask: s.notifyEndTask,
      // Tell frontend which keys are saved (never expose actual keys)
      hasClaudeKey:  !!s.claudeApiKey,
      hasOpenAiKey:  !!s.openaiApiKey,
      hasGeminiKey:  !!s.geminiApiKey,
      // Legacy: hasApiKey = true if current provider has a key
      hasApiKey: !!(
        (s.aiProvider === 'claude'  && s.claudeApiKey) ||
        (s.aiProvider === 'openai'  && s.openaiApiKey) ||
        (s.aiProvider === 'gemini'  && s.geminiApiKey) ||
        (!s.aiProvider              && s.geminiApiKey)
      ),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const {
      claudeApiKey, openaiApiKey, geminiApiKey,
      aiProvider, theme, accentColor, alarmSound, notifyEndTask
    } = req.body;

    const update = {};
    if (claudeApiKey  !== undefined) update.claudeApiKey  = claudeApiKey;
    if (openaiApiKey  !== undefined) update.openaiApiKey  = openaiApiKey;
    if (geminiApiKey  !== undefined) update.geminiApiKey  = geminiApiKey;
    if (aiProvider    !== undefined) update.aiProvider    = aiProvider;
    if (theme         !== undefined) update.theme         = theme;
    if (accentColor   !== undefined) update.accentColor   = accentColor;
    if (alarmSound    !== undefined) update.alarmSound    = alarmSound;
    if (notifyEndTask !== undefined) update.notifyEndTask = notifyEndTask;

    const s = await prisma.userSettings.upsert({
      where:  { userId: req.userId },
      create: { userId: req.userId, ...update },
      update,
    });

    res.json({
      aiProvider:    s.aiProvider || 'gemini',
      hasClaudeKey:  !!s.claudeApiKey,
      hasOpenAiKey:  !!s.openaiApiKey,
      hasGeminiKey:  !!s.geminiApiKey,
      hasApiKey: !!(
        (s.aiProvider === 'claude'  && s.claudeApiKey) ||
        (s.aiProvider === 'openai'  && s.openaiApiKey) ||
        (s.aiProvider === 'gemini'  && s.geminiApiKey) ||
        (!s.aiProvider              && s.geminiApiKey)
      ),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
