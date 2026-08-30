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
  manifest: '/manifest.webmanifest?v=portfolio-1',
  appleWebApp: { capable: true, title: 'C-Finance', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png?v=portfolio-1', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png?v=portfolio-1', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/c-finance-logo.svg',
    apple: [{ url: '/icons/apple-touch-icon.png?v=portfolio-1', sizes: '180x180', type: 'image/png' }],
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
