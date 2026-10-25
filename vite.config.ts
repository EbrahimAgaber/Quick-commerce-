import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { handleLocalStoreApiRequest, ensureStorageDirectories } from './server';

export default defineConfig(() => {
  const currentBuildTime = Date.now();
  ensureStorageDirectories();
  return {
    define: {
      __APP_BUILD_TIME__: JSON.stringify(currentBuildTime),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-server-storage-engine',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            try {
              const handled = await handleLocalStoreApiRequest(req, res);
              if (!handled) {
                next();
              }
            } catch (err) {
              console.error('Local server storage middleware error:', err);
              next();
            }
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use(async (req, res, next) => {
            try {
              const handled = await handleLocalStoreApiRequest(req, res);
              if (!handled) {
                next();
              }
            } catch (err) {
              console.error('Local preview storage middleware error:', err);
              next();
            }
          });
        },
      },
      {
        name: 'generate-version-json',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({
              buildTime: currentBuildTime,
              buildDate: new Date(currentBuildTime).toISOString(),
            }),
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || process.cwd(), '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/firebase/auth') || id.includes('node_modules/@firebase/auth')) {
              return 'firebase-auth';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase-firestore';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'icons';
            }
            if (id.includes('src/components/builder/') || id.includes('src/components/admin/')) {
              return 'merchant-admin';
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Ignore /data and /public/uploads so local server JSON writes and image uploads never trigger Vite full-page reloads!
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: [
                '**/data/**',
                '**/public/uploads/**',
                '**/*.bak',
                '**/*.tmp',
              ],
            },
    },
  };
});
