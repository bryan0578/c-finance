'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
        <div className="hidden w-64 shrink-0 border-r border-border bg-card md:block" />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            Loading your workspace...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
