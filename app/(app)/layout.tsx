'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Sidebar } from '@/components/layout/sidebar';

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
      <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
        <div className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block" />
        <div className="flex flex-1 items-center justify-center">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
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
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}