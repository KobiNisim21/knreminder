# סיכום פרויקט מקיף ומסמך העברת מקל (Handoff) — KN Reminder

מסמך זה מסכם את כל העבודה שבוצעה בפרויקט **KN Reminder** מתחילתו ועד היום (19 ביולי 2026). הוא מפרט את הארכיטקטורה, מבנה הנתונים, השירותים השונים, שלבי הפיתוח, באגים שנפתרו והוראות המשך עבודה עבור הסוכן הבא.

---

## 1. סקירת הפרויקט (Project Overview)
**KN Reminder** היא אפליקציית תזכורות אישית המעוצבת ומנוהלת בגישת Mobile-First, ומיועדת להיראות ולהרגיש כמו אפליקציית iOS טבעית (Native) ללא צורך בהורדה מחנות האפליקציות. האפליקציה שואבת השראה עיצובית ופונקציונלית מאפליקציית "BZ Reminder".

### תכונות ליבה:
1. **עיצוב Mobile-First & iOS-Native**: ממשק משתמש מותאם למסכי מובייל (בדגש על iPhone), תמיכה מלאה בעברית (RTL), גלילה חלקה, מחוות מגע (Swipe) ומניעת זום או התנהגות דפדפן רגילה.
2. **ציר זמן תזכורות (Timeline Dashboard)**: חלוקה ברורה לפי ימים (היום, מחר, עתידי) עם כותרות דביקות (Sticky) וגישה מהירה להוספה.
3. **מנגנון חזרה (Recurrence)**: תזכורות חוזרות (יומי, שבועי, חודשי, שנתי).
4. **אינטגרציה מלאה עם Telegram**: הבוט שולח הודעות בזמן אמת ומציע כפתורי פעולה מובנים (Inline Keyboard) לביצוע ("בוצע") או לדחייה ("סנוז 15 דק'", "סנוז שעה").
5. **מנגנון השהייה (Snooze)**: אפשרות לדחות תזכורות הן מהממשק והן ישירות מטלגרם.
6. **לוח שנה (Calendar View)**: תצוגה חודשית בעברית עם נקודות חיווי צבעוניות לכמות התזכורות לכל יום וסינון לפי ימים.
7. **שמירת היסטוריה מוגבלת (90-Day TTL)**: העברת תזכורות שהושלמו לארכיון שנמחק אוטומטית ממסד הנתונים לאחר 90 יום (לשמירה על ביצועים).
8. **Progressive Web App (PWA)**: התקנה על מסך הבית, עבודה במצב לא מקוון (Offline Caching) ומסכי פתיחה מותאמים ל-iOS.

---

## 2. ארכיטקטורה וטכנולוגיות (Tech Stack)

### Frontend (לקוח)
- **Framework**: React.js (Vite)
- **Styling**: Tailwind CSS, CSS Vanilla מותאם אישית (`index.css` לעיצוב רכיבי מובייל כמו תופי גלילה וכפתורי מגע)
- **State & Data Fetching**: `@tanstack/react-query` (ניהול מטמון, סנכרון אוטומטי ורענון ברקע)
- **Routing**: `react-router-dom`
- **PWA**: Service Worker מותאם אישית (`sw.js`) לניהול מטמון במצב אופליין (Cache-First לנכסים סטטיים, Network-First עם timeout של 5 שניות ל-APIs).

### Backend (שרת)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Scheduler**: **Agenda.js** (מנוע תזמון מבוסס MongoDB, עמיד בפני קריסות ואתחולים של השרת, פועל במחזוריות בדיקה של 30 שניות)
- **API Clients**: `axios` (לתקשורת מול הבוט של טלגרם)

### Database (מסד נתונים)
- **DB**: MongoDB Atlas
- **ODM**: Mongoose
- **מבנה אוספים (Collections)**:
  - `reminders`: מסמכי התזכורות (כולל אינדקס TTL המוגדר על שדה `expiresAt` למחיקה אוטומטית לאחר 90 יום).
  - `agendaJobs`: אוסף פנימי שנוצר ומנוהל ע"י Agenda.js לשמירת משימות התזמון.

