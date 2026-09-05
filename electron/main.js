const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let serverProcess = null;
const PORT = 3000;

// ── Paths ─────────────────────────────────────────────────────
function getBackendPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend');
}

function getNodePath() {
  // When packaged, node is bundled inside resources
  if (app.isPackaged) {
    const nodePath = path.join(process.resourcesPath, 'node', 'node.exe');
    if (fs.existsSync(nodePath)) return nodePath;
  }
  return 'node'; // fall back to system node
}

// ── Auto-setup (first run) ────────────────────────────────────
function runSetup(backendPath) {
  return new Promise((resolve) => {
    const envPath = path.join(backendPath, '.env');
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath,
        `DATABASE_URL="file:./prisma/studyos.db"\nPORT=${PORT}\nJWT_SECRET=studyos-${Date.now()}-secret\n`
      );
    }
    // Run prisma db push to ensure schema is up to date
    const prisma = spawn('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
      cwd: backendPath,
      shell: true,
      windowsHide: true
    });
    prisma.on('close', () => resolve());
    setTimeout(resolve, 15000); // max 15s
  });
}

// ── Start Express server ──────────────────────────────────────
function startServer() {
  const backendPath = getBackendPath();
  const serverFile = path.join(backendPath, 'src', 'server.js');
  const nodeBin = getNodePath();

  const logPath = path.join(app.getPath('userData'), 'studyos.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  serverProcess = spawn(nodeBin, [serverFile], {
    cwd: backendPath,
    windowsHide: true,
    env: { ...process.env, PORT: String(PORT) }
  });

  serverProcess.stdout.pipe(logStream);
  serverProcess.stderr.pipe(logStream);
  serverProcess.on('exit', (code) => {
    if (!app.isQuiting) console.log('Server exited:', code);
  });
}

// ── Wait for server ready ─────────────────────────────────────
function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      http.get(`http://localhost:${PORT}/api/health`, (res) => {
        res.statusCode === 200 ? resolve() : retry(n);
      }).on('error', () => retry(n));
    };
    const retry = (n) => n <= 0 ? reject(new Error('Server timeout')) : setTimeout(() => check(n - 1), 500);
    check(retries);
  });
}

// ── Splash screen ─────────────────────────────────────────────
function showSplash() {
  const splash = new BrowserWindow({
    width: 380, height: 240,
    frame: false, alwaysOnTop: true,
    resizable: false, center: true,
    backgroundColor: '#0a0a0d',
    webPreferences: { nodeIntegration: false }
  });
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <!DOCTYPE html><html>
    <body style="margin:0;background:#0a0a0d;display:flex;flex-direction:column;
      align-items:center;justify-content:center;height:100vh;
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#eeeef4">
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#7c6fff,#a855f7);
        border-radius:18px;display:flex;align-items:center;justify-content:center;
        font-size:28px;font-weight:800;color:#fff;margin-bottom:20px;
        box-shadow:0 8px 32px rgba(124,111,255,0.45)">SO</div>
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.5px;margin-bottom:6px">StudyOS</div>
      <div style="font-size:13px;color:#9898ac;margin-bottom:32px">Personal Learning OS</div>
      <div id="msg" style="font-size:12px;color:#55556a">Starting...</div>
      <style>
        @keyframes spin{to{transform:rotate(360deg)}}
        .sp{width:28px;height:28px;border:3px solid #2a2a36;border-top-color:#7c6fff;
          border-radius:50%;animation:spin 0.8s linear infinite;margin-top:16px}
      </style>
      <div class="sp"></div>
    </body></html>
  `));
  return splash;
}

// ── Main window ───────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1100, minHeight: 700,
    backgroundColor: '#0a0a0d',
    show: false,
    title: 'StudyOS',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  mainWindow.loadURL(`http://localhost:${PORT}/desktop`);
  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.focus(); });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); mainWindow.hide(); }
  });
}

// ── System tray ───────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('StudyOS — Personal Learning OS');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '📚 StudyOS', enabled: false },
    { type: 'separator' },
    { label: 'Open StudyOS', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${PORT}/desktop`) },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
  ]));
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(async () => {
  const splash = showSplash();
  const backendPath = getBackendPath();

  try {
    await runSetup(backendPath);
    startServer();
    await waitForServer();
  } catch (e) {
    splash.close();
    dialog.showErrorBox('StudyOS Error',
      'Could not start the server.\n\nLog: ' + path.join(app.getPath('userData'), 'studyos.log')
    );
    app.quit();
    return;
  }

  splash.close();
  createTray();
  createMainWindow();
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('activate', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
app.on('before-quit', () => {
  app.isQuiting = true;
  if (serverProcess) serverProcess.kill();
});
