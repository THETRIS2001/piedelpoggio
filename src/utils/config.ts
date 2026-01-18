// Configurazioni centrali del sito
export const SITE_CONFIG = {
  title: 'Piedelpoggio',
  description: 'Il sito ufficiale di Piedelpoggio, frazione di Leonessa nel Lazio',
  url: 'https://piedelpoggio.it',
  author: 'Comune di Leonessa',
  locale: 'it-IT',

  // Coordinate del centro del paese per le mappe
  coordinates: {
    lat: 42.55, // Coordinate approssimative
    lon: 13.0,
    zoom: 14,
  },


  // Social media e contatti
  social: {
    facebook: '',
    instagram: '',
    email: 'info@piedelpoggio.it',
  },

  // Impostazioni mappe
  map: {
    defaultZoom: 14,
    maxZoom: 18,
    minZoom: 10,
  },
} as const;

// Tipi derivati dalla configurazione
export type SiteConfig = typeof SITE_CONFIG;