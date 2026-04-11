'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Wallet, Sparkles } from 'lucide-react';
import { format, subDays, isAfter, isPast, isThisMonth, isToday } from 'date-fns';
import { ExpenseChart } from '@/components/charts/expense-chart';


export default function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [insights, setInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (!user) return;

    const txPath = `users/${user.uid}/transactions`;
    const qTx = query(collection(db, txPath), orderBy('date', 'desc'));
    const unsubTx = onSnapshot(
      qTx,
      (snapshot) => {
        setTransactions(snapshot.docs.map((doc) => doc.data()));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, txPath)
    );

    const billsPath = `users/${user.uid}/recurring`;
    const qBills = query(collection(db, billsPath), orderBy('nextDueDate', 'asc'));
    const unsubBills = onSnapshot(
      qBills,
      (snapshot) => {
        setBills(snapshot.docs.map((doc) => doc.data()));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, billsPath)
    );

    return () => {
      unsubTx();
      unsubBills();
    };
  }, [user]);

  const generateInsights = async () => {
    setLoadingInsights(true);

    try {
        const recentTx = transactions.filter((tx) => {
            const txDate = new Date(tx.date);
            const cutoff = subDays(new Date(), 30);
            return txDate >= cutoff;
          });

      const totalIncome = recentTx
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const totalExpense = recentTx
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const categories: Record<string, number> = {};
      recentTx
        .filter((tx) => tx.type === 'expense')
        .forEach((tx) => {
          categories[tx.category] = (categories[tx.category] || 0) + tx.amount;
        });

      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalIncome,
          totalExpense,
          categories,
          upcomingBillsCount: bills.filter(
            (b) => !isPast(new Date(b.nextDueDate))
          ).length,
        }),
      });

      const data = await response.json();
      setInsights(data.insights);
    } catch (error) {
      console.error('Failed to generate insights', error);
      setInsights('Failed to generate insights. Please try again later.');
    } finally {
      setLoadingInsights(false);
    }
  };

  const recentTx = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    const cutoff = subDays(new Date(), 30);
    return txDate >= cutoff;
  });

  const income = recentTx
  .filter((tx) => tx.type === 'income')
  .reduce((sum, tx) => sum + tx.amount, 0);

  const expenses = recentTx
  .filter((tx) => tx.type === 'expense')
  .reduce((sum, tx) => sum + tx.amount, 0);

  const balance = income - expenses;

  const upcomingBills = bills
    .filter(
      (b) =>
        !isPast(new Date(b.nextDueDate)) || isToday(new Date(b.nextDueDate))
    )
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-500">
          Welcome back, {user?.displayName || 'User'}!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Balance (This Month)
            </CardTitle>
            <Wallet className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                balance >= 0 ? 'text-gray-900' : 'text-red-600'
              }`}
            >
              {balance >= 0 ? '+' : ''}
              {balance.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Income (This Month)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {income.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expenses (This Month)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {expenses.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Expense chart */}
        <Card>
            <CardHeader>
            <CardTitle>Spending by category</CardTitle>
            <CardDescription>
                A breakdown of your expenses for this month.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <ExpenseChart transactions={recentTx} />
            </CardContent>
        </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
            <CardDescription>
              Get personalized advice based on your spending.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights ? (
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {insights}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                <Sparkles className="w-8 h-8 text-blue-500" />
                <p className="text-sm text-gray-500 max-w-xs">
                  Analyze your current month&apos;s spending to find savings
                  opportunities.
                </p>
                <Button onClick={generateInsights} disabled={loadingInsights}>
                  {loadingInsights ? 'Analyzing...' : 'Generate Insights'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Upcoming Bills</CardTitle>
            <CardDescription>Your next due payments.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingBills.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming bills.</p>
            ) : (
              <div className="space-y-4">
                {upcomingBills.map((bill, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium leading-none">
                        {bill.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(bill.nextDueDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="font-medium">
                      {bill.expectedAmount.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}