// server/utils/latex.js
// SolteX -- LaTeX Compilation Helper (Phase 3: Enhanced)

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const DEFAULT_TIMEOUT = 60000;

/**
 * Compile a LaTeX project using latexmk.
 * @param {string} projectDir - Absolute path to the project directory
 * @param {string} mainFile - Main .tex file name (e.g., 'main.tex')
 * @param {object} options
 * @param {string} options.engine - 'pdflatex', 'xelatex', 'lualatex'
 * @param {number} options.timeout - Compilation timeout in ms
 * @param {boolean} options.draft - Skip images/hyperlinks for faster builds
 * @returns {Promise<{success: boolean, pdfPath: string|null, log: string, duration: number}>}
 */
export async function compileLaTeX(projectDir, mainFile, options = {}) {
  const { engine, texEngine = 'pdflatex', timeout = DEFAULT_TIMEOUT, draft = false } = options;
  const selectedEngine = engine || texEngine;
  const startTime = Date.now();
  const outputDir = path.join(projectDir, 'output');

  await fs.mkdir(outputDir, { recursive: true });

  // Draft mode: create a wrapper file
  let compileFile = mainFile;
  if (draft) {
    const wrapperContent = [
      '\\PassOptionsToPackage{draft}{graphicx}',
      '\\PassOptionsToPackage{draft}{hyperref}',
      `\\input{${mainFile}}`,
    ].join('\n');
    const wrapperPath = path.join(projectDir, '_draft_wrapper.tex');
    await fs.writeFile(wrapperPath, wrapperContent, 'utf-8');
    compileFile = '_draft_wrapper.tex';
  }

  return new Promise((resolve) => {
    const args = [
      '-pdf',
      `-pdflatex=${selectedEngine}`,
      '-interaction=nonstopmode',
      '-synctex=1',
      '-halt-on-error',
      `-outdir=${outputDir}`,
      compileFile,
    ];

    execFile('latexmk', args, {
      cwd: projectDir,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    }, async (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      const log = stdout + '\n' + stderr;

      // Cleanup draft wrapper
      if (draft) {
        try { await fs.unlink(path.join(projectDir, '_draft_wrapper.tex')); } catch {}
      }

      // Read the .log file for detailed error parsing
      let logFileContent = '';
      const logFileName = compileFile.replace(/\.tex$/, '.log');
      try {
        logFileContent = await fs.readFile(path.join(outputDir, logFileName), 'utf-8');
      } catch {
        logFileContent = log; // fallback to stdout/stderr
      }

      if (error) {
        if (error.killed) {
          resolve({
            success: false,
            pdfPath: null,
            log: `Compilation timed out after ${timeout / 1000} seconds.\n\n${logFileContent}`,
            duration,
          });
          return;
        }

        // Check if PDF was still produced despite errors
        const pdfName = compileFile.replace(/\.tex$/, '.pdf');
        const pdfPath = path.join(outputDir, pdfName);
        let pdfExists = false;
        try { await fs.access(pdfPath); pdfExists = true; } catch {}

        resolve({ success: false, pdfPath: pdfExists ? pdfPath : null, log: logFileContent, duration });
        return;
      }

      const pdfName = compileFile.replace(/\.tex$/, '.pdf');
      const pdfPath = path.join(outputDir, pdfName);
      resolve({ success: true, pdfPath, log: logFileContent, duration });
    });
  });
}

/**
 * Clean auxiliary files and output directory.
 */
export async function cleanProject(projectDir) {
  const outputDir = path.join(projectDir, 'output');
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
    console.log('Cleaned output directory:', outputDir);
  } catch {}
}
