import React, { useEffect, useState } from 'react';
import { LicenseStatus } from '../types';
import { Folder, Key, ShieldCheck, HelpCircle, HardDrive, RefreshCw, LogOut, ChevronDown, ChevronUp } from 'lucide-react';

interface SettingsProps {
  license: LicenseStatus;
  setLicense: React.Dispatch<React.SetStateAction<LicenseStatus>>;
}

export default function Settings({ license, setLicense }: SettingsProps) {
  const [outputFolder, setOutputFolder] = useState('');
  const [loPath, setLoPath] = useState('');
  const [gsPath, setGsPath] = useState('');
  const [tessDataPath, setTessDataPath] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [resolvedPaths, setResolvedPaths] = useState({ gsPath: '', loPath: '', tessDataPath: '' });

  // Licensing activation input states
  const [licenseInput, setLicenseInput] = useState('');
  const [licError, setLicError] = useState('');
  const [licSuccess, setLicSuccess] = useState('');

  const loadSettings = async () => {
    try {
      const folder = await window.electronAPI.getSetting('default_output_folder', '');
      const lo = await window.electronAPI.getSetting('libreoffice_path', '');
      const gs = await window.electronAPI.getSetting('ghostscript_path', '');
      const tess = await window.electronAPI.getSetting('tesseract_data_path', '');

      setOutputFolder(folder);
      setLoPath(lo);
      setGsPath(gs);
      setTessDataPath(tess);

      const resolved = await window.electronAPI.getResolvedPaths();
      setResolvedPaths(resolved);
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const selectFolder = async (settingKey: string, setVal: (v: string) => void) => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) {
        await window.electronAPI.saveSetting(settingKey, path);
        setVal(path);
      }
    } catch (err) {
      console.error('Failed to select directory', err);
    }
  };

  const saveTextSetting = async (key: string, value: string, setVal: (v: string) => void) => {
    await window.electronAPI.saveSetting(key, value);
    setVal(value);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLicError('');
    setLicSuccess('');

    if (!licenseInput.trim()) {
      setLicError('Please paste your license key.');
      return;
    }

    try {
      const res = await window.electronAPI.activateLicense(licenseInput.trim());
      if (res.success) {
        setLicSuccess(res.message);
        setLicenseInput('');
        // Update global license tier state
        const status = await window.electronAPI.getLicenseStatus();
        setLicense(status);
      } else {
        setLicError(res.message || 'Verification failed. Double check your key signature.');
      }
    } catch (err: any) {
      setLicError(err.message || 'An error occurred during key signature validation.');
    }
  };

  const handleDeactivate = async () => {
    try {
      await window.electronAPI.deactivateLicense();
      const status = await window.electronAPI.getLicenseStatus();
      setLicense(status);
      setLicSuccess('License deactivated.');
    } catch (err) {
      console.error('Deactivation failed', err);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="pb-2 border-b border-border">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Application Settings</h2>
        <p className="text-xs text-muted-foreground mt-1.5 font-bold leading-relaxed">
          Configure local workspace directories, paths to office plugins, and activate licensing keys.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT COLUMN: CORE PREFERENCES */}
        <div className="md:col-span-2 space-y-6">
          {/* FOLDER PATHS */}
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <HardDrive className="w-4 h-4 text-primary" />
              Workspace Directories
            </h3>

            {/* DEFAULT SAVE FOLDER */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider">Default Output Folder</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  placeholder="System downloads folder will be used"
                  value={outputFolder}
                  className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none text-foreground shadow-sm"
                />
                <button
                  onClick={() => selectFolder('default_output_folder', setOutputFolder)}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors duration-150 text-foreground shadow-sm"
                >
                  <Folder className="w-3.5 h-3.5" />
                  Browse
                </button>
              </div>
            </div>
          </div>

          {/* ADVANCED ACCORDION */}
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-sm font-bold text-foreground focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                Advanced Settings (optional override)
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4 animate-bounce" /> : <ChevronDown className="w-4 h-4 animate-bounce" />}
            </button>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              By default, the app automatically runs pre-bundled binaries. You can configure manual path overrides below if needed.
            </p>

            {showAdvanced && (
              <div className="space-y-5 pt-3 border-t border-border transition-all duration-300">
                {/* TESSERACT OCR DATA PATH */}
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider">Tesseract traineddata Folder Override</label>
                    <span className="text-[9px] text-primary/75 font-semibold font-mono truncate">Active: {resolvedPaths.tessDataPath}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      placeholder={resolvedPaths.tessDataPath || "Auto-detecting path..."}
                      value={tessDataPath}
                      className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none text-foreground shadow-sm placeholder:text-muted-foreground/60"
                    />
                    <button
                      onClick={() => selectFolder('tesseract_data_path', setTessDataPath)}
                      className="px-4 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors duration-150 text-foreground shadow-sm"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      Browse
                    </button>
                  </div>
                </div>

                {/* LIBREOFFICE SOFFICE BINARY */}
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider">LibreOffice soffice Path Override</label>
                    <span className="text-[9px] text-primary/75 font-semibold font-mono truncate">Active: {resolvedPaths.loPath}</span>
                  </div>
                  <input
                    type="text"
                    placeholder={resolvedPaths.loPath || "e.g. /Applications/LibreOffice.app/Contents/MacOS/soffice"}
                    value={loPath}
                    onChange={(e) => saveTextSetting('libreoffice_path', e.target.value, setLoPath)}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none text-foreground focus:border-primary/30 transition-colors duration-150 shadow-sm placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* GHOSTSCRIPT BINARY */}
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider">Ghostscript Path Override</label>
                    <span className="text-[9px] text-primary/75 font-semibold font-mono truncate">Active: {resolvedPaths.gsPath}</span>
                  </div>
                  <input
                    type="text"
                    placeholder={resolvedPaths.gsPath || "e.g. /usr/local/bin/gs"}
                    value={gsPath}
                    onChange={(e) => saveTextSetting('ghostscript_path', e.target.value, setGsPath)}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none text-foreground focus:border-primary/30 transition-colors duration-150 shadow-sm placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LICENSE REGISTRATION */}
        <div className="space-y-6">
          <div className={`glass-panel border rounded-2xl p-6 flex flex-col justify-between h-full ${
            license.isPro ? 'border-primary/30 bg-primary/5' : 'border-border'
          }`}>
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Key className="w-4 h-4 text-primary" />
                License Manager
              </h3>

              {license.isPro ? (
                /* PRO LICENSE METADATA */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center space-y-2">
                    <ShieldCheck className="w-8 h-8 text-primary mx-auto" />
                    <p className="text-sm font-bold text-foreground">PRO License Activated</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Offline key validated cryptographically via RSA-2048 signature checking.</p>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Tier Status</span>
                      <span className="font-bold text-primary">Pro Lifetime License</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Usage Bounds</span>
                      <span className="font-bold text-foreground">Unlimited Files / No Caps</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDeactivate}
                    className="w-full py-2.5 border border-border hover:border-primary/30 hover:text-primary rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 text-muted-foreground bg-card"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Deactivate License
                  </button>
                </div>
              ) : (
                /* FREE ACTIVATION FORM */
                <form onSubmit={handleActivate} className="space-y-4">
                  <div className="p-4 rounded-xl bg-secondary/40 border border-border text-center space-y-1.5">
                    <p className="text-xs font-bold text-foreground">Upgrade to PRO Features</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Unlocks batch processing of more than 2 files, file sizes above 10MB, and premium tools (LibreOffice conversion, OCR, Repair, page removal/extraction).</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Paste License Key</label>
                    <textarea
                      placeholder="Paste your base64.signature license string..."
                      value={licenseInput}
                      onChange={(e) => setLicenseInput(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-xs placeholder:text-muted-foreground/50 outline-none text-foreground focus:border-primary/30 font-mono transition-colors duration-150 resize-none shadow-sm"
                    />
                  </div>

                  {licError && <p className="text-[11px] font-bold text-primary bg-primary/5 p-2.5 rounded-lg border border-primary/10">{licError}</p>}
                  {licSuccess && <p className="text-[11px] font-bold text-emerald-600 bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-550/15">{licSuccess}</p>}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 shadow-md shadow-primary/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Activate Offline Key
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
