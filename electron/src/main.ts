/**
 * Kawdly People — Electron main process.
 *
 * T1 SCAFFOLDING ONLY. This file currently does one thing: open a window with the
 * approved security posture and load a placeholder URL.
 *
 * Deliberately NOT here yet (later E2 tasks — see E2-Implementation-Plan.md §13):
 *   T4  port picking, PHP spawn (cwd = <backend>/public), readiness probe, supervision,
 *       shutdown (kill -> taskkill /T /F) and orphan reaping
 *   T7  config delivery via additionalArguments, CSP injection (onHeadersReceived),
 *       navigation / window-open / permission guards
 *   T8  splash window + fatal-error window (stderr tail, Retry / Open logs / Quit)
 *   T9  first-run userData layout, Node-generated APP_KEY, DB template, migrations
 *   --  single-instance lock, log files, menu, auto-update
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';

/**
 * Placeholder entry point.
 *
 * T4 replaces this with `http://127.0.0.1:${port}/app/` once the PHP child process
 * has passed the readiness probe. `about:blank` is used until then so the scaffolding
 * cannot accidentally load anything remote.
 */
const PLACEHOLDER_URL = process.env['KAWDLY_DEV_BACKEND_URL'] ?? 'about:blank';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0b1220',
    // T8: create hidden and show() only after the backend is ready.
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // Security posture — Electron-Packaging-Design.md §4.6 / E2 plan §8.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });

  void mainWindow.loadURL(PLACEHOLDER_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Must be called before the app is ready. Forces the sandbox on every renderer.
app.enableSandbox();

void app.whenReady().then(() => {
  createWindow();

  // macOS: re-create the window when the dock icon is clicked and nothing is open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // T4 adds the PHP child teardown here, before quit.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
