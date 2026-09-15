require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./src/db');
const { hashPassword, comparePassword, signToken, requireAuth } = require('./src/auth');
const { validateBotToken } = require('./src/telegram');
const botManager = require('./src/botManager');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// Middleware عام
// ------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // نسمح بتحميل الصفحات الثابتة بدون تعقيد إضافي في هذا المشروع
  })
);
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting عام لكل API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Rate limiting أشد صرامة على مسارات المصادقة الحساسة
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'عدد محاولات كبير جداً، يرجى المحاولة لاحقاً' },
});

// ------------------------------------------------------------------
// أدوات مساعدة للتحقق من المدخلات
// ------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function isValidCommand(command) {
  return typeof command === 'string' && /^\/[a-zA-Z0-9_]{1,31}$/.test(command.trim());
}

// ------------------------------------------------------------------
// Auth Routes
// ------------------------------------------------------------------

// POST /api/register
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body || {};

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'كلمتا المرور غير متطابقتين' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    const passwordHash = await hashPassword(password);
    const result = db
      .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(normalizedEmail, passwordHash);

    const token = signToken({ userId: result.lastInsertRowid });
    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: { id: result.lastInsertRowid, email: normalizedEmail },
    });
  } catch (err) {
    console.error('خطأ في /api/register:', err.message);
    res.status(500).json({ error: 'حدث خطأ في السيرفر، حاول مرة أخرى' });
  }
});

// POST /api/login
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const token = signToken({ userId: user.id });
    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error('خطأ في /api/login:', err.message);
    res.status(500).json({ error: 'حدث خطأ في السيرفر، حاول مرة أخرى' });
  }
});

// ------------------------------------------------------------------
// Stats (public)
// ------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS count FROM bots').get();
  res.json({ bots: row.count });
});

// ------------------------------------------------------------------
// Bots Routes (محمية بالمصادقة)
// ------------------------------------------------------------------

// أداة مساعدة: تجلب بوتاً وتتحقق من ملكية المستخدم له
function getOwnedBotOr404(botId, userId, res) {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
  if (!bot) {
    res.status(404).json({ error: 'البوت غير موجود' });
    return null;
  }
  if (bot.user_id !== userId) {
    res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا البوت' });
    return null;
  }
  return bot;
}

// GET /api/bots - عرض بوتات المستخدم الحالي فقط (بدون Token)
app.get('/api/bots', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, name, username, active, created_at FROM bots WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId);
  res.json({ bots: rows });
});

// POST /api/bots - إنشاء بوت جديد
app.post('/api/bots', requireAuth, async (req, res) => {
  try {
    const { name, token } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'اسم البوت مطلوب' });
    }
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Bot Token مطلوب' });
    }

    const cleanToken = token.trim();

    // تحقق من عدم استخدام نفس التوكن من قبل
    const tokenExists = db.prepare('SELECT id FROM bots WHERE token = ?').get(cleanToken);
    if (tokenExists) {
      return res.status(409).json({ error: 'هذا Bot Token مستخدم بالفعل في المنصة' });
    }

    // تحقق من صحة التوكن عبر Telegram API
    const result = await validateBotToken(cleanToken);
    if (!result.valid) {
      return res.status(400).json({ error: 'Bot Token غير صحيح، تأكد من نسخه بشكل صحيح من BotFather' });
    }

    const username = result.me.username;

    const insert = db
      .prepare('INSERT INTO bots (user_id, name, username, token, active) VALUES (?, ?, ?, ?, 0)')
      .run(req.userId, name.trim(), username, cleanToken);

    const botRow = db.prepare('SELECT * FROM bots WHERE id = ?').get(insert.lastInsertRowid);

    // نشغّل البوت مباشرة بعد إنشائه
    try {
      await botManager.startBot(botRow);
    } catch (err) {
      // البوت أُنشئ لكن تعذر تشغيله فوراً - يبقى active = 0 والمستخدم يمكنه المحاولة يدوياً
      console.error('تعذر تشغيل البوت مباشرة بعد الإنشاء:', err.message);
    }

    const updated = db
      .prepare('SELECT id, name, username, active, created_at FROM bots WHERE id = ?')
      .get(insert.lastInsertRowid);

    res.status(201).json({ message: 'تم إنشاء البوت بنجاح', bot: updated });
  } catch (err) {
    console.error('خطأ في /api/bots (POST):', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء البوت' });
  }
});

