# 🤖 STRVEON Bot Builder

منصة عربية كاملة (Full-Stack) لإنشاء وإدارة بوتات Telegram بدون كتابة أي كود. يسجّل المستخدم حساباً، يلصق Bot Token من BotFather، ويحصل على بوت يعمل فوراً مع أوامر مخصصة يديرها بنفسه من لوحة تحكم.

- الموقع الحالي (النسخة السابقة): https://phenomenal-haupia-fa3d82.netlify.app/
- قناة التحديثات: https://t.me/strveon
- بوت صانع البوتات: https://t.me/STRVEONBOT

> 📸 Screenshots: أضف هنا صوراً من الصفحة الرئيسية ولوحة التحكم بعد النشر.
> `docs/screenshot-home.png` · `docs/screenshot-dashboard.png`

---

## المميزات

- تسجيل دخول وإنشاء حساب آمن (JWT + bcrypt).
- إنشاء بوت Telegram بلصق Token فقط، مع تحقق فوري عبر `getMe`.
- تشغيل / إيقاف / حذف كل بوت من لوحة التحكم.
- نظام أوامر كامل (`/start`, `/help`, ...) مع رد مخصص لكل أمر.
- تشغيل تلقائي لكل البوتات النشطة عند إقلاع السيرفر.
- عدد البوتات في الصفحة الرئيسية ديناميكي من قاعدة البيانات.
- واجهة عربية RTL داكنة وحديثة، متجاوبة بالكامل مع الهواتف.
- حماية إنتاجية: Helmet, Rate Limiting, CORS, Ownership checks, لا تُعرض التوكنات أبداً للواجهة.

## التقنيات المستخدمة

| الطبقة | التقنية |
|---|---|
| Frontend | HTML5, CSS3, JavaScript Vanilla (RTL) |
| Backend | Node.js, Express.js |
| Telegram | Telegraf |
| قاعدة البيانات | SQLite (better-sqlite3) |
| المصادقة | JWT + bcrypt |
| الحماية | Helmet, express-rate-limit, CORS |

---

## هيكل المشروع

```
strveon/
├── public/                 # الواجهة الأمامية (Static)
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── create-bot.html
│   ├── commands.html
│   ├── css/style.css
│   └── js/
│       ├── auth.js         # جلسة، طلبات API، Toasts، Modal تأكيد
│       ├── dashboard.js
│       ├── create-bot.js
│       └── commands.js
├── src/
│   ├── db.js                # اتصال SQLite + إنشاء الجداول
│   ├── auth.js               # JWT / bcrypt / middleware الحماية
│   ├── telegram.js           # التحقق من Bot Token عبر getMe
│   └── botManager.js         # إدارة Telegraf instances في الذاكرة
├── server.js                 # نقطة الدخول + كل الـ API routes
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## المتطلبات

- Node.js 18 أو أحدث (يفضل LTS).
- حساب Telegram وBot Token من [@BotFather](https://t.me/BotFather).

---

## التثبيت والتشغيل محلياً

```bash
# 1) تثبيت الحزم
npm install

# 2) إنشاء ملف البيئة
cp .env.example .env
# ثم عدّل .env ووضع JWT_SECRET قوي وعشوائي

# 3) التشغيل
npm start
# أو أثناء التطوير (إعادة تشغيل تلقائية عند التعديل):
npm run dev
```

افتح المتصفح على: `http://localhost:3000`

### Environment Variables

| المتغير | الوصف | مثال |
|---|---|---|
| `PORT` | منفذ تشغيل السيرفر | `3000` |
| `JWT_SECRET` | مفتاح سري لتوقيع JWT — **يجب تغييره ولا يُشارك أبداً** | نص عشوائي طويل |
| `APP_URL` | رابط الموقع النهائي بعد النشر | `https://your-domain.com` |

⚠️ لا تضع أي Telegram Token حقيقي أو كلمة مرور داخل ملفات المشروع أو `.env.example`.

---

## إعداد بوت Telegram

