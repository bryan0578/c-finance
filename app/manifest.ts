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
      {
        src: '/icons/portfolio-icon.svg?v=portfolio-2',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/portfolio-icon-maskable.svg?v=portfolio-2',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
