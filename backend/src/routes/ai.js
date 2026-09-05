const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// ─── Get the right API key for the selected provider ─────────────────────────
function getKey(settings, provider) {
  if (provider === 'claude')  return settings.claudeApiKey || '';
  if (provider === 'openai')  return settings.openaiApiKey || '';
  if (provider === 'gemini')  return settings.geminiApiKey || '';
  return '';
}

// ─── Call the right AI provider ───────────────────────────────────────────────
async function callAI(provider, apiKey, messages, systemPrompt) {

  // ── Claude (Anthropic) ───────────────────────────────────────────────────
  if (provider === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-10)
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || 'Claude API error. Check your key.');
    }
    const data = await res.json();
    return data.content[0].text;
  }

  // ── OpenAI (ChatGPT) ─────────────────────────────────────────────────────
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)]
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || 'OpenAI API error. Check your key.');
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  // ── Gemini (Google) ──────────────────────────────────────────────────────
  if (provider === 'gemini') {
    // Fix: Gemini needs strictly alternating user/model, starting with user
    const raw = messages.slice(-10);
    const fixed = [];
    let lastRole = null;
    for (const m of raw) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (role === lastRole) continue;
      fixed.push({ role, parts: [{ text: m.content || ' ' }] });
      lastRole = role;
    }
    if (!fixed.length || fixed[0].role !== 'user') {
      const lastMsg = messages[messages.length - 1];
      fixed.unshift({ role: 'user', parts: [{ text: lastMsg?.content || 'Hello' }] });
    }

    // Try models in order until one works
    const models = ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-pro'];
    let lastError = '';

    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: fixed,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
          })
        }
      );

      if (res.status === 404 || res.status === 400) {
        // This model not available, try next
        const e = await res.json().catch(() => ({}));
        lastError = e.error?.message || `Model ${model} not available`;
        continue;
      }

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const msg = e.error?.message || 'Gemini API error';
        if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('Gemini free quota exceeded. Wait until tomorrow or use a different Google account to get a new API key from aistudio.google.com');
        }
        if (msg.includes('API_KEY_INVALID') || msg.includes('invalid')) {
          throw new Error('Invalid Gemini API key. Go to Settings and re-enter your key from aistudio.google.com');
        }
        throw new Error('Gemini: ' + msg);
      }

      const data = await res.json();
      if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error('Gemini blocked this message. Try rephrasing.');
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned empty response. Try again.');
      return text;
    }

    throw new Error('Gemini: ' + lastError);
  }

  throw new Error('Unknown provider: ' + provider + '. Go to Settings and select a provider.');
}

// ─── System prompt with user's real data ─────────────────────────────────────
async function buildSystemPrompt(userId) {
  try {
    const [tasks, streaks, todayLog] = await Promise.all([
      prisma.task.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
      getStreakData(userId),
      prisma.dayLog.findUnique({ where: { userId_date: { userId, date: new Date().toISOString().slice(0, 10) } } })
    ]);
    const schedule = tasks.length
      ? tasks.map(t => `${t.name} (${t.startTime}-${t.endTime}, ${t.maxPts}pts, ${t.subject})`).join(' | ')
      : 'No tasks set up yet';
    return `You are StudyOS AI — a friendly personal study advisor.

The user's data:
- Schedule: ${schedule}
- Today's score: ${todayLog?.score || 0}/100
- Current streak: ${streaks.current} days | Longest: ${streaks.longest} days

Give short, warm, actionable advice. Reference their actual schedule when relevant. Keep responses under 200 words.`;
  } catch (e) {
    return 'You are StudyOS AI — a friendly personal study advisor. Give helpful, concise study advice.';
  }
}

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    const provider = settings?.aiProvider || 'gemini';
    const apiKey = getKey(settings || {}, provider);

    console.log(`[AI] provider=${provider} hasKey=${!!apiKey}`);

    if (!apiKey.trim()) {
      return res.status(400).json({
        error: `No ${provider} API key saved. Go to Settings → AI Settings → select ${provider} → paste your key → Save.`
      });
    }

    // Get or create conversation
    let conv = conversationId
      ? await prisma.aiConversation.findFirst({ where: { id: conversationId, userId: req.userId } })
      : null;
    if (!conv) {
      conv = await prisma.aiConversation.create({
        data: { userId: req.userId, title: message.slice(0, 50) }
      });
    }

    let messages = [];
    try { messages = JSON.parse(conv.messages || '[]'); } catch {}
    messages.push({ role: 'user', content: message });

    const systemPrompt = await buildSystemPrompt(req.userId);
    const reply = await callAI(provider, apiKey, messages, systemPrompt);
    messages.push({ role: 'assistant', content: reply });

    await prisma.aiConversation.update({
      where: { id: conv.id },
      data: { messages: JSON.stringify(messages) }
    });

    res.json({ reply, conversationId: conv.id, provider });

  } catch (err) {
    console.error('[AI Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/conversations
router.get('/conversations', async (req, res) => {
  try {
    const convs = await prisma.aiConversation.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, title: true, createdAt: true, updatedAt: true }
    });
    res.json(convs);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/ai/conversations/:id
router.get('/conversations/:id', async (req, res) => {
  try {
    const conv = await prisma.aiConversation.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    let messages = [];
    try { messages = JSON.parse(conv.messages || '[]'); } catch {}
    res.json({ ...conv, messages });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/ai/conversations/:id
router.delete('/conversations/:id', async (req, res) => {
  try {
    await prisma.aiConversation.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Streak helper
async function getStreakData(userId) {
  try {
    const logs = await prisma.dayLog.findMany({ where: { userId, score: { gt: 0 } }, orderBy: { date: 'asc' } });
    if (!logs.length) return { current: 0, longest: 0 };
    const dates = new Set(logs.map(l => l.date));
    const today = new Date().toISOString().slice(0, 10);
    let current = 0, d = new Date();
    if (!dates.has(today)) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      if (dates.has(d.toISOString().slice(0, 10))) { current++; d.setDate(d.getDate() - 1); } else break;
    }
    let longest = 0, run = 0, prev = null;
    [...dates].sort().forEach(dt => {
      run = prev && Math.round((new Date(dt) - new Date(prev)) / 86400000) === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = dt;
    });
    return { current, longest };
  } catch { return { current: 0, longest: 0 }; }
}

module.exports = router;
