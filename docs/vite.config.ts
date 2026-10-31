import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // CSV lives in the repo root, outside the Vite root
    fs: { allow: ['..'] },
  },
});
