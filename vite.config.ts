// vite.config.ts
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function readVersionInfo() {
  const file = path.resolve('public', 'version.json');
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function releaseHeaderPlugin() {
  return {
    name: 'release-header',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const info = readVersionInfo();
        if (info) {
          res.setHeader('X-Release', `${info.version}-${info.commit}`);
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const info = readVersionInfo();
        if (info) {
          res.setHeader('X-Release', `${info.version}-${info.commit}`);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: '/game/',
  plugins: [releaseHeaderPlugin()],
  build: {
    outDir: 'dist',        // default is fine; explicit for clarity
    assetsDir: 'assets',   // default; hashed assets go here
  },
});
