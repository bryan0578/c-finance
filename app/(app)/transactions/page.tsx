'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  format,
  isThisMonth,
  isThisYear,
  isValid,
  parseISO,
  subDays,
} from 'date-fns';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Search,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionForm } from '@/components/forms/transaction-form';
import { EditTransactionDialog } from '@/components/forms/edit-transaction-dialog';
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
type SortField = 'date' | 'type' | 'category' | 'note' | 'amount';
type SortDirection = 'asc' | 'desc';

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function parseTransactionDate(value: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
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

function getCategoryChipClass(category: string) {
  const key = category.toLowerCase();

  if (key.includes('food') || key.includes('grocer') || key.includes('dining')) {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  if (key.includes('rent') || key.includes('bill') || key.includes('util')) {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  if (key.includes('transport') || key.includes('gas') || key.includes('uber')) {
    return 'bg-sky-50 text-sky-700 ring-sky-200';
  }
  if (key.includes('salary') || key.includes('pay') || key.includes('income')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (
    key.includes('fun') ||
    key.includes('entertain') ||
    key.includes('movie') ||
    key.includes('game')
  ) {
    return 'bg-purple-50 text-purple-700 ring-purple-200';
  }

  return 'bg-slate-50 text-slate-700 ring-slate-200';
}

function exportTransactionsToCsv(rows: Transaction[]) {
  const headers = ['Date', 'Type', 'Category', 'Note', 'Amount'];

  const escapeCsvValue = (value: string | number) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const csvRows = [
    headers.join(','),
    ...rows.map((tx) =>
      [
        escapeCsvValue(tx.date),
        escapeCsvValue(tx.type),
        escapeCsvValue(tx.category),
        escapeCsvValue(tx.note),
        escapeCsvValue(tx.amount),
      ].join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = format(new Date(), 'yyyy-MM-dd');

  link.href = url;
  link.setAttribute('download', `transactions-${stamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/transactions`;
    const q = query(collection(db, path), orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs = snapshot.docs.map((docItem) =>
          normalizeTransaction({
            id: docItem.id,
            ...docItem.data(),
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

  async function handleDeleteTransaction(transactionId: string) {
    if (!user) return;

    const confirmed = window.confirm(
      'Delete this transaction? This action cannot be undone.'
    );

    if (!confirmed) return;

    const path = `users/${user.uid}/transactions/${transactionId}`;

    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  function handleSort(field: SortField) {
    setCurrentPage(1);

    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc');
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-slate-400" />;
    }

    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4 text-slate-600" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-slate-600" />
    );
  }

  const processedTransactions = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const filtered = transactions.filter((tx) => {
      const txDate = parseTransactionDate(tx.date);

      const matchesSearch =
        !searchValue ||
        tx.category.toLowerCase().includes(searchValue) ||
        tx.note.toLowerCase().includes(searchValue) ||
        tx.type.toLowerCase().includes(searchValue);

      const matchesType = typeFilter === 'all' || tx.type === typeFilter;

      const matchesDate =
        dateFilter === 'all'
          ? true
          : txDate
            ? dateFilter === 'this-month'
              ? isThisMonth(txDate)
              : dateFilter === 'last-30-days'
                ? txDate >= subDays(new Date(), 30)
                : isThisYear(txDate)
            : false;

      return matchesSearch && matchesType && matchesDate;
    });

    const sorted = [...filtered].sort((a, b) => {
      let result = 0;

      switch (sortField) {
        case 'date': {
          const dateA = parseTransactionDate(a.date)?.getTime() ?? 0;
          const dateB = parseTransactionDate(b.date)?.getTime() ?? 0;
          result = dateA - dateB;
          break;
        }
        case 'amount':
          result = a.amount - b.amount;
          break;
        case 'type':
          result = a.type.localeCompare(b.type);
          break;
        case 'category':
          result = a.category.localeCompare(b.category);
          break;
        case 'note':
          result = a.note.localeCompare(b.note);
          break;
      }

      return sortDirection === 'asc' ? result : -result;
    });

    return sorted;
  }, [transactions, search, typeFilter, dateFilter, sortField, sortDirection]);

  const summary = useMemo(() => {
    const income = processedTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenses = processedTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      count: processedTransactions.length,
      income,
      expenses,
      net: income - expenses,
    };
  }, [processedTransactions]);

  const totalPages = Math.max(1, Math.ceil(processedTransactions.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);

  const paginatedTransactions = processedTransactions.slice(
    (currentPageSafe - 1) * pageSize,
    currentPageSafe * pageSize
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Transactions
          </h1>
          <p className="text-slate-500">
            Search, sort, edit, and export your income and expenses.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
            onClick={() => exportTransactionsToCsv(processedTransactions)}
            disabled={processedTransactions.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>

          <TransactionForm
            trigger={
              <Button className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                Add Transaction
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Visible transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {summary.count}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.income)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.expenses)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${
                summary.net >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {summary.net >= 0 ? '+' : ''}
              {formatCurrency(summary.net)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-slate-900">Transaction history</CardTitle>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search category, note, or type"
                  className="h-10 border-slate-200 pl-9 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={typeFilter === 'all' ? 'default' : 'outline'}
                  className={
                    typeFilter === 'all'
                      ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
                  }
                  onClick={() => {
                    setTypeFilter('all');
                    setCurrentPage(1);
                  }}
                >
                  All
                </Button>

                <Button
                  type="button"
                  variant={typeFilter === 'income' ? 'default' : 'outline'}
                  className={
                    typeFilter === 'income'
                      ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
                  }
                  onClick={() => {
                    setTypeFilter('income');
                    setCurrentPage(1);
                  }}
                >
                  Income
                </Button>

                <Button
                  type="button"
                  variant={typeFilter === 'expense' ? 'default' : 'outline'}
                  className={
                    typeFilter === 'expense'
                      ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
                  }
                  onClick={() => {
                    setTypeFilter('expense');
                    setCurrentPage(1);
                  }}
                >
                  Expenses
                </Button>
              </div>

              <Select
                value={dateFilter}
                onValueChange={(value) => {
                  setDateFilter(value as DateFilter);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-[180px] rounded-md border-slate-200 bg-white text-slate-900">
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
            <div className="py-8 text-center text-slate-500">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">
                No transactions yet. Add your first one to get started.
              </p>
              <div className="mt-4 flex justify-center">
                <TransactionForm
                  trigger={
                    <Button className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                      Add Transaction
                    </Button>
                  }
                />
              </div>
            </div>
          ) : processedTransactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">
                No transactions match your current filters.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
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
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-slate-600">
                        <button
                          type="button"
                          onClick={() => handleSort('date')}
                          className="inline-flex items-center font-medium"
                        >
                          Date
                          {renderSortIcon('date')}
                        </button>
                      </TableHead>

                      <TableHead className="text-slate-600">
                        <button
                          type="button"
                          onClick={() => handleSort('type')}
                          className="inline-flex items-center font-medium"
                        >
                          Type
                          {renderSortIcon('type')}
                        </button>
                      </TableHead>

                      <TableHead className="text-slate-600">
                        <button
                          type="button"
                          onClick={() => handleSort('category')}
                          className="inline-flex items-center font-medium"
                        >
                          Category
                          {renderSortIcon('category')}
                        </button>
                      </TableHead>

                      <TableHead className="text-slate-600">
                        <button
                          type="button"
                          onClick={() => handleSort('note')}
                          className="inline-flex items-center font-medium"
                        >
                          Note
                          {renderSortIcon('note')}
                        </button>
                      </TableHead>

                      <TableHead className="text-right text-slate-600">
                        <button
                          type="button"
                          onClick={() => handleSort('amount')}
                          className="inline-flex items-center justify-end font-medium"
                        >
                          Amount
                          {renderSortIcon('amount')}
                        </button>
                      </TableHead>

                      <TableHead className="text-right text-slate-600">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedTransactions.map((tx) => {
                      const parsedDate = parseTransactionDate(tx.date);

                      return (
                        <TableRow
                          key={tx.id}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <TableCell className="whitespace-nowrap text-sm text-slate-700">
                            {parsedDate ? format(parsedDate, 'MMM d, yyyy') : '—'}
                          </TableCell>

                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                tx.type === 'income'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {tx.type === 'income' ? 'Income' : 'Expense'}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getCategoryChipClass(
                                tx.category
                              )}`}
                            >
                              {tx.category}
                            </span>
                          </TableCell>

                          <TableCell className="max-w-[280px]">
                            <div className="truncate text-slate-500">
                              {tx.note || '—'}
                            </div>
                          </TableCell>

                          <TableCell
                            className={`text-right font-medium ${
                              tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <EditTransactionDialog
                                userId={user.uid}
                                transaction={tx}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-md border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                onClick={() => handleDeleteTransaction(tx.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing page {currentPageSafe} of {totalPages}
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                    disabled={currentPageSafe === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                    disabled={currentPageSafe === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}