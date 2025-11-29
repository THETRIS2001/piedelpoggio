import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), react(), sitemap()],
  site: 'https://piedelpoggio-site.pages.dev',
  output: 'server',
  adapter: cloudflare(),
  build: {
    format: 'directory'
  },
  vite: {
    cacheDir: '.vite-cache-astro',
    optimizeDeps: {
      include: ['react', 'react-dom', 'motion', 'motion/react', 'gsap']
    },
    server: {
      hmr: {
        overlay: true
      }
    }
  }
});
