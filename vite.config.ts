// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/game/',
  build: {
    outDir: 'dist',        // default is fine; explicit for clarity
    assetsDir: 'assets',   // default; hashed assets go here
  },
});
