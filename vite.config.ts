/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// env.js is the single source of truth for the dev proxy target. Change API_LOCATION there;
// the dev server picks it up on the next restart.
const envJs = readFileSync(fileURLToPath(new URL('./src/env.js', import.meta.url)), 'utf-8');
const sandbox: { __env: Record<string, string> } = { __env: {} };
runInNewContext(envJs, sandbox);

// API_LOCATION in the environment wins over env.js, so a parity run can point the whole dev
// server at prod without prod URLs landing in a committed file.
const envTarget = process.env['API_LOCATION'];
const target = envTarget || sandbox.__env['API_LOCATION'] || 'http://localhost:3000';
const proxyRule = { target, secure: false, changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { app: fileURLToPath(new URL('./src/app', import.meta.url)) }
  },
  server: {
    allowedHosts: true,
    port: 4200,
    proxy: {
      '/api': proxyRule,
      '/analytics': proxyRule,
      // `/eagle-search` too, because `SEARCH_API_PATH` from a deployed `/api/config` is RELATIVE
      // ('/eagle-search') — nginx supplies the `/api`. Without this rule every Project, Document
      // and DocumentChunk search from the dev server hits localhost:4200 and 404s, while
      // everything else works, which reads as "search is broken" rather than "the proxy is short
      // a line".
      '/eagle-search': proxyRule,
      // eagle-notify's API is a different origin in every environment, so the subscribe form's POST
      // would need a CORS grant from it. Proxying keeps the dev server's call same-origin.
      '/notify-api': {
        target: 'https://notify-api-test.azurewebsites.net',
        secure: false,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/notify-api/, '')
      },
      // `/demi-search` is what test's /api/config returns today, and it does NOT follow
      // API_LOCATION: test's rproxy answers that location with `401 WWW-Authenticate: Basic`
      // (only `/` and `/demi-search` are gated there; `/api` is open), so routing it through the
      // site would 401 every Project, Document and DocumentChunk search. It goes straight to the
      // APIM gateway the rproxy itself proxies to, whose `/api` answers anonymously.
      // When API_LOCATION is set in the environment the whole site is being pointed at one
      // deployed host, so `/demi-search` follows it (that host's nginx supplies the `/api`).
      '/demi-search': envTarget
        ? proxyRule
        : {
            target: 'https://demi-apim-test.azure-api.net',
            secure: false,
            changeOrigin: true,
            // The base path is `/demi-search` because nginx supplies the `/api`. Nothing supplies
            // it here.
            rewrite: (path: string) => path.replace(/^\/demi-search/, '/api')
          }
    }
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
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]'
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test-setup.ts', '**/*.d.ts', '**/*.config.*', 'src/main.tsx']
    }
  }
});
