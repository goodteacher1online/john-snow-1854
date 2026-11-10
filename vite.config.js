import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages 호환 상대경로
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