// DELETE /api/bots/:id
app.delete('/api/bots/:id', requireAuth, async (req, res) => {
  try {
    const botId = Number(req.params.id);
    const bot = getOwnedBotOr404(botId, req.userId, res);
    if (!bot) return;

    botManager.removeInstance(botId);
    db.prepare('DELETE FROM commands WHERE bot_id = ?').run(botId);
    db.prepare('DELETE FROM bots WHERE id = ?').run(botId);

    res.json({ message: 'تم حذف البوت بنجاح' });
  } catch (err) {
    console.error('خطأ في /api/bots/:id (DELETE):', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف البوت' });
  }
});

// POST /api/bots/:id/toggle - تشغيل أو إيقاف البوت
app.post('/api/bots/:id/toggle', requireAuth, async (req, res) => {
  try {
    const botId = Number(req.params.id);
    const bot = getOwnedBotOr404(botId, req.userId, res);
    if (!bot) return;

    if (bot.active) {
      await botManager.stopBot(botId);
      return res.json({ message: 'تم إيقاف البوت', active: false });
    } else {
      try {
        await botManager.startBot(bot);
      } catch (err) {
        return res.status(400).json({ error: 'تعذر تشغيل البوت، تأكد من أن التوكن ما زال صالحاً' });
      }
      return res.json({ message: 'تم تشغيل البوت', active: true });
    }
  } catch (err) {
    console.error('خطأ في /api/bots/:id/toggle:', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء تغيير حالة البوت' });
  }
});

// ------------------------------------------------------------------
// Commands Routes
// ------------------------------------------------------------------

// GET /api/bots/:id/commands
app.get('/api/bots/:id/commands', requireAuth, (req, res) => {
  const botId = Number(req.params.id);
  const bot = getOwnedBotOr404(botId, req.userId, res);
  if (!bot) return;

  const rows = db
    .prepare('SELECT id, command, response, created_at FROM commands WHERE bot_id = ? ORDER BY created_at ASC')
    .all(botId);

  res.json({ bot: { id: bot.id, name: bot.name, username: bot.username }, commands: rows });
});

// POST /api/bots/:id/commands
app.post('/api/bots/:id/commands', requireAuth, (req, res) => {
  const botId = Number(req.params.id);
  const bot = getOwnedBotOr404(botId, req.userId, res);
  if (!bot) return;

  const { command, response } = req.body || {};

  if (!command || !isValidCommand(command)) {
    return res.status(400).json({
      error: 'صيغة الأمر غير صحيحة. يجب أن يبدأ بـ / ويحتوي على أحرف وأرقام فقط، مثال: /start',
    });
  }
  if (!response || typeof response !== 'string' || !response.trim()) {
    return res.status(400).json({ error: 'نص الرد مطلوب' });
  }

  const normalizedCommand = command.trim().toLowerCase();

  const exists = db
    .prepare('SELECT id FROM commands WHERE bot_id = ? AND command = ?')
    .get(botId, normalizedCommand);
  if (exists) {
    return res.status(409).json({ error: 'هذا الأمر موجود بالفعل لهذا البوت' });
  }

  const result = db
    .prepare('INSERT INTO commands (bot_id, command, response) VALUES (?, ?, ?)')
    .run(botId, normalizedCommand, response.trim());

  const created = db.prepare('SELECT * FROM commands WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'تمت إضافة الأمر بنجاح', command: created });
});

// PUT /api/commands/:id
app.put('/api/commands/:id', requireAuth, (req, res) => {
  const commandId = Number(req.params.id);
  const { response } = req.body || {};

  const row = db
    .prepare(
      `SELECT commands.*, bots.user_id AS bot_owner_id
       FROM commands JOIN bots ON commands.bot_id = bots.id
       WHERE commands.id = ?`
    )
    .get(commandId);

  if (!row) {
    return res.status(404).json({ error: 'الأمر غير موجود' });
  }
  if (row.bot_owner_id !== req.userId) {
    return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا الأمر' });
  }
  if (!response || typeof response !== 'string' || !response.trim()) {
    return res.status(400).json({ error: 'نص الرد مطلوب' });
  }

  db.prepare('UPDATE commands SET response = ? WHERE id = ?').run(response.trim(), commandId);
  const updated = db.prepare('SELECT * FROM commands WHERE id = ?').get(commandId);
  res.json({ message: 'تم تعديل الأمر بنجاح', command: updated });
});

// DELETE /api/commands/:id
app.delete('/api/commands/:id', requireAuth, (req, res) => {
  const commandId = Number(req.params.id);

  const row = db
    .prepare(
      `SELECT commands.*, bots.user_id AS bot_owner_id
       FROM commands JOIN bots ON commands.bot_id = bots.id
       WHERE commands.id = ?`
    )
    .get(commandId);

  if (!row) {
    return res.status(404).json({ error: 'الأمر غير موجود' });
  }
  if (row.bot_owner_id !== req.userId) {
    return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا الأمر' });
  }

  db.prepare('DELETE FROM commands WHERE id = ?').run(commandId);
  res.json({ message: 'تم حذف الأمر بنجاح' });
});

// ------------------------------------------------------------------
// Health
// ------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ------------------------------------------------------------------
// Fallback للصفحات غير API (SPA-like static serving)
// ------------------------------------------------------------------
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) next();
  });
});

// ------------------------------------------------------------------
// معالج أخطاء عام (بدون كشف تفاصيل حساسة)
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('خطأ غير متوقع:', err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في السيرفر' });
});

// ------------------------------------------------------------------
// إقلاع السيرفر
// ------------------------------------------------------------------
app.listen(PORT, async () => {
  console.log(`🚀 STRVEON Bot Builder يعمل على المنفذ ${PORT}`);
  try {
    await botManager.startAllActiveBots();
  } catch (err) {
    console.error('خطأ أثناء تشغيل البوتات النشطة تلقائياً:', err.message);
  }
});

// إيقاف نظيف عند إغلاق السيرفر
process.once('SIGINT', () => {
  botManager.stopAllBots();
  process.exit(0);
});
process.once('SIGTERM', () => {
  botManager.stopAllBots();
  process.exit(0);
});
