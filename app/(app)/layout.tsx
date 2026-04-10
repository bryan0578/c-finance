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
      <div className="h-screen overflow-hidden flex bg-gray-50">
        <div className="hidden md:block w-64 shrink-0 border-r bg-white" />
        <div className="flex-1 overflow-y-auto p-8">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden flex bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}