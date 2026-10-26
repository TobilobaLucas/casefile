import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.CASEFILE_API_PROXY ?? 'http://localhost:8080',
        // Preserve the browser-facing Host so Spring sees same-origin requests.
        changeOrigin: false,
      },
    },
  },
});