### Hosting (אירוח)
- **Client**: Vercel (https://knreminder.vercel.app)
- **Server**: Northflank (Developer Sandbox) - מספק שרת פרודקשן יציב ופעיל תמיד (Always-on compute) שאינו נכנס למצב שינה, מה שחיוני לפעולת ה-scheduler של Agenda.

---

## 3. מבנה מסד הנתונים (Database Schemas)

### Reminder Schema (`server/models/Reminder.js`)
```javascript
const reminderSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  reminderAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'snoozed', 'completed'], default: 'active' },
  isRecurring: { type: Boolean, default: false },
  recurrence: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] }
  },
  snoozeCount: { type: Number, default: 0 },
  originalReminderAt: { type: Date }, // נשמר בעת הסנוז הראשון כדי לדעת מתי התזכורת הייתה אמורה לפעול במקור
  notified: { type: Boolean, default: false },
  completedAt: { type: Date },
  expiresAt: { type: Date }, // שדה ה-TTL (MongoDB מוחק את המסמך ברגע שזמן זה מגיע)
  agendaJobId: { type: String } // מפתח המשימה המקושרת ב-Agenda.js
});
```
- **TTL Index**: מוגדר ב-Mongoose על שדה `expiresAt` עם `expireAfterSeconds: 0`. שדה זה מחושב אוטומטית ב-Pre-save middleware ברגע שהסטטוס משתנה ל-`completed` (מוגדר ל-90 ימים קדימה).

---

## 4. פירוט השירותים (Backend Services)

### א. תזמון משימות: `server/services/agendaService.js`
- מאתחל מופע סינגלטון של Agenda המחובר ל-MongoDB Atlas.
- מגדיר את המשימה `'send reminder'`:
  - טוען בצורה עצלה (Lazy require) את `telegramService` על מנת למנוע תלות מעגלית (Circular Dependency) בזמן טעינת השרת.
  - מושך את נתוני התזכורת.
  - שולח הודעה לטלגרם בעזרת הבוט.
  - בתזכורת חד-פעמית: מסמן `notified = true`.
  - בתזכורת מחזורית: מקדם את תאריך התזכורת (`reminderAt`) למופע הבא (יומי/שבועי/וכו') ומשחזר משימה חדשה ב-Agenda.
- מציע פונקציות עזר ציבוריות: `scheduleReminder` (העובדת בצורה אידמפוטנטית על ידי ביטול משימות קודמות של אותה תזכורת ויצירת חדשה) ו-`cancelReminderJob`.

### ב. שירות טלגרם: `server/services/telegramService.js`
מטפל בכל הלוגיקה מול ה-Telegram Bot API:
- **`sendReminderNotification(reminder)`**: בונה הודעה מעוצבת בעברית RTL עם כפתורי inline לפעולות המהירות:
  - `"⏰ סנוז 15 דק'"` -> callback_data: `snooze_15_<id>`
  - `"⏰ סנוז שעה"` -> callback_data: `snooze_60_<id>`
  - `"✅ בוצע"` -> callback_data: `done_<id>`
- **`handleTelegramUpdate(update)`**: שירות מרכזי המעבד עדכונים מטלגרם (הודעות רגילות וכן לחיצות על כפתורי ה-Inline - `callback_query`):
  - מזהה את הלחיצה ומבצע אקטיבית את השינוי ב-DB (ביצוע סנוז ועדכון ה-Scheduler, או סימון כהושלם וביטול משימת ה-Scheduler).
  - מעדכן את הודעת הטלגרם המקורית (מסיר את כפתורי הפעולה ורושם סטטוס סופי כמו "✅ בוצע" או "💤 נדחה ב-15 דקות" כדי למנוע לחיצות כפולות).
- **מצב פיתוח (Dev Long-Polling)**: בשרת מקומי אין כתובת HTTPS ציבורית לקבלת Webhooks. השירות כולל פונקציית `startPolling` המבצעת לופ `getUpdates` ברקע בזמן פיתוח (אם `NODE_ENV !== 'production'`). המנגנון דואג למחוק את ה-webhook הקיים לפני תחילת ה-polling כדי לאפשר עבודה מקומית חלקה ללא צורך ב-ngrok.
- **מצב ייצור (Production Webhook)**: מציע פונקציות רישום ומחיקה של Webhook מול שרתי טלגרם.

---

## 5. נקודות הקצה של ה-API (Backend Routing)

### א. תזכורות: `server/routes/reminders.js`
- `GET /api/reminders` - החזרת כל התזכורות הפעילות (active/snoozed).
- `GET /api/reminders/completed` - החזרת תזכורות שהושלמו (לפי סדר השלמה יורד).
- `POST /api/reminders` - יצירת תזכורת חדשה ותזמונה ב-Agenda.
- `PATCH /api/reminders/:id` - עדכון פרטי תזכורת (משחזר משימה ב-Agenda במידה והזמן או המחזוריות השתנו).
- `PATCH /api/reminders/:id/complete` - סימון ידני כהושלם (מבטל את המשימה ב-Agenda ומחשב TTL).
- `PATCH /api/reminders/:id/snooze` - ביצוע סנוז ידני לפי מספר דקות מבוקש.
- `DELETE /api/reminders/:id` - מחיקה מלאה של תזכורת וביטול המשימה ב-Agenda.

### ב. טלגרם: `server/routes/telegram.js`
- `POST /api/telegram/webhook` - קבלת עדכונים משרתי טלגרם (מנתב ל-`handleTelegramUpdate`).
- `GET /api/telegram/status` - בדיקת תקינות ה-Token של הבוט וקבלת פרטי הבוט.
- `POST /api/telegram/test-notification` - שליחת הודעת בדיקה מיידית למשתמש (לאימות הגדרות ה-`.env`).
- `POST /api/telegram/fire/:id` - שיגור מיידי של הודעת תזכורת קיימת לטלגרם (לצרכי פיתוח ובדיקות בלבד - חסום בפרודקשן).
- `POST /api/telegram/setup-webhook` - רישום ה-Webhook (נשלח עליו גוף הבקשה `{ "url": "https://..." }`).
- `POST /api/telegram/delete-webhook` - הסרת ה-Webhook.

---

## 6. באגים קריטיים שנפתרו (Bug Fixes Log)

במהלך הפיתוח והבדיקות במכשירים פיזיים (כמו אייפון), נתקלנו במספר באגים משמעותיים שנפתרו בהצלחה:

1. **תקלות CORS בייצור**: 
   השרת הוגדר לעבוד מול מערך מקורות מאושרים (Allowed Origins) דינמי הכולל את השרת המקומי ב-dev ואת כתובת הפרודקשן של הלקוח ב-Vercel (`https://knreminder.vercel.app`).
2. **באג "is not iterable" ב-React Query**: 
   ה-Response Interceptor של Axios החזיר ישירות את `response.data` (הגוף עצמו). הפונקציות ב-`useReminders.js` ניסו לבצע קריאה חוזרת ל-`.data` על אובייקט שכבר פורק, מה שהוביל לקריסות של `undefined is not iterable` בזמן הרינדור. הוספנו מנגנון חילוץ בטוח (`Array.isArray(body) ? body : body?.data ?? []`) המונע קריסות ומחזיר מערך ריק במקרה של שגיאה או טעינה.
3. **באג "is not iterable (intermediate value)" בשמירה**:
   בעת הוספת תזכורת, היא נשמרה ב-DB אך המודל סירב להיסגר והציג שגיאה זו. מקור הבאג היה בשרת ב-`agendaService.js`: בעת קריאה ל-`ag.schedule` בוצע פירוק מערך לא נכון (`const [job] = await ag.schedule(...)`), בעוד שבגרסאות מתקדמות של Agenda הפונקציה מחזירה אובייקט יחיד ולא מערך. הפירוק שונה ל-`const job = await ag.schedule(...)` והשגיאה נפתרה לחלוטין.
4. **עדכון ממשק איטי (Auto-Refresh delay)**:
   החלפנו את השימוש ב-`invalidateQueries` של React Query ל-`refetchQueries({ type: 'active' })` בכל המוטציות (הוספה, עריכה, מחיקה, השלמה, סנוז). דבר זה מאלץ רענון רשת מיידי של נתוני הדשבורד ברגע ביצוע הפעולה במקום להמתין לפול המתוזמן (60 שניות).
5. **טקסט בלתי נראה ב-DateTimePicker ב-iOS**:
   באייפון (Safari Mobile), הטקסט של תוף הגלילה נעלם עקב שילוב של שכבות גרדיאנט ומאפייני שקיפות של Tailwind (`text-opacity`). פתרנו זאת על ידי הסרת שכבות הגרדיאנט הסטטיות (והחלפתן בקווי גבול עליון/תחתון נקיים כמו ב-iOS המקורי) והגדרת צבעים מפורשים ב-inline CSS בעזרת ערכי `rgba()` יציבים לצד תכונת `-webkit-text-fill-color`.
6. **כפתור ה-FAB (+) צף מעל המודאלים**:
   כפתור ה-+ האדום של הניווט התחתון הציג בעיית זליגה (Bleed through) והופיע מעל המודאלים הנגללים. פתרנו זאת על ידי הוספת פרופ `anyModalOpen` לרכיב `BottomNav`. כאשר מודאל כלשהו פתוח, הכפתור מקבל קלאסים של שקיפות 0 וביטול אינטראקציה (`opacity-0 pointer-events-none`) עם מעבר CSS חלק.

---

## 7. תצורת משתני סביבה (`.env` Config)

בספריית ה-`server/` יש להחזיק קובץ `.env` המכיל את הפרטים הבאים:

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/knreminder
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=987654321
CLIENT_URL=https://knreminder.vercel.app
TZ=Asia/Jerusalem
```

- **הערה חשובה**: בשרת Northflank, הגדרנו את משתני הסביבה הללו ישירות דרך פאנל הניהול של השירות (تحת Variables).

---

## 8. הוראות הפעלה מקומית (Local Development)

### א. הרצת השרת (Backend)
```bash
cd server
npm install
npm run dev
```
השרת ירוץ בפורט 5000, יתחבר ל-MongoDB Atlas, יפעיל את Agenda, ויפעיל אוטומטית מנגנון Long Polling לעדכוני טלגרם מקומיים.

### ב. הרצת הלקוח (Frontend)
יש לוודא קיום קובץ `.env` בתיקיית `client/` המכיל:
```env
VITE_API_URL=http://localhost:5000
```
לאחר מכן:
```bash
cd client
npm install
npm run dev
```
הלקוח ירוץ בכתובת `http://localhost:5173`.

### ג. הרצת מבדקי טלגרם עצמאיים
בנינו סקריפט מיוחד שבודק את החיבור לטלגרם, את תקינות הבוט ושולח הודעה עם כפתורי inline ישירות לצ'אט שלך ללא תלות במסד הנתונים:
```bash
cd server
npm run test:telegram
```

---

## 9. משימות פתוחות והנחיות לסוכן הבא (Next Steps for Next Agent)

כאשר הסוכן הבא מתחיל לעבוד, מומלץ שיעבור על המשימות הבאות:

1. **פיתוח מסך "ימי הולדת" (Birthdays tab)**:
   כיום, הטאב הרביעי ב-`BottomNav` מפנה זמנית למסך "הושלמו" (`/completed`). יש לפתח רכיב ומסך ייעודיים לימי הולדת (`/birthdays`), להוסיף שדה מתאים ב-Schema (למשל סוג תזכורת 'birthday') ולייצר חזרה שנתית מותאמת.
2. **הגדרות מתקדמות במסך "יותר" (More tab)**:
   הטאב הראשון בניווט מיועד להגדרות אפליקציה (כמו שינוי Chat ID של טלגרם מתוך הממשק, שינוי ברירות מחדל של זמני סנוז, בחירת ערכת נושא ועוד). כיום הוא אינו מנווט לפעולה ממשית.
3. **בדיקת עמידות משימות Agenda**:
   לוודא שהשרת ב-Northflank אכן מחזיק את ה-scheduler דולק ומבצע פניות חוזרות ברמת דיוק של חצי דקה.
4. **ניהול הרשאות והתחברות (Auth)**:
   כיום האפליקציה מניחה משתמש יחיד (Single User) ועובדת מול ה-`TELEGRAM_CHAT_ID` המוגדר בשרת. בהמשך, אם תרצה להפוך את האפליקציה לרב-משתמשית (Multi-user), יהיה צורך במנגנון רישום/התחברות (למשל Google Auth או Telegram Login) ושמירת ה-`chatId` של כל משתמש במסמך המשתמש שלו ב-DB.
