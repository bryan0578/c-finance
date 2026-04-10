'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { loginWithGoogle } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { LogIn, Sparkles, Wallet, Receipt, CalendarSync } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl grid gap-10 lg:grid-cols-2 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-sm text-gray-600 shadow-sm">
            <Sparkles className="w-4 h-4 mr-2 text-blue-500" />
            Your personal finance copilot
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Finance AI
            </h1>
            <p className="text-lg text-gray-600 max-w-xl">
              Track transactions, manage recurring bills, monitor budgets, and
              get AI-powered insights on your spending habits.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={loginWithGoogle}>
              <LogIn className="w-5 h-5 mr-2" />
              Sign in with Google
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border p-4">
              <Wallet className="w-5 h-5 mb-3 text-gray-700" />
              <h2 className="font-semibold">Track balances</h2>
              <p className="text-sm text-gray-500 mt-1">
                See income, expenses, and your monthly net at a glance.
              </p>
            </div>

            <div className="rounded-2xl border p-4">
              <Receipt className="w-5 h-5 mb-3 text-gray-700" />
              <h2 className="font-semibold">Manage spending</h2>
              <p className="text-sm text-gray-500 mt-1">
                Organize transactions and understand where your money goes.
              </p>
            </div>

            <div className="rounded-2xl border p-4">
              <CalendarSync className="w-5 h-5 mb-3 text-gray-700" />
              <h2 className="font-semibold">Stay ahead of bills</h2>
              <p className="text-sm text-gray-500 mt-1">
                Keep recurring payments visible before they sneak up on you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}