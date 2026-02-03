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
        // Usa react-dom/server.edge solo in produzione per Cloudflare
        ...(process.env.NODE_ENV === 'production' ? { 'react-dom/server': 'react-dom/server.edge' } : {}),
      },
    },
    ssr: {
      // Forziamo il bundling di queste dipendenze che usano CJS o hanno problemi in SSR locale
      noExternal: ['motion', 'motion/react', 'framer-motion', 'gsap', '@astrojs/react']
    },
    optimizeDeps: {
      // Escludiamo dal pre-bundling per forzare il bundling SSR corretto
      exclude: ['motion', 'motion/react', 'framer-motion', 'gsap']
    },
    server: {
      hmr: {
        overlay: true
      }
    }
  }
});