1. افتح محادثة مع [@BotFather](https://t.me/BotFather) على تيليجرام.
2. أرسل `/newbot` واتبع التعليمات لاختيار اسم واسم مستخدم للبوت.
3. سيرسل لك BotFather **Bot Token** بالشكل: `123456789:ABCdefGhIJKlmNoPQRstuVWXyz`.
4. الصق هذا التوكن في صفحة "إنشاء بوت جديد" داخل STRVEON.

**تنبيهات أمنية مهمة:**
- لا يُعرض التوكن في الواجهة بعد حفظه، ولا يُرسل للمتصفح في أي وقت.
- لا تحفظ التوكن داخل GitHub أو README أو أي ملف نصي عام.
- إذا تم تسريب التوكن، غيّره فوراً من BotFather عبر أمر `/revoke` أو `/token`.

---

## واجهة برمجة التطبيقات (API Documentation)

| Method | Endpoint | Authentication | الوصف |
|---|---|---|---|
| POST | `/api/register` | بدون | إنشاء حساب جديد |
| POST | `/api/login` | بدون | تسجيل الدخول |
| GET | `/api/stats` | بدون | عدد البوتات الكلي (للصفحة الرئيسية) |
| GET | `/api/bots` | مطلوب | عرض بوتات المستخدم الحالي |
| POST | `/api/bots` | مطلوب | إنشاء بوت جديد (تحقق Token + تشغيل تلقائي) |
| DELETE | `/api/bots/:id` | مطلوب | حذف بوت (يحذف أوامره أيضاً) |
| POST | `/api/bots/:id/toggle` | مطلوب | تشغيل/إيقاف بوت |
| GET | `/api/bots/:id/commands` | مطلوب | عرض أوامر بوت معيّن |
| POST | `/api/bots/:id/commands` | مطلوب | إضافة أمر جديد لبوت |
| PUT | `/api/commands/:id` | مطلوب | تعديل رد أمر |
| DELETE | `/api/commands/:id` | مطلوب | حذف أمر |
| GET | `/api/health` | بدون | فحص صحة الخدمة `{ "status": "ok" }` |

المصادقة تتم عبر ترويسة: `Authorization: Bearer <JWT_TOKEN>`

---

## الأمان

- كلمات المرور مشفّرة بـ bcrypt (لا تُخزَّن كنص عادي أبداً).
- الجلسات عبر JWT صالح لمدة 7 أيام.
- كل مسار بوت أو أمر يتحقق من الملكية (`user_id`) قبل أي تعديل أو حذف.
- Bot Token لا يُرسل أبداً في استجابات API ولا يظهر في الواجهة بعد الحفظ.
- Helmet لضبط ترويسات HTTP الآمنة.
- Rate limiting: حد عام 300 طلب/15 دقيقة، وحد أشد (20 طلب/15 دقيقة) على `/api/login` و`/api/register`.
- التحقق من صحة كل المدخلات (بريد إلكتروني، طول كلمة المرور، صيغة الأوامر).
- رسائل الأخطاء عربية واضحة دون كشف تفاصيل تقنية حساسة في الإنتاج.

---

## النشر على Render

1. أنشئ Repository جديد على GitHub وارفع المشروع إليه:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <رابط الريبو>
   git push -u origin main
   ```
2. سجّل الدخول إلى [Render](https://render.com) وأنشئ **New Web Service**.
3. اربط حساب GitHub واختر الـ Repository.
4. اضبط:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. أضف Environment Variables من إعدادات الخدمة:
   - `PORT` (اتركه كما يحدده Render أو 3000)
   - `JWT_SECRET` (قيمة عشوائية قوية)
   - `APP_URL` (رابط Render النهائي بعد أول نشر)
6. اضغط **Deploy** وانتظر اكتمال البناء.
7. افتح رابط الموقع الذي يوفره Render.
8. اختبر:
   - `GET /api/health` → يجب أن يرجع `{"status":"ok"}`
   - إنشاء حساب من `/register.html`
   - إنشاء بوت بتوكن حقيقي من BotFather
   - إرسال `/start` للبوت من تيليجرام والتأكد من الرد

⚠️ **ملاحظة مهمة عن قاعدة البيانات على Render:** خدمات الاستضافة المجانية/المؤقتة تعيد تهيئة نظام الملفات عند كل إعادة نشر أو إعادة تشغيل، ما يعني أن ملف `strveon.db` (SQLite) قد يُفقد إذا لم تُفعّل **Persistent Disk** من إعدادات الخدمة. لتخزين دائم وموثوق:
- فعّل Persistent Disk واربطه بمسار المشروع، أو
- خطط للانتقال لاحقاً إلى PostgreSQL (عبر مكتبة مثل `pg`) عند زيادة عدد المستخدمين والبوتات، خصوصاً في بيئة متعددة النسخ (multiple instances).

---

## النشر على VPS (Ubuntu)

```bash
# 1) الاتصال بالسيرفر
ssh user@SERVER_IP

# 2) تحديث النظام
sudo apt update && sudo apt upgrade -y

# 3) تثبيت Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# 4) استنساخ المشروع
git clone YOUR_REPOSITORY_URL
cd strveon

# 5) تثبيت الحزم
npm install

# 6) إعداد البيئة
cp .env.example .env
nano .env   # عدّل القيم

# 7) تشغيل تجريبي
npm start
```

### تشغيل دائم باستخدام PM2

```bash
sudo npm install -g pm2

pm2 start server.js --name strveon
pm2 save
pm2 startup     # نفّذ الأمر الذي يظهر لك لتفعيل الإقلاع التلقائي عند إعادة تشغيل السيرفر
```

أوامر إدارة مفيدة:

```bash
pm2 restart strveon   # إعادة تشغيل
pm2 stop strveon      # إيقاف
pm2 logs strveon      # عرض السجلات
pm2 status            # حالة كل العمليات
```

---

## إعداد Nginx و HTTPS (Domain)

1. **DNS:** أضف A Record لدومينك يشير إلى IP الخاص بالـ VPS.
2. **تثبيت Nginx:**
   ```bash
   sudo apt install -y nginx
   ```
3. **إعداد Reverse Proxy** — أنشئ `/etc/nginx/sites-available/strveon`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/strveon /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```
4. **تفعيل HTTPS عبر Let's Encrypt:**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```
   Certbot يجدّد الشهادة تلقائياً؛ للتأكد:
   ```bash
   sudo certbot renew --dry-run
   ```
5. حدّث `APP_URL` في `.env` إلى `https://your-domain.com` ثم:
   ```bash
   pm2 restart strveon
   ```

---

## قاعدة البيانات في الإنتاج

- ملف قاعدة البيانات `strveon.db` يُنشأ تلقائياً في جذر المشروع عند أول تشغيل.
- **لا تحذف** هذا الملف عند تحديث المشروع (`git pull` لا يمسّه لأنه داخل `.gitignore`).
- خذ نسخة احتياطية دورية:
  ```bash
  mkdir -p backups
  cp strveon.db backups/strveon-$(date +%Y-%m-%d).db
  ```
  يمكن جدولة هذا الأمر عبر `crontab -e` ليعمل يومياً.
- عند نمو عدد المستخدمين/البوتات بشكل كبير، أو عند التشغيل على عدة نسخ (instances) في نفس الوقت، خطط للانتقال إلى PostgreSQL بدلاً من SQLite.

---

## تحديث المشروع

**على VPS:**
```bash
git pull
npm install
pm2 restart strveon
```

**على Render:**
- ادفع (`push`) التعديلات إلى GitHub.
- إذا كان "Auto Deploy" مفعلاً، سيقوم Render بإعادة النشر تلقائياً.
- وإلا، اضغط "Manual Deploy" من لوحة تحكم Render.

---

## استكشاف الأخطاء (Troubleshooting)

| المشكلة | الحل المقترح |
|---|---|
| `Bot Token غير صحيح` عند الإنشاء | تأكد من نسخ التوكن كاملاً من BotFather بدون مسافات، وأنه لم يُحذف/يُجدَّد. |
| البوت لا يرد على `/start` | تأكد أن حالته "نشط" في لوحة التحكم، وأن الأمر مضاف فعلاً من صفحة إدارة الأوامر. |
| فقدان البيانات بعد إعادة النشر على استضافة سحابية | فعّل Persistent Disk أو انتقل إلى قاعدة بيانات خارجية مثل PostgreSQL. |
| خطأ 401 متكرر رغم تسجيل الدخول | الجلسة (JWT) منتهية الصلاحية (7 أيام) — سجّل الدخول من جديد. |
| تعارض عند تشغيل بوتين بنفس التوكن | النظام يمنع استخدام نفس Token لأكثر من بوت واحد على المنصة. |
| السيرفر لا يقلع بعد `npm install` | تأكد من إصدار Node.js 18+ (مطلوب لـ better-sqlite3 الحديثة). |

---

## الأخطاء المحتملة قبل الإنتاج (يجب مراجعتها)

- **بيئة بدون اتصال إنترنت أثناء التطوير:** تحقق التوكن (`getMe`) وتشغيل Telegraf يتطلبان اتصالاً بالإنترنت الخارجي؛ تأكد أن بيئة الاستضافة تسمح بذلك.
- **Polling متعدد النسخ:** إذا نشرت السيرفر على أكثر من instance في نفس الوقت (Render مع Scaling)، سيحاول كل instance تشغيل نفس البوتات النشطة عبر Polling، ما يسبب تعارضاً في Telegram API. في هذه الحالة استخدم instance واحد فقط، أو انتقل لاحقاً إلى Webhooks بدلاً من Polling.
- **JWT_SECRET الافتراضي:** لا تنشر المشروع في الإنتاج دون تغيير `JWT_SECRET` إلى قيمة عشوائية قوية.
- **النسخ الاحتياطي:** فعّل نسخاً احتياطية دورية لـ `strveon.db` قبل أي تحديث كبير.

---

## الاختبار اليدوي المقترح

قائمة تحقق قبل اعتبار النشر جاهزاً:

- [ ] `GET /api/health` يرجع `{"status":"ok"}`
- [ ] إنشاء حساب جديد (Register) + تسجيل دخول (Login)
- [ ] رفض بريد مستخدم من قبل ورفض كلمتي مرور غير متطابقتين
- [ ] إنشاء بوت بتوكن صحيح → نجاح + تشغيل تلقائي
- [ ] إنشاء بوت بتوكن خاطئ → رسالة خطأ واضحة
- [ ] عرض البوتات في لوحة التحكم
- [ ] تشغيل/إيقاف بوت من الواجهة
- [ ] حذف بوت (مع Confirmation) والتأكد من حذف أوامره
- [ ] إضافة أمر جديد ومنع تكراره لنفس البوت
- [ ] تعديل رد أمر وحذفه
- [ ] محاولة الوصول إلى بوت مستخدم آخر → رفض (403)
- [ ] إعادة تشغيل السيرفر والتأكد أن البوتات النشطة تعمل تلقائياً من جديد
- [ ] اختبار الواجهة على شاشة موبايل (Responsive)

---

## الترخيص

MIT — استخدم المشروع وطوّره بحرية.
