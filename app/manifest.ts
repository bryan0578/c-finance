import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'C-Finance',
    short_name: 'C-Finance',
    description: 'Your personal finance command center for income, bills, budgets, and insights.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#07121f',
    theme_color: '#07121f',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png?v=portfolio-1', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png?v=portfolio-1', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png?v=portfolio-1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
