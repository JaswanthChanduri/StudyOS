<div align="center">

<h1>📚 StudyOS v2.0</h1>
<p><strong>Personal Learning & Productivity OS</strong></p>

![Version](https://img.shields.io/badge/version-2.0.0-7c6fff?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows)

**[⬇️ Download Windows App (.exe)](https://github.com/YOUR_USERNAME/studyos/releases/latest)**
&nbsp;&nbsp;·&nbsp;&nbsp;
**[⬇️ Download Source (Node.js required)](https://github.com/YOUR_USERNAME/studyos/releases/latest)**

</div>

---

## ⚡ Quick Start

### Windows App — No Node.js needed
```
1. Download StudyOS-Setup.exe from Releases
2. Double-click → Install
3. Open from Desktop shortcut
```

### From Source — Needs Node.js
```
1. Install Node.js from nodejs.org
2. Download source zip from Releases → extract
3. Double-click StudyOS.vbs
```

---

## ✨ Features

| | Feature | Description |
|--|---------|-------------|
| 📅 | **Daily Planner** | Timer sessions with 0–100pt scoring, 50% time lock |
| 🔥 | **Streak Tracking** | Real streaks with milestone badges |
| 📊 | **Study Tracker** | 6-month heatmap, Chart.js graphs |
| 🗺️ | **10 Roadmaps** | Python · SQL · Excel · AI-900 · Power BI · NumPy · Pandas · Stats · ML · Deep Learning |
| 🤖 | **AI Advisor** | Claude · ChatGPT · Gemini — pick any |
| 📝 | **Notes & Reminders** | Color notes, custom repeat reminders |
| 🔔 | **Custom Alarms** | 5 tones, volume control, manual alarm setter |
| ⏱️ | **Stopwatch** | Lap timer |
| 🎖️ | **Achievements** | Progress badges |
| 👥 | **Multi-user** | Separate accounts with own data |

---

## 🤖 AI Setup (Optional but Recommended)

Open StudyOS → **Settings → AI Settings** → pick a provider:

| Provider | Free? | Get Key |
|----------|-------|---------|
| 🔵 Gemini | ✅ Free | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| 🟣 Claude | ✅ Free credits | [console.anthropic.com](https://console.anthropic.com) |
| 🟢 ChatGPT | ❌ Paid | [platform.openai.com](https://platform.openai.com/api-keys) |

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Database | SQLite + Prisma ORM |
| Auth | JWT |
| Frontend | Vanilla HTML/CSS/JS |
| Desktop App | Electron |
| Charts | Chart.js |
| AI | Anthropic / OpenAI / Google APIs |

---

## 📁 Project Structure

```
studyos/
├── StudyOS.vbs              ← Launch without CMD (Node.js required)
├── StudyOS.bat              ← Server starter
├── electron/main.js         ← Desktop app entry point
├── package.json             ← Electron build config
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── middleware/auth.js
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── tasks.js
│   │       ├── analytics.js
│   │       ├── notes.js
│   │       ├── reminders.js
│   │       ├── roadmap.js
│   │       ├── settings.js
│   │       └── ai.js
│   └── prisma/schema.prisma
└── frontend-desktop/
    └── index.html
```

---

## 🧑‍💻 Build the .exe locally

```bash
# Install dependencies
npm install
cd backend && npm install && npx prisma generate && cd ..

# Build Windows installer
npm run build
# Output: dist/StudyOS-Setup-2.0.0.exe
```

---

## 📄 License
MIT — free to use, modify, and share.

---
<div align="center">Built for consistent learners 📚</div>
