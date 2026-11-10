import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages 호환 상대경로
  server: {
    port: 5173,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
