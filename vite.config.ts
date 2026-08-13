import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'node:fs';
// Blink Visual Editor: stamps data-blnk-id on JSX + injects iframe-side picker
// runtime. Self-contained (no external deps) so this template stays portable.
import { blinkTaggerPlugin } from './blink-tagger.plugin.mjs';

// Blink: guarantee global CSS survives agent rewrites of src/routes/__root.tsx.
// TanStack Start only emits a stylesheet for CSS imported by a ROUTE module, and
// the agent frequently regenerates __root.tsx from scratch and drops the
// `import '../index.css'` — orphaning Tailwind so the app renders unstyled. This
// runs in-sandbox on EVERY compile (dev HMR + prerender build), so the import is
// always present in the route module Start collects — no backend/timing
// dependency, styled on the first render. Idempotent (skips if already imported).
function blinkEnsureRootCss() {
  return {
    name: 'blink-ensure-root-css',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?')[0];
      if (!file.endsWith('/src/routes/__root.tsx')) return null;
      // Already imports the global stylesheet (bare side-effect import)? Leave it.
      if (/import\s+['"][^'"]*index\.css['"]/.test(code)) return null;
      // Only inject if src/index.css actually exists — never force-import a file the
      // user deleted (CSS-modules / styled-components / a different entry), which would
      // turn an unstyled page into a hard "module not found" build error.
      const cssPath = path.resolve(path.dirname(file), '../index.css');
      if (!fs.existsSync(cssPath)) return null;
      // Append (ES imports hoist) so existing line numbers — and therefore stack
      // traces / dev-overlay positions in the user's __root.tsx — are unchanged.
      return { code: `${code}\nimport '../index.css';\n`, map: null };
    },
  };
}

export default defineConfig({
  plugins: [
    blinkEnsureRootCss(),
    // Tailwind v4 via the official Vite plugin. Handles `@import "tailwindcss"`
    // itself (must NOT be a PostCSS plugin here — TanStack Start's prerender build
    // runs postcss-import first and can't resolve the v4 bare import → build fails).
    tailwindcss(),
    // Build-time tagger OFF by default — its transform can stamp data-blnk-id into
    // HTML inside string literals. Enable with BLINK_BUILD_TIME_TAGGER=on.
    ...(process.env.BLINK_BUILD_TIME_TAGGER === 'on' ? [blinkTaggerPlugin()] : []),
    // TanStack Start — SSR + static prerendering so search engines AND AI crawlers
    // (GPTBot/ClaudeBot/PerplexityBot, which do NOT execute JS) get fully-rendered
    // HTML on the first request. `prerender` emits crawlable static HTML at build time.
    // NOTE: the Start plugin MUST come before the React plugin.
    tanstackStart({
      prerender: {
        enabled: true,
        // Follow in-app links from the prerendered entry to statically render
        // every reachable route.
        crawlLinks: true,
        // CRITICAL: do NOT fail the build when a crawled link 404s. Broken /
        // example / dynamic / auth-gated links are common, and `crawlLinks`
        // follows ALL of them — without this, ONE dead link aborts the whole
        // build → no dist/ → "404 NoSuchKey index.html" white screen. Skip + warn.
        failOnError: false,
      },
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // @blinkdotnew/ui + framer-motion + R3F peers must share one React instance or hooks
    // crash inside motion with: Cannot read properties of null (reading 'useRef')
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'framer-motion'],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
  build: {
    // Build into a clean temp dir; scripts/finalize-static-build.mjs then flattens
    // .vite-out/client/* -> dist/ so Blink hosting serves dist/index.html
    // (BUILD_PATHS['vite-react'] = 'dist'). Building here instead of dist/ dodges the
    // EACCES from Start's client build emptying the platform-prepared dist/, which
    // pre-injects a read-only _redirects the sandbox user can't unlink.
    outDir: '.vite-out',
    emptyOutDir: true,
    minify: true,
    // Vite 8 ships Rolldown; `rollupOptions` is deprecated in favour of
    // `rolldownOptions`. `output.codeSplitting.groups` is the current native API
    // (manualChunks gets rebalanced by Rolldown and can hoist shared deps like
    // react into unrelated vendor chunks — observed with a vendor-charts group,
    // which dragged 210 KB of recharts onto the landing critical path).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Stable vendor libraries → independently cacheable content-hashed
            // chunks. (a) the app entry shrinks from ~966 KB to a few hundred
            // bytes, (b) on a normal app-code deploy react/supabase/tanstack/
            // motion/icons keep their hashes and are served from the immutable
            // cache (max-age=31536000).
            // NOTE: recharts/d3/victory-vendor deliberately have NO group here —
            // they are only used by lazy manage/hq routes, so leaving them to the
            // default splitter keeps them OFF the landing-page critical path.
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'vendor-motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'vendor-ui', test: /node_modules[\\/](@radix-ui|@dnd-kit|sonner)[\\/]/ },
            { name: 'vendor-3d', test: /node_modules[\\/](three|@react-three)[\\/]/ },
            // order matters: react-hook-form / react-hot-toast / react-responsive
            // / @hookform must match before the broad `react` group above.
            { name: 'vendor-forms-utils', test: /node_modules[\\/](react-hook-form|react-hot-toast|react-responsive|@hookform|zod|date-fns|clsx|tailwind-merge|class-variance-authority)[\\/]/ },
          ],
        },
      },
    },
  },
});
