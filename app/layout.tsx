import type { Metadata } from 'next';
import './globals.css';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from './providers';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'C-Finance',
  description: 'Your personal finance command center for income, bills, budgets, and insights.',
  applicationName: 'C-Finance',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'C-Finance',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/c-finance-logo.svg',
    shortcut: '/c-finance-logo.svg',
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-slate-50 text-slate-900 antialiased"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
