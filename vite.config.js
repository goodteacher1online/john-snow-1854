import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages 호환 상대경로
  server: {
    port: 5173,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 반 전체 연락 창(hub.html)도 함께 내보낸다
    rollupOptions: { input: { main: 'index.html', hub: 'hub.html' } }
  }
});
