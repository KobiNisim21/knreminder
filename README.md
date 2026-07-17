# 🔔 KN Reminder

A personal reminder PWA inspired by **BZ Reminder** — built with the MERN stack.

- **Frontend**: React + Vite + Tailwind CSS (PWA, iOS home screen ready)
- **Backend**: Node.js + Express + Mongoose + Agenda.js
- **Database**: MongoDB Atlas (with 90-day TTL auto-cleanup)
- **Notifications**: Telegram Bot with Hebrew inline keyboard (Snooze / Done)

---

## 📁 Project Structure

```
kn-reminder/
├── client/       # React PWA (Vite + Tailwind)
├── server/       # Express API + Agenda.js scheduler
└── README.md
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js ≥ 18
- MongoDB Atlas account (free M0 cluster)
- Telegram Bot (see setup below)

### 1. Clone and install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment variables

```bash
cd server
cp .env.example .env
# Open .env and fill in your values (see Telegram setup below)
```

### 3. Run in development

Open **two terminals**:

```bash
# Terminal 1 — Backend (port 5000)
cd server
npm run dev

# Terminal 2 — Frontend (port 5173)
cd client
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:5000/api/health

---

## 🤖 Telegram Bot Setup (One-Time)

### Step 1 — Create your bot
1. Open Telegram and message **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **Bot Token** (looks like `123456:ABC-DEF...`)
4. Paste it into `server/.env` as `TELEGRAM_BOT_TOKEN`

### Step 2 — Get your Chat ID
1. Message your new bot (send `/start`) — this activates the chat
2. Visit this URL in your browser (replace `YOUR_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
3. In the response JSON, find `result[0].message.chat.id`
4. Paste it into `server/.env` as `TELEGRAM_CHAT_ID`

### Step 3 — Register webhook (production only)
After deploying to Railway/Render, call this endpoint **once**:

```bash
curl -X POST https://YOUR-SERVER-URL/api/telegram/setup-webhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR-SERVER-URL"}'
```

> **Local dev note**: The Telegram webhook requires a public HTTPS URL.
> For local testing, use [ngrok](https://ngrok.com/):
> ```bash
> ngrok http 5000
> # Then register the ngrok URL as webhook
> ```

---

## 🗄️ MongoDB Atlas Setup

1. Create a free **M0 cluster** at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user with read/write access
3. Get your connection string (Driver: Node.js 5.x):
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/kn-reminder?retryWrites=true&w=majority
   ```
4. Paste it into `server/.env` as `MONGO_URI`
5. In **Network Access** → add your IP (or `0.0.0.0/0` for Railway/Render)

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reminders` | All active reminders |
| `GET` | `/api/reminders/completed` | Completed (within 90-day window) |
| `GET` | `/api/reminders/:id` | Single reminder |
| `POST` | `/api/reminders` | Create + schedule reminder |
| `PATCH` | `/api/reminders/:id` | Edit reminder text/time |
| `PATCH` | `/api/reminders/:id/complete` | Mark as completed |
| `PATCH` | `/api/reminders/:id/snooze` | Snooze by N minutes |
| `DELETE` | `/api/reminders/:id` | Hard delete |
| `GET` | `/api/health` | Health check |

### Create reminder payload example:

```json
{
  "text": "לקנות מצרכים",
  "reminderAt": "2026-07-18T18:00:00.000Z",
  "isRecurring": true,
  "recurrence": {
    "frequency": "weekly"
  }
}
```

---

## 🔁 90-Day Retention (TTL Strategy)

The `Reminder` document has an `expiresAt` field:
- **Active reminders**: `expiresAt = null` → MongoDB TTL index ignores `null` → lives forever
- **Completed reminders**: `expiresAt = completedAt + 90 days` → auto-deleted by MongoDB

This is handled automatically by the pre-save hook in `server/models/Reminder.js`.

---

## 🚀 Deployment

### Frontend → Vercel
```bash
cd client
npm run build
npx vercel --prod
```
Set environment variable in Vercel dashboard:
- `VITE_API_URL` = `https://your-railway-app.railway.app`

### Backend → Railway
1. Push `server/` to a GitHub repo
2. Create a new Railway project → "Deploy from GitHub"
3. Set environment variables in Railway dashboard (copy from `.env.example`)
4. Railway auto-detects Node.js and runs `npm start`
5. After deploy, register the Telegram webhook (Step 3 above)

---

## 📱 iOS PWA Installation

1. Open the app in **Safari** on iPhone
2. Tap the **Share** button (□↑)
3. Tap **"Add to Home Screen"**
4. The app opens full-screen with no browser chrome

---

## License

MIT — Personal use
