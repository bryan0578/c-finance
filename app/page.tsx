'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { loginWithGoogle } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  LogIn,
  Sparkles,
  Wallet,
  Receipt,
  CalendarSync,
  ArrowRight,
} from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 md:px-10">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm text-gray-600">
            <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
            Your personal finance copilot
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Take control of your money without the spreadsheet circus
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Track transactions, stay ahead of recurring bills, monitor your monthly
            budget, and get AI-powered insights that actually help you make better
            decisions.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="min-w-[220px]" onClick={loginWithGoogle}>
              <LogIn className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>

            <div className="inline-flex items-center text-sm text-gray-500">
              Quick setup
              <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </div>
    
        <div className="mx-auto mt-14 grid w-full max-w-5xl gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Wallet className="h-5 w-5 text-gray-800" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Track balances</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Get a quick view of your income, expenses, and monthly net balance
              without digging through multiple screens.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Receipt className="h-5 w-5 text-gray-800" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Understand spending</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Organize transactions by category so you can spot patterns, leaks,
              and habits before they become expensive hobbies.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
              <CalendarSync className="h-5 w-5 text-gray-800" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Stay ahead of bills</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Keep recurring payments visible so due dates do not appear out of
              nowhere like a surprise album drop from your bank account.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}