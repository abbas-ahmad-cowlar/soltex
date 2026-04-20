// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',           // Frontend source lives in src/
  publicDir: '../public', // Static assets (if any)
  server: {
    port: 3000,
    open: true,           // Auto-open browser on start
    proxy: {
      // Proxy API calls to the Express backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy PDF output files to the Express backend
      '/output': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',    // Build output goes to dist/
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'src/index.html',
        dashboard: 'src/dashboard.html',
      },
    },
  },
});
