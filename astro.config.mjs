import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { loadEnv } from 'vite';

// Load environmental variables from .env to make process.env.PUBLIC_BASE_PATH available in Node context
const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
const baseRoute = process.env.PUBLIC_BASE_PATH || env.PUBLIC_BASE_PATH || '/';

export default defineConfig({
  site: 'https://143-47-35-167.sslip.io',
  base: baseRoute,
  trailingSlash: 'always',
  build: { 
    assets: 'assets',
    format: 'file' 
  },
  integrations: [react()],
  vite: { build: { cssCodeSplit: false } }
});
