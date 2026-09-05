# Building StudyOS .exe Installer

## Option A — GitHub Actions (Recommended)
The easiest way. GitHub builds the .exe for you automatically.

1. Push your code to GitHub
2. Create a release tag:
   ```
   git tag v2.0.0
   git push origin v2.0.0
   ```
3. GitHub Actions runs automatically
4. Go to your repo → **Releases** → download `StudyOS-Setup-2.0.0.exe`

---

## Option B — Build locally on Windows

### Prerequisites
```
npm install -g electron-builder
```

### Steps
```
# From the StudyOS root folder:
npm install
cd backend && npm install && npx prisma generate
cd ..
npm run build:win
```

The installer will be in the `dist/` folder as `StudyOS-Setup-2.0.0.exe`

---

## What the installer does
- Installs StudyOS to Program Files
- Creates Desktop shortcut
- Creates Start Menu entry
- Adds Uninstaller (via Windows Control Panel)
- Bundles Node.js — users don't need to install anything
