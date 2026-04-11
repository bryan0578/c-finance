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
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Plus
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

function getComparisonTone(value: number | null) {
  if (value === null) return 'text-slate-500';
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-rose-700';
  return 'text-slate-500';
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500">
            Welcome back, {user.displayName || 'User'}!
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={range === '7d' ? 'default' : 'outline'}
            className={
              range === '7d'
                ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
            }
            onClick={() => setRange('7d')}
          >
            7D
          </Button>
          <Button
            type="button"
            variant={range === '30d' ? 'default' : 'outline'}
            className={
              range === '30d'
                ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
            }
            onClick={() => setRange('30d')}
          >
            30D
          </Button>
          <Button
            type="button"
            variant={range === '90d' ? 'default' : 'outline'}
            className={
              range === '90d'
                ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
            }
            onClick={() => setRange('90d')}
          >
            90D
          </Button>
          <Button
            type="button"
            variant={range === 'ytd' ? 'default' : 'outline'}
            className={
              range === 'ytd'
                ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
            }
            onClick={() => setRange('ytd')}
          >
            YTD
          </Button>
        </div>
      </div>

      {(overdueBills.length > 0 || dueSoonBills.length > 0) && (
        <Card className="rounded-lg border border-amber-200 bg-amber-50/70 shadow-sm">
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
              className="rounded-md border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              onClick={() => router.push('/bills')}
            >
              View Bills
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Net Balance ({getRangeLabel(range)})
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {balance >= 0 ? '+' : ''}
              {formatCurrency(balance)}
            </div>
            <p className={`mt-1 text-xs ${getComparisonTone(balanceChange)}`}>
              {balanceChange === null
                ? 'No previous comparison'
                : `${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(1)}% vs previous period`}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Income ({getRangeLabel(range)})
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(income)}
            </div>
            <p className={`mt-1 text-xs ${getComparisonTone(incomeChange)}`}>
              {incomeChange === null
                ? 'No previous comparison'
                : `${incomeChange >= 0 ? '+' : ''}${incomeChange.toFixed(1)}% vs previous period`}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Expenses ({getRangeLabel(range)})
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-700">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(expenses)}
            </div>
            <p className={`mt-1 text-xs ${getComparisonTone(expenseChange)}`}>
              {expenseChange === null
                ? 'No previous comparison'
                : `${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}% vs previous period`}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Savings Rate
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {savingsRate === null ? (
              <p className="text-sm text-slate-500">No income in selected range.</p>
            ) : (
              <>
                <div className="text-2xl font-bold text-slate-900">
                  {savingsRate.toFixed(1)}%
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {income - expenses >= 0
                    ? 'You saved part of your income.'
                    : 'Expenses exceeded income.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Top Spending Category
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-700">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {topCategory ? (
              <>
                <div className="text-2xl font-bold text-slate-900">
                  {topCategory.name}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatCurrency(topCategory.total)} spent
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No expense data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-slate-900">
                {chartView === 'category' ? 'Spending by Category' : 'Expense Trend'}
              </CardTitle>
              <CardDescription className="text-slate-500">
                {chartView === 'category'
                  ? `Expense breakdown for ${getRangeLabel(range).toLowerCase()}.`
                  : `Expense movement over ${getRangeLabel(range).toLowerCase()}.`}
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={chartView === 'category' ? 'default' : 'outline'}
                className={
                  chartView === 'category'
                    ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
                }
                onClick={() => setChartView('category')}
              >
                Category
              </Button>
              <Button
                type="button"
                variant={chartView === 'trend' ? 'default' : 'outline'}
                className={
                  chartView === 'trend'
                    ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
                }
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

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-900">Recent Transactions</CardTitle>
              <CardDescription className="text-slate-500">
                Your latest account activity.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="rounded-md border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => router.push('/transactions')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-slate-500">No transactions yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx, index) => {
                  const txDate = parseDate(tx.date);
                  return (
                    <div
                      key={`${tx.id ?? tx.note ?? tx.category}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-transparent p-2 transition-colors hover:border-slate-200 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {tx.note || tx.category}
                        </p>
                        <p className="text-xs text-slate-500">
                          {tx.category}
                          {txDate ? ` • ${format(txDate, 'MMM d, yyyy')}` : ''}
                        </p>
                      </div>

                      <div
                        className={`shrink-0 text-sm font-medium ${
                          tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <span className="inline-flex items-center">
                            <ArrowUpRight className="mr-1 h-4 w-4 text-emerald-600" />
                            {formatCurrency(tx.amount)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center">
                            <ArrowDownRight className="mr-1 h-4 w-4 text-slate-500" />
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
        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-slate-900">AI Insights</CardTitle>
            <CardDescription className="text-slate-500">
              Personalized observations based on your spending.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights ? (
              <div className="space-y-3">
                <div className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-800 whitespace-pre-wrap">
                  {insights}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                    onClick={() => setInsights('')}
                  >
                    Clear
                  </Button>
                  <Button
                    className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={generateInsights}
                    disabled={loadingInsights}
                  >
                    {loadingInsights ? 'Refreshing...' : 'Refresh Insights'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="max-w-xs text-sm text-slate-500">
                  Analyze your recent spending to find patterns and savings opportunities.
                </p>
                <Button
                  className="mt-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={generateInsights}
                  disabled={loadingInsights}
                >
                  {loadingInsights ? 'Analyzing...' : 'Generate Insights'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-900">Upcoming Bills</CardTitle>
              <CardDescription className="text-slate-500">
                Your next due payments.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
              onClick={() => router.push('/bills')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingBills.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming bills.</p>
            ) : (
              <div className="space-y-3">
                {upcomingBills.map((bill, i) => {
                  const dueDate = parseDate(bill.nextDueDate);
                  const urgency = getBillUrgency(bill);

                  return (
                    <div
                      key={`${bill.id ?? bill.name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-transparent p-2 transition-colors hover:border-slate-200 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {bill.name}
                        </p>
                        <p
                          className={`text-xs ${
                            urgency === 'overdue'
                              ? 'text-rose-700'
                              : urgency === 'due-soon'
                                ? 'text-amber-700'
                                : 'text-slate-500'
                          }`}
                        >
                          <span className="inline-flex items-center">
                            <CalendarClock className="mr-1 h-3.5 w-3.5" />
                            {dueDate ? format(dueDate, 'MMM d, yyyy') : 'No due date'}
                          </span>
                        </p>
                      </div>

                      <div className="text-sm font-medium text-slate-900">
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
        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-900">Budget Snapshot</CardTitle>
              <CardDescription className="text-slate-500">
                How your current spending compares to your budgets.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
              onClick={() => router.push('/budgets')}
            >
              View Budgets
            </Button>
          </CardHeader>
          <CardContent>
            {budgetSnapshot.top.length === 0 ? (
              <p className="text-sm text-slate-500">
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
                          <p className="truncate text-sm font-medium text-slate-900">
                            {budget.category}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(budget.spent)} of {formatCurrency(budget.limit)}
                          </p>
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            budget.percent > 100
                              ? 'text-rose-700'
                              : budget.percent >= 80
                                ? 'text-amber-700'
                                : 'text-slate-500'
                          }`}
                        >
                          {budget.percent.toFixed(0)}%
                        </div>
                      </div>

                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            budget.percent > 100
                              ? 'bg-rose-500'
                              : budget.percent >= 80
                                ? 'bg-amber-500'
                                : 'bg-indigo-600'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {budgetSnapshot.overBudgetCount > 0 && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {budgetSnapshot.overBudgetCount} budget
                    {budgetSnapshot.overBudgetCount > 1 ? 's are' : ' is'} over limit.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-slate-900">Quick Actions</CardTitle>
            <CardDescription className="text-slate-500">
              Add new activity without leaving the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
                <TransactionForm
                    trigger={
                    <Button
                        variant="outline"
                        className="h-24 w-full flex-col gap-2 rounded-lg border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                    >
                        <Plus className="h-5 w-5" />
                        Add Transaction
                    </Button>
                    }
                />

                <BillForm
                    trigger={
                    <Button
                        variant="outline"
                        className="h-24 w-full flex-col gap-2 rounded-lg border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                    >
                        <Plus className="h-5 w-5" />
                        Add Bill
                    </Button>
                    }
                />

                <BudgetForm
                    trigger={
                    <Button
                        variant="outline"
                        className="h-24 w-full flex-col gap-2 rounded-lg border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                    >
                        <Plus className="h-5 w-5" />
                        Create Budget
                    </Button>
                    }
                />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}