import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), react(), sitemap()],
  site: 'https://piedelpoggio.org',
  output: 'server',
  trailingSlash: 'never',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  build: {
    format: 'directory'
  },
  vite: {
    cacheDir: '.vite-cache-astro-dev',
    resolve: {
      alias: {
        'react-dom/server': 'react-dom/server.edge',
      },
    },
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
