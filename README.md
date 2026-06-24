# iLovePDF Offline Local Desktop App

A feature-complete, production-ready, local-first offline clone of iLovePDF.

## Tech Stack
- **Electron** (Main/Renderer/Preload split architecture)
- **React** (Frontend UI with Tailwind CSS & shadcn/ui)
- **TypeScript** (Strong typing across IPC boundary)
- **SQLite** (History logs, settings, and license info using `better-sqlite3`)
- **PDF Manipulation** (Local `pdf-lib` and `pdfjs-dist`)
- **OCR** (Tesseract.js running offline)
- **Office Conversions** (Headless LibreOffice)
- **Licensing** (Asymmetric crypto signed license keys validated offline)

---

## Folder Structure

```
pdf-editor/
├── resources/            # Local binary and language resources
│   ├── bin/              # Placed Ghostscript and LibreOffice binary scripts
│   └── tesseract-data/   # Local traineddata OCR lang files (e.g. eng.traineddata)
├── src/
│   ├── main/             # Electron main process (DB, License system, IPC handlers)
│   ├── preload/          # Electron preload scripts (safe contextBridge)
│   └── renderer/         # React Application UI (Vite bundler)
```

---

## Developer Guide & Setup

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed on your system.

### 2. Install Dependencies
Install all package dependencies and compile native dependencies:
```bash
npm install
```

### 3. Extra Resources Setup (Ghostscript, LibreOffice, Tesseract)
For full offline support of office conversions, compression, and OCR:

#### LibreOffice Setup:
- Install LibreOffice on your machine.
- Under Settings in the App, specify the path to your LibreOffice binary:
  - macOS default: `/Applications/LibreOffice.app/Contents/MacOS/soffice`
  - Windows default: `C:\Program Files\LibreOffice\program\soffice.exe`
  - Linux default: `/usr/bin/soffice`

#### OCR Tesseract Setup:
- Place `eng.traineddata` in the `resources/tesseract-data/` folder.
- You can download language datasets directly from:
  `https://github.com/tessdoc/tessdata/raw/main/eng.traineddata`

---

## Generating a License Key for Development

This app uses offline RSA signature validation. To activate **Pro Tier features** locally, you can generate a signed key using Node's cryptographic module.

Create a temporary file `generate_key.js` and run it:
```javascript
const crypto = require('crypto');

// Generate standard 2048-bit keys
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

console.log("Save the Public Key in src/main/license.ts:");
console.log(publicKey.export({ type: 'spki', format: 'pem' }).toString());

const licenseData = {
  email: "pro-user@example.com",
  tier: "PRO",
  expires: "2030-12-31T23:59:59Z"
};

const payloadB64 = Buffer.from(JSON.stringify(licenseData)).toString('base64');

const sign = crypto.createSign('SHA256');
sign.update(payloadB64);
const signatureHex = sign.sign(privateKey, 'hex');

const licenseKey = `${payloadB64}.${signatureHex}`;
console.log("\nCopy-paste this License Key into the Settings Screen:");
console.log(licenseKey);
```

---

## Scripts

### Run Development App
To launch the application in development mode:
```bash
npm run dev
```

### Compile Production React & Preload Assets
To verify compiler safety and compile Vite assets:
```bash
npm run build
```

### Package App
Build and package the Electron application for distribution:
```bash
npm run package
```
*Note: Targets are configured in `electron-builder.yml` (.dmg for macOS, .exe for Windows, .AppImage for Linux).*
