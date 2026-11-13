import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {
  writeStaticSeoAndLegalAssets,
  renderPrerenderedLegalHtml,
  renderPrerendered404Html,
} from './server/legalAndSafetyEngine.ts';
import type { LegalDocumentId } from './src/legal/policiesData.ts';

function zenoStaticPrerenderPlugin() {
  const rootDir = import.meta.dirname;
  return {
    name: 'zeno-static-prerender',
    buildStart() {
      writeStaticSeoAndLegalAssets(rootDir);
    },
    closeBundle() {
      try {
        writeStaticSeoAndLegalAssets(rootDir);
        const distDir = path.resolve(rootDir, 'dist');
        const indexHtmlPath = path.resolve(distDir, 'index.html');
        if (!fs.existsSync(indexHtmlPath)) return;
        const rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        const docIds: LegalDocumentId[] = [
          'legal',
          'terms',
          'privacy',
          'refund',
          'acceptable-use',
          'cookies',
          'contact',
        ];
        for (const docId of docIds) {
          const html = renderPrerenderedLegalHtml(rawHtml, docId);
          fs.writeFileSync(path.resolve(distDir, `${docId}.html`), html, 'utf8');
        }
        const html404 = renderPrerendered404Html(rawHtml, '/404');
        fs.writeFileSync(path.resolve(distDir, '404.html'), html404, 'utf8');
      } catch (err) {
        console.warn('[zeno-static-prerender] Warning:', err);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), zenoStaticPrerenderPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ['phonon-tts'],
    },
    worker: {
      format: 'es' as const,
    },
    build: {
      sourcemap: 'hidden' as const,
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) {
              return 'firebase';
            }
            if (
              /[\\/]node_modules[\\/](react-markdown|remark-|rehype-|katex|unified|micromark|mdast-|hast-|unist-|vfile|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities|ccount|escape-string-regexp|markdown-table|zwitch|longest-streak|bail|trough|is-plain-obj|devlop|html-void-elements|stringify-entities|trim-lines|parse-entities)/.test(
                id
              )
            ) {
              return 'markdown-katex';
            }
            if (
              /[\\/]node_modules[\\/](react|react-dom|scheduler|@base-ui|lucide-react|@sentry|@vercel|zod|motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(
                id
              )
            ) {
              return 'react-vendor';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify--file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
