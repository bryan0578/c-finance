'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  isThisMonth,
  isThisYear,
  isValid,
  isToday,
  isYesterday,
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
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Link2Off,
  Receipt,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TransactionType = 'income' | 'expense';
type TypeFilter = 'all' | TransactionType;
type DateFilter = 'all' | 'this-month' | 'last-30-days' | 'this-year';
type BillMatchFilter = 'all' | 'matched' | 'unmatched';
type ReviewFilter = 'all' | 'needs-review' | 'duplicates' | 'recurring-candidate';
type SortField = 'date' | 'type' | 'category' | 'note' | 'amount';
type SortDirection = 'asc' | 'desc';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  note: string;
  linkedRecurringId?: string | null;
}

interface Bill {
  id: string;
  name: string;
}

interface EnrichedTransaction extends Transaction {
  linkedBillName?: string;
  duplicateGroupKey?: string;
  isDuplicate: boolean;
  recurringCandidate: boolean;
  needsReview: boolean;
}

interface ColumnVisibility {
  type: boolean;
  category: boolean;
  note: boolean;
  amount: boolean;
  actions: boolean;
}

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
    linkedRecurringId: raw.linkedRecurringId
      ? String(raw.linkedRecurringId)
      : undefined,
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

function getDateGroupLabel(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisMonth(date)) return 'Earlier this month';
  if (isThisYear(date)) return format(date, 'MMMM yyyy');
  return format(date, 'yyyy');
}

