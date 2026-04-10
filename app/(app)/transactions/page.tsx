'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, isThisMonth, isThisYear, subDays } from 'date-fns';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Search } from 'lucide-react';

import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionForm } from '@/components/forms/transaction-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TransactionType = 'income' | 'expense';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  note: string;
}

type TypeFilter = 'all' | TransactionType;
type DateFilter = 'all' | 'this-month' | 'last-30-days' | 'this-year';

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function normalizeTransaction(raw: any): Transaction {
  return {
    id: String(raw.id ?? ''),
    type: raw.type === 'income' ? 'income' : 'expense',
    amount: Number(raw.amount ?? 0),
    category: String(raw.category ?? 'Uncategorized'),
    date: String(raw.date ?? ''),
    note: String(raw.note ?? ''),
  };
}

export default function TransactionsPage() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/transactions`;
    const q = query(collection(db, path), orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs = snapshot.docs.map((doc) =>
          normalizeTransaction({
            id: doc.id,
            ...doc.data(),
          })
        );

        setTransactions(txs);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const filteredTransactions = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return transactions.filter((tx) => {
      const txDate = tx.date ? new Date(tx.date) : null;

      const matchesSearch =
        !searchValue ||
        tx.category.toLowerCase().includes(searchValue) ||
        tx.note.toLowerCase().includes(searchValue) ||
        tx.type.toLowerCase().includes(searchValue);

      const matchesType =
        typeFilter === 'all' ? true : tx.type === typeFilter;

      const matchesDate =
        dateFilter === 'all'
          ? true
          : txDate instanceof Date && !Number.isNaN(txDate.getTime())
            ? dateFilter === 'this-month'
              ? isThisMonth(txDate)
              : dateFilter === 'last-30-days'
                ? txDate >= subDays(new Date(), 30)
                : isThisYear(txDate)
            : false;

      return matchesSearch && matchesType && matchesDate;
    });
  }, [transactions, search, typeFilter, dateFilter]);

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenses = filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      count: filteredTransactions.length,
      income,
      expenses,
      net: income - expenses,
    };
  }, [filteredTransactions]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            Search, filter, and review your income and expenses.
          </p>
        </div>

        <TransactionForm />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visible transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.count}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">
              {formatCurrency(summary.income)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">
              {formatCurrency(summary.expenses)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${
                summary.net >= 0 ? 'text-foreground' : 'text-red-600'
              }`}
            >
              {summary.net >= 0 ? '+' : ''}
              {formatCurrency(summary.net)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Transaction history</CardTitle>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search category, note, or type"
                  className="h-10 rounded-md pl-9"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={typeFilter === 'all' ? 'default' : 'outline'}
                  className="rounded-md"
                  onClick={() => setTypeFilter('all')}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={typeFilter === 'income' ? 'default' : 'outline'}
                  className="rounded-md"
                  onClick={() => setTypeFilter('income')}
                >
                  Income
                </Button>
                <Button
                  type="button"
                  variant={typeFilter === 'expense' ? 'default' : 'outline'}
                  className="rounded-md"
                  onClick={() => setTypeFilter('expense')}
                >
                  Expenses
                </Button>
              </div>

              <Select
                value={dateFilter}
                onValueChange={(value) => setDateFilter(value as DateFilter)}
              >
                <SelectTrigger className="h-10 w-[180px] rounded-md">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="this-month">This month</SelectItem>
                  <SelectItem value="last-30-days">Last 30 days</SelectItem>
                  <SelectItem value="this-year">This year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No transactions yet. Add your first one to get started.
              </p>
              <div className="mt-4 flex justify-center">
                <TransactionForm />
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No transactions match your current filters.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('all');
                    setDateFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const parsedDate = tx.date ? new Date(tx.date) : null;
                    const validDate =
                      parsedDate instanceof Date &&
                      !Number.isNaN(parsedDate.getTime());

                    return (
                      <TableRow
                        key={tx.id}
                        className="transition-colors hover:bg-muted/40"
                        title={`${tx.type === 'income' ? 'Income' : 'Expense'} • ${
                          tx.category
                        } • ${formatCurrency(tx.amount)}`}
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          {validDate ? format(parsedDate, 'MMM d, yyyy') : '—'}
                        </TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                              tx.type === 'income'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {tx.type === 'income' ? 'Income' : 'Expense'}
                          </span>
                        </TableCell>

                        <TableCell className="font-medium">
                          {tx.category}
                        </TableCell>

                        <TableCell className="max-w-[320px]">
                          <div
                            className="truncate text-muted-foreground"
                            title={tx.note || 'No note'}
                          >
                            {tx.note || '—'}
                          </div>
                        </TableCell>

                        <TableCell
                          className={`text-right font-medium ${
                            tx.type === 'income'
                              ? 'text-green-600'
                              : 'text-foreground'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}