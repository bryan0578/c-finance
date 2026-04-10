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
    return 'bg-orange-50 text-orange-700 ring-orange-200';
  }
  if (key.includes('rent') || key.includes('bill') || key.includes('util')) {
    return 'bg-red-50 text-red-700 ring-red-200';
  }
  if (key.includes('transport') || key.includes('gas') || key.includes('uber')) {
    return 'bg-blue-50 text-blue-700 ring-blue-200';
  }
  if (key.includes('salary') || key.includes('pay') || key.includes('income')) {
    return 'bg-green-50 text-green-700 ring-green-200';
  }
  if (
    key.includes('fun') ||
    key.includes('entertain') ||
    key.includes('movie') ||
    key.includes('game')
  ) {
    return 'bg-purple-50 text-purple-700 ring-purple-200';
  }

  return 'bg-gray-50 text-gray-700 ring-gray-200';
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
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    }

    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
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
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            Search, sort, edit, and export your income and expenses.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className=""
            onClick={() => exportTransactionsToCsv(processedTransactions)}
            disabled={processedTransactions.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <TransactionForm />
        </div>
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search category, note, or type"
                  className="h-10 pl-9"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={typeFilter === 'all' ? 'default' : 'outline'}
                  className=""
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
                  className=""
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
                  className=""
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
                <SelectTrigger className="h-10 w-[180px]">
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
          ) : processedTransactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No transactions match your current filters.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className=""
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
              <div className="overflow-x-auto border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => handleSort('date')}
                          className="inline-flex items-center font-medium"
                        >
                          Date
                          {renderSortIcon('date')}
                        </button>
                      </TableHead>

                      <TableHead>
                        <button
                          type="button"
                          onClick={() => handleSort('type')}
                          className="inline-flex items-center font-medium"
                        >
                          Type
                          {renderSortIcon('type')}
                        </button>
                      </TableHead>

                      <TableHead>
                        <button
                          type="button"
                          onClick={() => handleSort('category')}
                          className="inline-flex items-center font-medium"
                        >
                          Category
                          {renderSortIcon('category')}
                        </button>
                      </TableHead>

                      <TableHead>
                        <button
                          type="button"
                          onClick={() => handleSort('note')}
                          className="inline-flex items-center font-medium"
                        >
                          Note
                          {renderSortIcon('note')}
                        </button>
                      </TableHead>

                      <TableHead className="text-right">
                        <button
                          type="button"
                          onClick={() => handleSort('amount')}
                          className="inline-flex items-center justify-end font-medium"
                        >
                          Amount
                          {renderSortIcon('amount')}
                        </button>
                      </TableHead>

                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedTransactions.map((tx) => {
                        const parsedDate = parseTransactionDate(tx.date);

                        return (
                        <TableRow
                            key={tx.id}
                            className="transition-colors hover:bg-muted/40"
                        >
                            <TableCell className="whitespace-nowrap text-sm">
                            {parsedDate ? format(parsedDate, 'MMM d, yyyy') : '—'}
                            </TableCell>

                            <TableCell>
                            <span
                                className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${
                                tx.type === 'income'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                            >
                                {tx.type === 'income' ? 'Income' : 'Expense'}
                            </span>
                            </TableCell>

                            <TableCell>
                            <span
                                className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${getCategoryChipClass(
                                tx.category
                                )}`}
                            >
                                {tx.category}
                            </span>
                            </TableCell>

                            <TableCell className="max-w-[280px]">
                            <div className="truncate text-muted-foreground">
                                {tx.note || '—'}
                            </div>
                            </TableCell>

                            <TableCell
                            className={`text-right font-medium ${
                                tx.type === 'income' ? 'text-green-600' : 'text-foreground'
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
                                className="text-red-600 hover:text-red-700"
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
                <p className="text-sm text-muted-foreground">
                  Showing page {currentPageSafe} of {totalPages}
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className=""
                    disabled={currentPageSafe === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className=""
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