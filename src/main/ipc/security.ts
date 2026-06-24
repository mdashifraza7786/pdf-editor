import { ipcMain } from 'electron';
import { exec } from 'child_process';
import fsSync from 'fs';
import { checkBatchLimits, checkToolAccess } from '../license';
import { saveHistory, getSetting } from '../db';
import crypto from 'crypto';
import { getGhostscriptPath } from '../utils/binResolver';

export function registerSecurityHandlers() {
  // PROTECT
  ipcMain.handle(
    'tool:protect',
    async (
      _event,
      filePath: string,
      outputPath: string,
      userPassword: string,
      ownerPassword?: string
    ) => {
      const check = checkToolAccess('protect');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const gsPath = getGhostscriptPath(getSetting('ghostscript_path', ''));
        const ownerPwd = ownerPassword || userPassword;

        const runGhostscriptProtect = () => {
          return new Promise<void>((resolve, reject) => {
            const cmd = `"${gsPath}" -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -sOwnerPassword="${ownerPwd}" -sUserPassword="${userPassword}" -sOutputFile="${outputPath}" "${filePath}"`;
            exec(cmd, (error) => {
              if (error) {
                if (!fsSync.existsSync(gsPath)) {
                  reject(new Error(`Ghostscript binary not found at "${gsPath}". Please check your Advanced settings or install Ghostscript.`));
                } else {
                  reject(new Error(`Encryption failed. Make sure Ghostscript is configured in settings. Error: ${error.message}`));
                }
              }
              else resolve();
            });
          });
        };

        await runGhostscriptProtect();

        saveHistory({
          id: historyId,
          tool_name: 'Protect PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Protect PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // UNLOCK
  ipcMain.handle(
    'tool:unlock',
    async (_event, filePath: string, outputPath: string, password?: string) => {
      const check = checkToolAccess('unlock');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const gsPath = getGhostscriptPath(getSetting('ghostscript_path', ''));
        const pwdArg = password ? `-sPassword="${password}"` : '';

        const runGhostscriptUnlock = () => {
          return new Promise<void>((resolve, reject) => {
            const cmd = `"${gsPath}" -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite ${pwdArg} -sOutputFile="${outputPath}" "${filePath}"`;
            exec(cmd, (error) => {
              if (error) {
                if (!fsSync.existsSync(gsPath)) {
                  reject(new Error(`Ghostscript binary not found at "${gsPath}". Please check your Advanced settings or install Ghostscript.`));
                } else {
                  reject(new Error(`Decryption failed. Ensure the correct password was entered. Error: ${error.message}`));
                }
              }
              else resolve();
            });
          });
        };

        await runGhostscriptUnlock();

        saveHistory({
          id: historyId,
          tool_name: 'Unlock PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Unlock PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );
}

