import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const platform = process.platform;

/**
 * Resolves the Ghostscript binary path.
 */
export function getGhostscriptPath(userOverride?: string): string {
  // 1. Check user override from DB first (if set and exists)
  if (userOverride && userOverride.trim() !== '') {
    if (fs.existsSync(userOverride)) {
      return userOverride;
    }
  }

  // Determine binary name & OS dir
  let binName = 'gs';
  let osDir = 'linux';
  if (platform === 'win32') {
    binName = 'gswin64c.exe';
    osDir = 'win';
  } else if (platform === 'darwin') {
    binName = 'gs';
    osDir = 'mac';
  }

  // 2. Resolve bundled path
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, 'ghostscript', binName)
    : path.join(app.getAppPath(), 'resources', 'ghostscript', osDir, binName);

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // 3. Fallback to system-installed auto-detection
  if (platform === 'win32') {
    const standardPaths = [
      'C:\\Program Files\\gs\\gs10.03.1\\bin\\gswin64c.exe',
      'C:\\Program Files\\gs\\gs10.03.0\\bin\\gswin64c.exe',
      'C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe',
      'C:\\Program Files\\gs\\gs10.02.0\\bin\\gswin64c.exe',
      'C:\\Program Files\\gs\\gs10.01.2\\bin\\gswin64c.exe',
      'C:\\Program Files\\gs\\gs10.01.1\\bin\\gswin64c.exe',
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return p;
    }
    // Try PATH via 'where'
    try {
      const execPath = execSync('where gswin64c').toString().split('\r\n')[0];
      if (execPath && fs.existsSync(execPath)) return execPath;
    } catch {}
    return 'gswin64c.exe'; // fallback to shell-resolved command
  } else if (platform === 'darwin') {
    const standardPaths = [
      '/opt/homebrew/bin/gs',
      '/usr/local/bin/gs',
      '/usr/bin/gs',
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return p;
    }
    // Try PATH via 'which'
    try {
      const execPath = execSync('which gs').toString().trim();
      if (execPath && fs.existsSync(execPath)) return execPath;
    } catch {}
    return 'gs';
  } else {
    // Linux
    const standardPaths = [
      '/usr/bin/gs',
      '/usr/local/bin/gs',
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return p;
    }
    try {
      const execPath = execSync('which gs').toString().trim();
      if (execPath && fs.existsSync(execPath)) return execPath;
    } catch {}
    return 'gs';
  }
}

/**
 * Resolves the LibreOffice binary path.
 */
export function getLibreOfficePath(userOverride?: string): string {
  // 1. Check user override from DB first (if set and exists)
  if (userOverride && userOverride.trim() !== '') {
    if (fs.existsSync(userOverride)) {
      return userOverride;
    }
  }

  // Determine binary name & OS dir
  let binName = 'soffice';
  let osDir = 'linux';
  if (platform === 'win32') {
    binName = 'soffice.exe';
    osDir = 'win';
  } else if (platform === 'darwin') {
    binName = 'soffice';
    osDir = 'mac';
  }

  // 2. Check if portable LibreOffice is bundled
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, 'libreoffice', binName)
    : path.join(app.getAppPath(), 'resources', 'libreoffice', osDir, binName);

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // 3. Fallback to standard system paths
  if (platform === 'win32') {
    const standardPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return p;
    }
    try {
      const execPath = execSync('where soffice').toString().split('\r\n')[0];
      if (execPath && fs.existsSync(execPath)) return execPath;
    } catch {}
    return 'soffice.exe';
  } else if (platform === 'darwin') {
    const standardPaths = [
      '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      '/usr/local/bin/soffice',
      '/opt/homebrew/bin/soffice',
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return p;
    }
    try {
      const execPath = execSync('which soffice').toString().trim();
      if (execPath && fs.existsSync(execPath)) return execPath;
    } catch {}
    return 'soffice';
  } else {
    // Linux
    const standardPaths = [
      '/usr/bin/soffice',
      '/usr/bin/libreoffice',
      '/usr/local/bin/soffice',
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return p;
    }
    try {
      const execPath = execSync('which soffice').toString().trim();
      if (execPath && fs.existsSync(execPath)) return execPath;
    } catch {}
    return 'soffice';
  }
}

/**
 * Resolves the Tesseract traineddata directory path.
 */
export function getTesseractDataPath(userOverride?: string): string {
  // 1. Check user override from DB first (if set and exists)
  if (userOverride && userOverride.trim() !== '') {
    if (fs.existsSync(userOverride)) {
      return userOverride;
    }
  }

  // 2. Resolve bundled path
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, 'tesseract-data')
    : path.join(app.getAppPath(), 'resources', 'tesseract-data');

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // 3. Fallback to userdata subfolder
  return path.join(app.getPath('userData'), 'tesseract-data');
}
