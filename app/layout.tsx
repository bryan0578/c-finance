import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import './portfolio-refresh.css';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from './providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'C-Finance',
  description: 'Your personal finance command center for income, bills, budgets, and insights.',
  applicationName: 'C-Finance',
  manifest: '/manifest.webmanifest?v=portfolio-2',
  appleWebApp: { capable: true, title: 'C-Finance', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/portfolio-icon.svg?v=portfolio-2', type: 'image/svg+xml' }],
    shortcut: '/icons/portfolio-icon.svg?v=portfolio-2',
    apple: [{ url: '/icons/portfolio-icon.svg?v=portfolio-2', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07121f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans dark', geist.variable)}>
      <body suppressHydrationWarning className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
        <Script src="/register-sw.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
