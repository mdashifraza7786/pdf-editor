import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { initDatabase, getHistory, getSetting, saveSetting } from './db';
import { initLicense, getActiveTier, activateLicense, deactivateLicense } from './license';
import { createApplicationMenu } from './menu';
import { getGhostscriptPath, getLibreOfficePath, getTesseractDataPath } from './utils/binResolver';

// Register IPC handlers
import { registerOrganizeHandlers } from './ipc/organize';
import { registerOptimizeHandlers } from './ipc/optimize';
import { registerConvertHandlers } from './ipc/convert';
import { registerEditHandlers } from './ipc/edit';
import { registerSecurityHandlers } from './ipc/security';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'iLovePDF Local',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    backgroundColor: '#1e293b' // smooth slate-800 loading color
  });

  // Enable Developer Tools and configure Native menu
  createApplicationMenu(mainWindow);

  // If in development mode, load Vite server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Security: restrict navigation and set CSP headers
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

app.whenReady().then(() => {
  // SQLite & License activation check
  initDatabase();
  initLicense();

  // Register IPC module methods
  registerOrganizeHandlers();
  registerOptimizeHandlers();
  registerConvertHandlers();
  registerEditHandlers();
  registerSecurityHandlers();

  // General Dialog & Config Handlers
  ipcMain.handle('dialog:open-files', async (_event, filters: { name: string; extensions: string[] }[]) => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters,
    });
    return res.filePaths;
  });

  ipcMain.handle('dialog:select-folder', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
    });
    return res.filePaths[0] || null;
  });

  // Shell open and locate actions
  ipcMain.handle('shell:open-path', async (_event, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle('shell:locate-file', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  // DB queries exposed to frontend
  ipcMain.handle('db:get-history', async () => {
    return getHistory();
  });

  ipcMain.handle('db:get-setting', async (_event, key: string, defaultValue?: string) => {
    return getSetting(key, defaultValue);
  });

  ipcMain.handle('db:save-setting', async (_event, key: string, value: string) => {
    saveSetting(key, value);
    return true;
  });

  ipcMain.handle('db:get-resolved-paths', async () => {
    const gsOverride = getSetting('ghostscript_path', '');
    const loOverride = getSetting('libreoffice_path', '');
    const tessOverride = getSetting('tesseract_data_path', '');

    return {
      gsPath: getGhostscriptPath(gsOverride),
      loPath: getLibreOfficePath(loOverride),
      tessDataPath: getTesseractDataPath(tessOverride)
    };
  });

  ipcMain.handle('file:read-binary', async (_event, filePath: string) => {
    const buffer = await fs.readFile(filePath);
    return new Uint8Array(buffer);
  });

  // License status check and operations
  ipcMain.handle('license:status', async () => {
    return {
      tier: getActiveTier(),
      isPro: getActiveTier() === 'PRO'
    };
  });

  ipcMain.handle('license:activate', async (_event, licenseKey: string) => {
    return activateLicense(licenseKey);
  });

  ipcMain.handle('license:deactivate', async () => {
    deactivateLicense();
    return { success: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