function exportTransactionsToCsv(rows: Transaction[]) {
  const headers = ['Date', 'Type', 'Category', 'Note', 'Amount', 'Linked Bill'];

  const escapeCsvValue = (value: string | number | null | undefined) =>
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
        escapeCsvValue(tx.linkedRecurringId),
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
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [billMatchFilter, setBillMatchFilter] = useState<BillMatchFilter>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<Transaction | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<EnrichedTransaction | null>(null);

  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [confirmBulkUnlinkOpen, setConfirmBulkUnlinkOpen] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUnlinking, setIsBulkUnlinking] = useState(false);

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    type: true,
    category: true,
    note: true,
    amount: true,
    actions: true,
  });

  const [showColumnOptions, setShowColumnOptions] = useState(false);

  const pageSize = 15;
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;

    let transactionsLoaded = false;
    let billsLoaded = false;

    const transactionsPath = `users/${user.uid}/transactions`;
    const transactionsQuery = query(
      collection(db, transactionsPath),
      orderBy('date', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        const txs = snapshot.docs.map((docItem) =>
          normalizeTransaction({
            id: docItem.id,
            ...docItem.data(),
          })
        );

        setTransactions(txs);
        transactionsLoaded = true;
        if (transactionsLoaded && billsLoaded) {
          setLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, transactionsPath);
        setLoading(false);
      }
    );

    const billsPath = `users/${user.uid}/recurring`;
    const billsQuery = query(collection(db, billsPath), orderBy('name', 'asc'));

    const unsubscribeBills = onSnapshot(
      billsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          name: String(docItem.data().name ?? 'Untitled Bill'),
        }));
        setBills(items);
        billsLoaded = true;
        if (transactionsLoaded && billsLoaded) {
          setLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, billsPath);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTransactions();
      unsubscribeBills();
    };
  }, [user]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement !== searchInputRef.current) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const billNameById = useMemo(() => {
    return Object.fromEntries(bills.map((bill) => [bill.id, bill.name]));
  }, [bills]);

  const enrichedTransactions = useMemo<EnrichedTransaction[]>(() => {
    const duplicateBuckets = new Map<string, number>();
    const recurringBuckets = new Map<string, number>();

    for (const tx of transactions) {
      const date = parseTransactionDate(tx.date);
      const dayKey = date ? format(date, 'yyyy-MM-dd') : 'unknown';
      const duplicateKey = [
        tx.type,
        tx.category.trim().toLowerCase(),
        tx.amount.toFixed(2),
        dayKey,
      ].join('|');

      duplicateBuckets.set(duplicateKey, (duplicateBuckets.get(duplicateKey) ?? 0) + 1);

      if (tx.type === 'expense') {
        const recurringKey = tx.category.trim().toLowerCase();
        recurringBuckets.set(
          recurringKey,
          (recurringBuckets.get(recurringKey) ?? 0) + 1
        );
      }
    }

    return transactions.map((tx) => {
      const date = parseTransactionDate(tx.date);
      const dayKey = date ? format(date, 'yyyy-MM-dd') : 'unknown';
      const duplicateGroupKey = [
        tx.type,
        tx.category.trim().toLowerCase(),
        tx.amount.toFixed(2),
        dayKey,
      ].join('|');

      const isDuplicate = (duplicateBuckets.get(duplicateGroupKey) ?? 0) > 1;
      const recurringCandidate =
        tx.type === 'expense' &&
        !tx.linkedRecurringId &&
        (recurringBuckets.get(tx.category.trim().toLowerCase()) ?? 0) >= 3;

      const genericCategory =
        ['other', 'misc', 'miscellaneous', 'uncategorized'].includes(
          tx.category.trim().toLowerCase()
        );

      const needsReview =
        isDuplicate ||
        recurringCandidate ||
        (tx.type === 'expense' && !tx.linkedRecurringId && genericCategory) ||
        (tx.type === 'expense' && !tx.linkedRecurringId && tx.amount >= 500);

      return {
        ...tx,
        linkedBillName: tx.linkedRecurringId
          ? billNameById[tx.linkedRecurringId] ?? undefined
          : undefined,
        duplicateGroupKey,
        isDuplicate,
        recurringCandidate,
        needsReview,
      };
    });
  }, [transactions, billNameById]);

  const processedTransactions = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const filtered = enrichedTransactions.filter((tx) => {
      const txDate = parseTransactionDate(tx.date);
      const linkedBillName = (tx.linkedBillName ?? '').toLowerCase();

      const matchesSearch =
        !searchValue ||
        tx.category.toLowerCase().includes(searchValue) ||
        tx.note.toLowerCase().includes(searchValue) ||
        tx.type.toLowerCase().includes(searchValue) ||
        linkedBillName.includes(searchValue);

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

      const matchesBillLink =
        billMatchFilter === 'all'
          ? true
          : billMatchFilter === 'matched'
            ? Boolean(tx.linkedRecurringId)
            : !tx.linkedRecurringId;

      const matchesReview =
        reviewFilter === 'all'
          ? true
          : reviewFilter === 'needs-review'
            ? tx.needsReview
            : reviewFilter === 'duplicates'
              ? tx.isDuplicate
              : tx.recurringCandidate;

      return (
        matchesSearch &&
        matchesType &&
        matchesDate &&
        matchesBillLink &&
        matchesReview
      );
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
  }, [
    enrichedTransactions,
    search,
    typeFilter,
    dateFilter,
    billMatchFilter,
    reviewFilter,
    sortField,
    sortDirection,
  ]);

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
      matchedCount: processedTransactions.filter((tx) => tx.linkedRecurringId).length,
      unmatchedExpenseCount: processedTransactions.filter(
        (tx) => tx.type === 'expense' && !tx.linkedRecurringId
      ).length,
      needsReviewCount: processedTransactions.filter((tx) => tx.needsReview).length,
      duplicateCount: processedTransactions.filter((tx) => tx.isDuplicate).length,
    };
  }, [processedTransactions]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, EnrichedTransaction[]>();

    for (const tx of processedTransactions) {
      const parsedDate = parseTransactionDate(tx.date);
      const groupLabel = parsedDate ? getDateGroupLabel(parsedDate) : 'Unknown date';

      if (!groups.has(groupLabel)) {
        groups.set(groupLabel, []);
      }
      groups.get(groupLabel)!.push(tx);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items,
    }));
  }, [processedTransactions]);

  const totalPages = Math.max(1, Math.ceil(processedTransactions.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);

  const paginatedTransactions = processedTransactions.slice(
    (currentPageSafe - 1) * pageSize,
    currentPageSafe * pageSize
  );

  const selectedTransactions = useMemo(
    () => processedTransactions.filter((tx) => selectedIds.includes(tx.id)),
    [processedTransactions, selectedIds]
  );

  const selectableOnPage = paginatedTransactions.map((tx) => tx.id);
  const allOnPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((id) => selectedIds.includes(id));

  function toggleSelectAllOnPage(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selectableOnPage])));
      return;
    }

    setSelectedIds((prev) => prev.filter((id) => !selectableOnPage.includes(id)));
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((item) => item !== id)
    );
  }

  async function handleDeleteTransaction() {
    if (!user || !deleteTarget) return;

    const path = `users/${user.uid}/transactions/${deleteTarget.id}`;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, path));
      setDeleteTarget(null);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleUnlinkBillMatch() {
    if (!user || !unlinkTarget) return;

    const path = `users/${user.uid}/transactions/${unlinkTarget.id}`;

    try {
      setIsUnlinking(true);
      await updateDoc(doc(db, path), {
        linkedRecurringId: null,
      });
      setUnlinkTarget(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsUnlinking(false);
    }
  }

  async function handleBulkDelete() {
    if (!user || selectedIds.length === 0) return;

    try {
      setIsBulkDeleting(true);
      const batch = writeBatch(db);

      for (const id of selectedIds) {
        batch.delete(doc(db, `users/${user.uid}/transactions/${id}`));
      }

      await batch.commit();
      setSelectedIds([]);
      setConfirmBulkDeleteOpen(false);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `users/${user.uid}/transactions`
      );
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleBulkUnlink() {
    if (!user || selectedIds.length === 0) return;

    try {
      setIsBulkUnlinking(true);
      const batch = writeBatch(db);

      for (const tx of selectedTransactions) {
        if (!tx.linkedRecurringId) continue;
        batch.update(doc(db, `users/${user.uid}/transactions/${tx.id}`), {
          linkedRecurringId: null,
        });
      }

      await batch.commit();
      setSelectedIds([]);
      setConfirmBulkUnlinkOpen(false);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `users/${user.uid}/transactions`
      );
    } finally {
      setIsBulkUnlinking(false);
    }
  }

  async function handleBulkRecategorize() {
    if (!user || selectedIds.length === 0) return;

    const nextCategory = window.prompt('Enter a new category for selected transactions');

    if (!nextCategory?.trim()) return;

    try {
      const batch = writeBatch(db);

      for (const id of selectedIds) {
        batch.update(doc(db, `users/${user.uid}/transactions/${id}`), {
          category: nextCategory.trim(),
        });
      }

      await batch.commit();
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `users/${user.uid}/transactions`
      );
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

  function renderQuickFilter(
    label: string,
    active: boolean,
    onClick: () => void
  ) {
    return (
      <Button
        type="button"
        variant={active ? 'default' : 'outline'}
        className={
          active
            ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
            : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
        }
        onClick={onClick}
      >
        {label}
      </Button>
    );
  }

  if (!user) return null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Transactions
            </h1>
            <p className="text-slate-500">
              Search, sort, edit, review bill matches, and manage transaction cleanup.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setShowColumnOptions((prev) => !prev)}
              >
                Columns
              </Button>

              {showColumnOptions && (
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="space-y-2">
                    {(
                      Object.keys(columnVisibility) as Array<keyof ColumnVisibility>
                    ).map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={columnVisibility[key]}
                          onChange={(event) =>
                            setColumnVisibility((prev) => ({
                              ...prev,
                              [key]: event.target.checked,
                            }))
                          }
                        />
                        <span className="capitalize">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <TransactionForm
              trigger={
                <Button className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                  Add Transaction
                </Button>
              }
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <Card className="rounded-lg border border-indigo-200 bg-indigo-50/50 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-900">
                  {selectedIds.length} transaction
                  {selectedIds.length > 1 ? 's' : ''} selected
                </p>
                <p className="text-sm text-indigo-700">
                  Bulk edit, unlink, export, or delete your selection.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                  onClick={() => exportTransactionsToCsv(selectedTransactions)}
                >
                  Export selected
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                  onClick={handleBulkRecategorize}
                >
                  Recategorize
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                  onClick={() => setConfirmBulkUnlinkOpen(true)}
                  disabled={!selectedTransactions.some((tx) => tx.linkedRecurringId)}
                >
                  <Link2Off className="mr-2 h-4 w-4" />
                  Unlink selected
                </Button>

                <Button
                  type="button"
                  className="rounded-md bg-rose-600 text-white hover:bg-rose-700"
                  onClick={() => setConfirmBulkDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete selected
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Visible transactions
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Receipt className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900">
                {summary.count}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Income
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900">
                {formatCurrency(summary.income)}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Expenses
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-700">
                <TrendingDown className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900">
                {formatCurrency(summary.expenses)}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Net
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                <Wallet className="h-4 w-4" />
              </div>
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

        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="rounded-lg border border-slate-200 bg-white shadow-sm xl:col-span-3">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-slate-900">Transaction history</CardTitle>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative min-w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      ref={searchInputRef}
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search category, note, type, or bill"
                      className="h-10 border-slate-200 pl-9 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  <Select
                    value={typeFilter}
                    onValueChange={(value) => {
                      setTypeFilter(value as TypeFilter);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 w-[150px] rounded-md border-slate-200 bg-white text-slate-900">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>

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

                  <Select
                    value={billMatchFilter}
                    onValueChange={(value) => {
                      setBillMatchFilter(value as BillMatchFilter);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 w-[180px] rounded-md border-slate-200 bg-white text-slate-900">
                      <SelectValue placeholder="Bill match" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All transactions</SelectItem>
                      <SelectItem value="matched">Matched bills only</SelectItem>
                      <SelectItem value="unmatched">Unmatched only</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={reviewFilter}
                    onValueChange={(value) => {
                      setReviewFilter(value as ReviewFilter);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 w-[190px] rounded-md border-slate-200 bg-white text-slate-900">
                      <SelectValue placeholder="Review state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All review states</SelectItem>
                      <SelectItem value="needs-review">Needs review</SelectItem>
                      <SelectItem value="duplicates">Duplicates</SelectItem>
                      <SelectItem value="recurring-candidate">
                        Recurring candidates
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {renderQuickFilter('Needs review', reviewFilter === 'needs-review', () => {
                  setReviewFilter('needs-review');
                  setCurrentPage(1);
                })}
                {renderQuickFilter('Duplicates', reviewFilter === 'duplicates', () => {
                  setReviewFilter('duplicates');
                  setCurrentPage(1);
                })}
                {renderQuickFilter(
                  'Matched bills',
                  billMatchFilter === 'matched',
                  () => {
                    setBillMatchFilter('matched');
                    setCurrentPage(1);
                  }
                )}
                {renderQuickFilter(
                  'Unmatched expenses',
                  billMatchFilter === 'unmatched',
                  () => {
                    setBillMatchFilter('unmatched');
                    setTypeFilter('expense');
                    setCurrentPage(1);
                  }
                )}
                {renderQuickFilter(
                  'Recurring candidates',
                  reviewFilter === 'recurring-candidate',
                  () => {
                    setReviewFilter('recurring-candidate');
                    setCurrentPage(1);
                  }
                )}
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
                        setBillMatchFilter('all');
                        setReviewFilter('all');
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
                      <TableHeader className="sticky top-0 z-10 bg-white">
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="w-[44px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={allOnPageSelected}
                              onChange={(event) =>
                                toggleSelectAllOnPage(event.target.checked)
                              }
                            />
                          </TableHead>

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

                          {columnVisibility.type && (
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
                          )}

                          {columnVisibility.category && (
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
                          )}

                          {columnVisibility.note && (
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
                          )}

                          {columnVisibility.amount && (
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
                          )}

                          {columnVisibility.actions && (
                            <TableHead className="text-right text-slate-600">
                              Actions
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {paginatedTransactions.map((tx, index) => {
                          const parsedDate = parseTransactionDate(tx.date);
                          const groupLabel = parsedDate
                            ? getDateGroupLabel(parsedDate)
                            : 'Unknown date';

                          const previous = paginatedTransactions[index - 1];
                          const previousDate = previous
                            ? parseTransactionDate(previous.date)
                            : null;
                          const previousGroupLabel = previousDate
                            ? getDateGroupLabel(previousDate)
                            : null;

                          const showGroup = index === 0 || groupLabel !== previousGroupLabel;

                          return (
                            <>
                              {showGroup && (
                                <TableRow key={`${tx.id}-group`} className="bg-slate-50/40 hover:bg-slate-50/40">
                                  <TableCell
                                    colSpan={
                                      2 +
                                      (columnVisibility.type ? 1 : 0) +
                                      (columnVisibility.category ? 1 : 0) +
                                      (columnVisibility.note ? 1 : 0) +
                                      (columnVisibility.amount ? 1 : 0) +
                                      (columnVisibility.actions ? 1 : 0)
                                    }
                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                  >
                                    {groupLabel}
                                  </TableCell>
                                </TableRow>
                              )}

                              <TableRow
                                key={tx.id}
                                className="transition-colors hover:bg-slate-50"
                              >
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(tx.id)}
                                    onChange={(event) =>
                                      toggleSelected(tx.id, event.target.checked)
                                    }
                                  />
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-sm text-slate-700">
                                  {parsedDate ? format(parsedDate, 'MMM d, yyyy') : '—'}
                                </TableCell>

                                {columnVisibility.type && (
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
                                )}

                                {columnVisibility.category && (
                                  <TableCell>
                                    <span
                                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getCategoryChipClass(
                                        tx.category
                                      )}`}
                                    >
                                      {tx.category}
                                    </span>
                                  </TableCell>
                                )}

                                {columnVisibility.note && (
                                  <TableCell className="max-w-[340px]">
                                    <div className="space-y-1">
                                      <div className="truncate text-slate-500">
                                        {tx.note || '—'}
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        {tx.linkedRecurringId && (
                                          <>
                                            <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-indigo-50 text-indigo-700 ring-indigo-200">
                                              Matched to bill
                                            </span>

                                            {tx.linkedBillName && (
                                              <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-slate-50 text-slate-700 ring-slate-200">
                                                {tx.linkedBillName}
                                              </span>
                                            )}
                                          </>
                                        )}

                                        {tx.needsReview && (
                                          <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-amber-50 text-amber-700 ring-amber-200">
                                            Needs review
                                          </span>
                                        )}

                                        {tx.isDuplicate && (
                                          <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-rose-50 text-rose-700 ring-rose-200">
                                            Possible duplicate
                                          </span>
                                        )}

                                        {tx.recurringCandidate && (
                                          <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-sky-50 text-sky-700 ring-sky-200">
                                            Looks recurring
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                )}

                                {columnVisibility.amount && (
                                  <TableCell
                                    className={`text-right font-medium ${
                                      tx.type === 'income'
                                        ? 'text-emerald-700'
                                        : 'text-slate-900'
                                    }`}
                                  >
                                    {tx.type === 'income' ? '+' : '-'}
                                    {formatCurrency(tx.amount)}
                                  </TableCell>
                                )}

                                {columnVisibility.actions && (
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                        onClick={() => setDetailsTarget(tx)}
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                      </Button>

                                      <EditTransactionDialog
                                        userId={user.uid}
                                        transaction={tx}
                                      />

                                      {tx.linkedRecurringId && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                                          onClick={() => setUnlinkTarget(tx)}
                                        >
                                          <Link2Off className="mr-2 h-4 w-4" />
                                          Unlink
                                        </Button>
                                      )}

                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-md border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                        onClick={() => setDeleteTarget(tx)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            </>
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
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
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

          <Card className="rounded-lg border border-slate-200 bg-white shadow-sm xl:col-span-1">
            <CardHeader>
              <CardTitle className="text-slate-900">Review summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">Matched bills</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {summary.matchedCount}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">Unmatched expenses</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {summary.unmatchedExpenseCount}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-sm font-medium text-amber-900">Needs review</p>
                <p className="mt-1 text-2xl font-semibold text-amber-900">
                  {summary.needsReviewCount}
                </p>
              </div>

              <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
                <p className="text-sm font-medium text-rose-900">Possible duplicates</p>
                <p className="mt-1 text-2xl font-semibold text-rose-900">
                  {summary.duplicateCount}
                </p>
              </div>

              <p className="text-xs text-slate-500">
                Tip: press <span className="rounded bg-slate-100 px-1 py-0.5">/</span> to jump to search.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="rounded-xl sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              Delete transaction?
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              This will permanently remove this transaction from your records.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {deleteTarget.note || deleteTarget.category}
                </p>
                <p className="text-sm text-slate-500">
                  {deleteTarget.category} •{' '}
                  {parseTransactionDate(deleteTarget.date)
                    ? format(
                        parseTransactionDate(deleteTarget.date) as Date,
                        'MMM d, yyyy'
                      )
                    : '—'}
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {deleteTarget.type === 'income' ? '+' : '-'}
                  {formatCurrency(deleteTarget.amount)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-md bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleDeleteTransaction}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(unlinkTarget)}
        onOpenChange={(open) => {
          if (!open && !isUnlinking) {
            setUnlinkTarget(null);
          }
        }}
      >
        <DialogContent className="rounded-xl sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              Unlink bill match?
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              This will remove the connection between this transaction and the matched bill.
            </DialogDescription>
          </DialogHeader>

          {unlinkTarget && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {unlinkTarget.note || unlinkTarget.category}
                </p>
                <p className="text-sm text-slate-500">
                  Linked bill: {unlinkTarget.linkedRecurringId
                    ? billNameById[unlinkTarget.linkedRecurringId] ?? 'Unknown bill'
                    : '—'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setUnlinkTarget(null)}
              disabled={isUnlinking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleUnlinkBillMatch}
              disabled={isUnlinking}
            >
              {isUnlinking ? 'Unlinking...' : 'Unlink bill match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailsTarget)}
        onOpenChange={(open) => {
          if (!open) setDetailsTarget(null);
        }}
      >
        <DialogContent className="rounded-xl sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              Transaction details
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Review the full transaction record and any bill matching signals.
            </DialogDescription>
          </DialogHeader>

          {detailsTarget && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {parseTransactionDate(detailsTarget.date)
                      ? format(parseTransactionDate(detailsTarget.date) as Date, 'MMM d, yyyy')
                      : '—'}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Amount</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {detailsTarget.type === 'income' ? '+' : '-'}
                    {formatCurrency(detailsTarget.amount)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Category</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {detailsTarget.category}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {detailsTarget.type}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Note</p>
                <p className="mt-1 text-sm text-slate-900">
                  {detailsTarget.note || '—'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Bill link</p>
                <p className="mt-1 text-sm text-slate-900">
                  {detailsTarget.linkedBillName
                    ? `Matched to ${detailsTarget.linkedBillName}`
                    : 'Not linked to a bill'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {detailsTarget.needsReview && (
                  <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-amber-50 text-amber-700 ring-amber-200">
                    Needs review
                  </span>
                )}
                {detailsTarget.isDuplicate && (
                  <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-rose-50 text-rose-700 ring-rose-200">
                    Possible duplicate
                  </span>
                )}
                {detailsTarget.recurringCandidate && (
                  <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 bg-sky-50 text-sky-700 ring-sky-200">
                    Looks recurring
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkDeleteOpen} onOpenChange={setConfirmBulkDeleteOpen}>
        <DialogContent className="rounded-xl sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              Delete selected transactions?
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              This will permanently remove {selectedIds.length} selected transaction
              {selectedIds.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setConfirmBulkDeleteOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-md bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? 'Deleting...' : 'Delete selected'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkUnlinkOpen} onOpenChange={setConfirmBulkUnlinkOpen}>
        <DialogContent className="rounded-xl sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              Unlink selected bill matches?
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              This will remove bill links from selected matched transactions.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setConfirmBulkUnlinkOpen(false)}
              disabled={isBulkUnlinking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleBulkUnlink}
              disabled={isBulkUnlinking}
            >
              {isBulkUnlinking ? 'Unlinking...' : 'Unlink selected'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}