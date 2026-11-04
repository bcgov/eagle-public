/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Tests run in the zone the site's users and data use, so date output matches on any host.
process.env['TZ'] = 'America/Vancouver';

export default defineConfig(({ mode }) => {
  // Proxy targets come from the shell, then `.env.local` (gitignored, so no prod host lands in a
  // commit), then test. Only the names below are read; none reach the bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const envTarget = env['API_LOCATION'];
  const demiTarget = env['DEMI_API_TARGET'] || 'https://demi-apim-test.azure-api.net';
  const notifyTarget = env['NOTIFY_API_TARGET'] || 'https://notify-api-test.azurewebsites.net';

  return {
    plugins: [react()],
    resolve: {
      alias: { app: fileURLToPath(new URL('./src/app', import.meta.url)) },
    },
    server: {
      allowedHosts: true,
      port: 4200,
      proxy: {
        // No `/api/usage` rule: a parity run's API_LOCATION is a deployed edge, which would log local
        // telemetry in that site's analytics.
        // eagle-notify's API is a different origin in every environment, so the subscribe form's POST
        // would need a CORS grant from it. Proxying keeps the dev server's call same-origin.
        '/notify-api': {
          target: notifyTarget,
          secure: false,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/notify-api/, ''),
        },
        // Phase dates for the assessment rail, from the same APIM gateway `/demi-search` uses: it
        // answers `/api/projects/<id>` anonymously, and nothing here supplies that prefix.
        '/demi-projects': {
          target: demiTarget,
          secure: false,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/demi-projects/, '/api/projects'),
        },
        // DEMI's native kind routes (DEMI_API_PATH). The edge maps `/demi/api` onto DEMI's `/api`; the
        // gateway answers `/api` directly, so the rewrite drops the `/demi` prefix.
        '/demi/api': {
          target: demiTarget,
          secure: false,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/demi\/api/, '/api'),
        },
        // `/demi-search` answers every read the app makes. By default it skips test's rproxy, which
        // answers with `401 WWW-Authenticate: Basic`, and goes straight to the APIM gateway behind
        // it, whose `/api` answers anonymously. With API_LOCATION set it follows that host, whose
        // nginx supplies the `/api`.
        '/demi-search': envTarget
          ? { target: envTarget, secure: false, changeOrigin: true }
          : {
              target: demiTarget,
              secure: false,
              changeOrigin: true,
              // The base path is `/demi-search` because nginx supplies the `/api`. Nothing supplies
              // it here.
              // `/config` is the one path nginx does not map straight through: it answers
              // `/api/config/public`, the gateway's public config. `/api/config` is DEMI's internal
              // one, which carries no ACCESS_GATE, so booting on it fails `isWholeConfig`.
              rewrite: (path: string) =>
                path
                  .replace(/^\/demi-search\/config(?=$|[?#])/, '/api/config/public')
                  .replace(/^\/demi-search/, '/api'),
            },
      },
    },
    build: {
      // Both the output directory and the `main-[hash].js` entry name are grepped by
      // .github/workflows/deploy-azure-*.yaml.
      outDir: 'dist/eagle-public/browser',
      rollupOptions: {
        output: {
          entryFileNames: 'main-[hash].js',
          // Hashed output stays at the root: the deploy workflow uploads everything under
          // `assets/` with `no-cache` (that directory holds the unhashed fonts, images and
          // stylesheets copied from `public/`) and caches only root-level hashed files.
          // Prefixed so no chunk can land on a proxied path: a chunk named `analytics-*.js` was once
          // proxied away as an API call instead of served, and the app never booted.
          chunkFileNames: 'chunk-[name]-[hash].js',
          assetFileNames: 'asset-[name]-[hash][extname]',
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test-setup.ts',
          'src/test-utils.tsx',
          '**/*.d.ts',
          '**/*.config.*',
          'src/main.tsx',
        ],
      },
    },
  };
});
