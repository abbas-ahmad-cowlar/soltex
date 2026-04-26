// server/index.js
// SolteX — Express Backend Server

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// Serve output PDFs with no-cache headers
app.use('/output', express.static(
  path.join(__dirname, '..', 'projects'),
  {
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
));

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
import compileRoutes from './routes/compile.js';
import fileRoutes from './routes/files.js';
import projectRoutes from './routes/projects.js';
import searchRoutes from './routes/search.js';
import wordcountRoutes from './routes/wordcount.js';
import checkpointRoutes from './routes/checkpoints.js';
app.use('/api', compileRoutes);
app.use('/api', fileRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', searchRoutes);
app.use('/api/projects', wordcountRoutes);
app.use('/api/projects', checkpointRoutes);

// ---------------------------------------------------------------------------
// TeX Live Verification
// ---------------------------------------------------------------------------
function checkTexLive() {
  return new Promise((resolve) => {
    execFile('pdflatex', ['--version'], (error, stdout) => {
      if (error) {
        console.warn('⚠️  pdflatex not found on PATH. LaTeX compilation will not work.');
        console.warn('   Please install TeX Live: https://tug.org/texlive/');
        resolve(false);
      } else {
        const version = stdout.split('\n')[0];
        console.log(`✅ TeX Live found: ${version}`);
        resolve(true);
      }
    });
  });
}

function checkLatexmk() {
  return new Promise((resolve) => {
    execFile('latexmk', ['--version'], (error, stdout) => {
      if (error) {
        console.warn('⚠️  latexmk not found on PATH. Multi-pass compilation will not work.');
        resolve(false);
      } else {
        const version = stdout.split('\n')[0];
        console.log(`✅ latexmk found: ${version}`);
        resolve(true);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
async function start() {
  console.log('');
  console.log('🌿 SolteX — LaTeX Editor Backend');
  console.log('─'.repeat(40));

  // Bind the port FIRST so that we are ready to accept proxied requests
  // from Vite (which starts faster). TeX tool checks are informational
  // and don't gate any routes.
  await new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      resolve();
    });
  });

  // Check for LaTeX tools (informational, non-blocking)
  await checkTexLive();
  await checkLatexmk();

  console.log('─'.repeat(40));
  console.log('');
}

start();
