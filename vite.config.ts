import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/sync-to-codebase' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const { prompts, designPrompts } = parsed;
                if (Array.isArray(prompts) && Array.isArray(designPrompts)) {
                  const filePath = path.resolve(__dirname, 'src/custom_templates.ts');
                  const content = `import { PromptTemplate } from './types';

export const CUSTOM_PROMPTS: PromptTemplate[] = ${JSON.stringify(prompts, null, 2)};

export const CUSTOM_DESIGN_PROMPTS: PromptTemplate[] = ${JSON.stringify(designPrompts, null, 2)};
`;
                  fs.writeFileSync(filePath, content, 'utf-8');
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                  return;
                }
              } catch (e) {
                console.error('Failed to parse or write templates:', e);
              }
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid data' }));
            });
          } else {
            next();
          }
        });
      }
    },
  };
});
