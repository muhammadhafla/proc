import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: process.env.ALLOWED_HOSTS?.split(',') || ['localhost'],
  },
});
