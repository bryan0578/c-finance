'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  isPast,
  isToday,
  parseISO,
  startOfDay,
  subDays,
  differenceInCalendarDays,
  isValid,
  startOfYear,
} from 'date-fns';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  PiggyBank,
  Plus,
  Receipt,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExpenseChart } from '@/components/charts/expense-chart';
import { ExpenseTrendChart } from '@/components/charts/expense-trend-chart';
import { TransactionForm } from '@/components/forms/transaction-form';
import { BillForm } from '@/components/forms/bill-form';
import { BudgetForm } from '@/components/forms/budget-form';

type TransactionType = 'income' | 'expense';
type DashboardRange = '7d' | '30d' | '90d' | 'ytd';
type ChartView = 'category' | 'trend';

interface Transaction {
  id?: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  note?: string;
}

interface Bill {
  id?: string;
  name: string;
  type: 'fixed' | 'variable' | 'subscription';
  expectedAmount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
}

interface Budget {
  id?: string;
  category: string;
  limit: number;
  period: 'monthly';
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function parseDate(value: string) {
  if (!value) return null;

  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

function getRangeStart(range: DashboardRange) {
  const now = new Date();

  switch (range) {
    case '7d':
      return subDays(now, 7);
    case '30d':
      return subDays(now, 30);
    case '90d':
      return subDays(now, 90);
    case 'ytd':
      return startOfYear(now);
    default:
      return subDays(now, 30);
  }
}

function getRangeLabel(range: DashboardRange) {
  switch (range) {
    case '7d':
      return 'Last 7 Days';
    case '30d':
      return 'Last 30 Days';
    case '90d':
      return 'Last 90 Days';
    case 'ytd':
      return 'Year to Date';
  }
}

function getBillUrgency(
  bill: Bill
): 'overdue' | 'due-soon' | 'upcoming' {
  const dueDate = parseDate(bill.nextDueDate);
  if (!dueDate) return 'upcoming';

  const today = startOfDay(new Date());
  const due = startOfDay(dueDate);
  const diff = differenceInCalendarDays(due, today);

  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'due-soon';
  return 'upcoming';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [insights, setInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [range, setRange] = useState<DashboardRange>('30d');
  const [chartView, setChartView] = useState<ChartView>('category');

  useEffect(() => {
    if (!user) return;

    const txPath = `users/${user.uid}/transactions`;
    const qTx = query(collection(db, txPath), orderBy('date', 'desc'));
    const unsubTx = onSnapshot(
      qTx,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Transaction, 'id'>),
        }));
        setTransactions(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, txPath)
    );

    const billsPath = `users/${user.uid}/recurring`;
    const qBills = query(collection(db, billsPath), orderBy('nextDueDate', 'asc'));
    const unsubBills = onSnapshot(
      qBills,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Bill, 'id'>),
        }));
        setBills(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, billsPath)
    );

    const budgetsPath = `users/${user.uid}/budgets`;
    const qBudgets = query(collection(db, budgetsPath), orderBy('category', 'asc'));
    const unsubBudgets = onSnapshot(
      qBudgets,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Budget, 'id'>),
        }));
        setBudgets(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, budgetsPath)
    );

    return () => {
      unsubTx();
      unsubBills();
      unsubBudgets();
    };
  }, [user]);

  const rangeStart = useMemo(() => getRangeStart(range), [range]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = parseDate(tx.date);
      return txDate ? txDate >= rangeStart : false;
    });
  }, [transactions, rangeStart]);

  const previousTransactions = useMemo(() => {
    const windowLengthMs = new Date().getTime() - rangeStart.getTime();
    const previousStart = new Date(rangeStart.getTime() - windowLengthMs);

    return transactions.filter((tx) => {
      const txDate = parseDate(tx.date);
      return txDate ? txDate >= previousStart && txDate < rangeStart : false;
    });
  }, [transactions, rangeStart]);

  const income = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [filteredTransactions]
  );

  const expenses = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [filteredTransactions]
  );

  const balance = income - expenses;

  const previousIncome = useMemo(
    () =>
      previousTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [previousTransactions]
  );

  const previousExpenses = useMemo(
    () =>
      previousTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [previousTransactions]
  );

  const previousBalance = previousIncome - previousExpenses;

  function getPercentChange(current: number, previous: number) {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }

  const balanceChange = getPercentChange(balance, previousBalance);
  const incomeChange = getPercentChange(income, previousIncome);
  const expenseChange = getPercentChange(expenses, previousExpenses);

  const savingsRate = useMemo(() => {
    if (income <= 0) return null;
    return ((income - expenses) / income) * 100;
  }, [income, expenses]);

  const recentTransactions = useMemo(() => {
    return [...transactions].slice(0, 6);
  }, [transactions]);

  const overdueBills = useMemo(
    () => bills.filter((bill) => getBillUrgency(bill) === 'overdue'),
    [bills]
  );

  const dueSoonBills = useMemo(
    () => bills.filter((bill) => getBillUrgency(bill) === 'due-soon'),
    [bills]
  );

  const upcomingBills = useMemo(() => {
    return bills
      .filter((b) => {
        const dueDate = parseDate(b.nextDueDate);
        return dueDate ? !isPast(dueDate) || isToday(dueDate) : false;
      })
      .slice(0, 4);
  }, [bills]);

  const topCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        const category = tx.category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + Number(tx.amount || 0);
      });

    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;

    return {
      name: sorted[0][0],
      total: sorted[0][1],
    };
  }, [filteredTransactions]);

  const budgetSnapshot = useMemo(() => {
    const spendByCategory: Record<string, number> = {};

    filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        const category = tx.category || 'Other';
        spendByCategory[category] = (spendByCategory[category] || 0) + Number(tx.amount || 0);
      });

    const enriched = budgets.map((budget) => {
      const spent = spendByCategory[budget.category] || 0;
      const percent = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

      return {
        ...budget,
        spent,
        percent,
      };
    });

    const sorted = enriched.sort((a, b) => b.percent - a.percent);

    return {
      top: sorted.slice(0, 3),
      overBudgetCount: enriched.filter((b) => b.percent > 100).length,
    };
  }, [budgets, filteredTransactions]);

  const generateInsights = async () => {
    setLoadingInsights(true);

    try {
      const totalIncome = filteredTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const totalExpense = filteredTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const categories: Record<string, number> = {};
      filteredTransactions
        .filter((tx) => tx.type === 'expense')
        .forEach((tx) => {
          categories[tx.category] = (categories[tx.category] || 0) + Number(tx.amount || 0);
        });

      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalIncome,
          totalExpense,
          categories,
          upcomingBillsCount: bills.filter((b) => {
            const date = parseDate(b.nextDueDate);
            return date ? !isPast(date) : false;
          }).length,
          range,
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

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.displayName || 'User'}!
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={range === '7d' ? 'default' : 'outline'}
            className="rounded-md"
            onClick={() => setRange('7d')}
          >
            7D
          </Button>
          <Button
            type="button"
            variant={range === '30d' ? 'default' : 'outline'}
            className="rounded-md"
            onClick={() => setRange('30d')}
          >
            30D
          </Button>
          <Button
            type="button"
            variant={range === '90d' ? 'default' : 'outline'}
            className="rounded-md"
            onClick={() => setRange('90d')}
          >
            90D
          </Button>
          <Button
            type="button"
            variant={range === 'ytd' ? 'default' : 'outline'}
            className="rounded-md"
            onClick={() => setRange('ytd')}
          >
            YTD
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TransactionForm />
        <BillForm />
        <BudgetForm />
      </div>

      {(overdueBills.length > 0 || dueSoonBills.length > 0) && (
        <Card className="rounded-lg border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <p className="font-medium text-amber-900">Bills need attention</p>
                <p className="text-sm text-amber-800">
                  {overdueBills.length > 0 && `${overdueBills.length} overdue`}
                  {overdueBills.length > 0 && dueSoonBills.length > 0 && ' • '}
                  {dueSoonBills.length > 0 && `${dueSoonBills.length} due in the next 7 days`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-md border-amber-300 bg-white"
              onClick={() => router.push('/bills')}
            >
              View Bills
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Balance ({getRangeLabel(range)})
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
              {balance >= 0 ? '+' : ''}
              {formatCurrency(balance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {balanceChange === null
                ? 'No previous comparison'
                : `${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(1)}% vs previous period`}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Income ({getRangeLabel(range)})
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(income)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {incomeChange === null
                ? 'No previous comparison'
                : `${incomeChange >= 0 ? '+' : ''}${incomeChange.toFixed(1)}% vs previous period`}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expenses ({getRangeLabel(range)})
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(expenses)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {expenseChange === null
                ? 'No previous comparison'
                : `${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}% vs previous period`}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Savings Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {savingsRate === null ? (
              <p className="text-sm text-muted-foreground">No income in selected range.</p>
            ) : (
              <>
                <div className={`text-2xl font-bold ${savingsRate >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                  {savingsRate.toFixed(1)}%
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(income - expenses) >= 0 ? 'You saved part of your income.' : 'Expenses exceeded income.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Top Spending Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCategory ? (
              <>
                <div className="text-2xl font-bold">{topCategory.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCurrency(topCategory.total)} spent
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No expense data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="rounded-lg lg:col-span-4">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {chartView === 'category' ? 'Spending by Category' : 'Expense Trend'}
              </CardTitle>
              <CardDescription>
                {chartView === 'category'
                  ? `Expense breakdown for ${getRangeLabel(range).toLowerCase()}.`
                  : `Expense movement over ${getRangeLabel(range).toLowerCase()}.`}
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={chartView === 'category' ? 'default' : 'outline'}
                className="rounded-md"
                onClick={() => setChartView('category')}
              >
                Category
              </Button>
              <Button
                type="button"
                variant={chartView === 'trend' ? 'default' : 'outline'}
                className="rounded-md"
                onClick={() => setChartView('trend')}
              >
                Trend
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {chartView === 'category' ? (
              <ExpenseChart transactions={filteredTransactions} />
            ) : (
              <ExpenseTrendChart transactions={filteredTransactions} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest account activity.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="rounded-md"
              onClick={() => router.push('/transactions')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No transactions yet.
              </p>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((tx, index) => {
                  const txDate = parseDate(tx.date);
                  return (
                    <div
                      key={`${tx.id ?? tx.note ?? tx.category}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md p-2 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {tx.note || tx.category}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category}
                          {txDate ? ` • ${format(txDate, 'MMM d, yyyy')}` : ''}
                        </p>
                      </div>

                      <div
                        className={`shrink-0 text-sm font-medium ${
                          tx.type === 'income' ? 'text-green-600' : 'text-foreground'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <span className="inline-flex items-center">
                            <ArrowUpRight className="mr-1 h-4 w-4" />
                            {formatCurrency(tx.amount)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center">
                            <ArrowDownRight className="mr-1 h-4 w-4" />
                            {formatCurrency(tx.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="rounded-lg lg:col-span-4">
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
            <CardDescription>
              Personalized observations based on your spending.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights ? (
              <div className="space-y-3">
                <div className="rounded-md bg-muted/40 p-4 text-sm leading-6 text-foreground whitespace-pre-wrap">
                  {insights}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-md" onClick={() => setInsights('')}>
                    Clear
                  </Button>
                  <Button className="rounded-md" onClick={generateInsights} disabled={loadingInsights}>
                    {loadingInsights ? 'Refreshing...' : 'Refresh Insights'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="mb-4 h-8 w-8 text-blue-500" />
                <p className="max-w-xs text-sm text-muted-foreground">
                  Analyze your recent spending to find patterns and savings opportunities.
                </p>
                <Button className="mt-4 rounded-md" onClick={generateInsights} disabled={loadingInsights}>
                  {loadingInsights ? 'Analyzing...' : 'Generate Insights'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Bills</CardTitle>
              <CardDescription>Your next due payments.</CardDescription>
            </div>
            <Button
              variant="outline"
              className="rounded-md"
              onClick={() => router.push('/bills')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingBills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming bills.</p>
            ) : (
              <div className="space-y-4">
                {upcomingBills.map((bill, i) => {
                  const dueDate = parseDate(bill.nextDueDate);
                  const urgency = getBillUrgency(bill);

                  return (
                    <div
                      key={`${bill.id ?? bill.name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-md p-2 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{bill.name}</p>
                        <p
                          className={`text-xs ${
                            urgency === 'overdue'
                              ? 'text-red-600'
                              : urgency === 'due-soon'
                                ? 'text-amber-700'
                                : 'text-muted-foreground'
                          }`}
                        >
                          <span className="inline-flex items-center">
                            <CalendarClock className="mr-1 h-3.5 w-3.5" />
                            {dueDate ? format(dueDate, 'MMM d, yyyy') : 'No due date'}
                          </span>
                        </p>
                      </div>

                      <div className="text-sm font-medium">
                        {formatCurrency(Number(bill.expectedAmount || 0))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="rounded-lg lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Budget Snapshot</CardTitle>
              <CardDescription>
                How your current spending compares to your budgets.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="rounded-md"
              onClick={() => router.push('/budgets')}
            >
              View Budgets
            </Button>
          </CardHeader>
          <CardContent>
            {budgetSnapshot.top.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No budgets yet. Create one to start tracking spending limits.
              </p>
            ) : (
              <div className="space-y-4">
                {budgetSnapshot.top.map((budget, index) => {
                  const progress = Math.min(budget.percent, 100);

                  return (
                    <div key={`${budget.id ?? budget.category}-${index}`} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{budget.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(budget.spent)} of {formatCurrency(budget.limit)}
                          </p>
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            budget.percent > 100
                              ? 'text-red-600'
                              : budget.percent >= 80
                                ? 'text-amber-700'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {budget.percent.toFixed(0)}%
                        </div>
                      </div>

                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            budget.percent > 100
                              ? 'bg-red-500'
                              : budget.percent >= 80
                                ? 'bg-amber-500'
                                : 'bg-primary'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {budgetSnapshot.overBudgetCount > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {budgetSnapshot.overBudgetCount} budget
                    {budgetSnapshot.overBudgetCount > 1 ? 's are' : ' is'} over limit.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg lg:col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Add new activity without leaving the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <TransactionForm />
            <BillForm />
            <BudgetForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}