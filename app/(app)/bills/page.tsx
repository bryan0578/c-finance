'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from 'date-fns';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import {
  CalendarClock,
  Search,
  Trash2,
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
import { BillForm } from '@/components/forms/bill-form';
import { Input } from '@/components/ui/input';
import { EditBillDialog } from '@/components/forms/edit-bill-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type BillType = 'fixed' | 'variable' | 'subscription';
type BillFrequency = 'weekly' | 'monthly' | 'yearly';
type BillStatus = 'overdue' | 'due-soon' | 'upcoming';

interface Bill {
  id: string;
  name: string;
  type: BillType;
  expectedAmount: number;
  frequency: BillFrequency;
  nextDueDate: string;
}

type TypeFilter = 'all' | BillType;
type FrequencyFilter = 'all' | BillFrequency;
type StatusFilter = 'all' | BillStatus;

const DUE_SOON_DAYS = 7;

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function parseBillDate(value: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeBill(raw: any): Bill {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? 'Untitled Bill'),
    type:
      raw.type === 'variable' || raw.type === 'subscription'
        ? raw.type
        : 'fixed',
    expectedAmount: Number(raw.expectedAmount ?? 0),
    frequency:
      raw.frequency === 'weekly' || raw.frequency === 'yearly'
        ? raw.frequency
        : 'monthly',
    nextDueDate: String(raw.nextDueDate ?? ''),
  };
}

function getBillStatus(bill: Bill): BillStatus {
  const dueDate = parseBillDate(bill.nextDueDate);
  if (!dueDate) return 'upcoming';

  const today = startOfDay(new Date());
  const due = startOfDay(dueDate);
  const dayDiff = differenceInCalendarDays(due, today);

  if (dayDiff < 0) return 'overdue';
  if (dayDiff <= DUE_SOON_DAYS) return 'due-soon';
  return 'upcoming';
}

function getStatusLabel(status: BillStatus) {
  switch (status) {
    case 'overdue':
      return 'Overdue';
    case 'due-soon':
      return 'Due soon';
    case 'upcoming':
      return 'Upcoming';
  }
}

function getStatusBadgeClass(status: BillStatus) {
  switch (status) {
    case 'overdue':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'due-soon':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'upcoming':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
  }
}

function getTypeBadgeClass(type: BillType) {
  switch (type) {
    case 'fixed':
      return 'bg-slate-50 text-slate-700 ring-slate-200';
    case 'variable':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'subscription':
      return 'bg-purple-50 text-purple-700 ring-purple-200';
  }
}

function getFrequencyBadgeClass(frequency: BillFrequency) {
  switch (frequency) {
    case 'weekly':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'monthly':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'yearly':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
  }
}

function advanceDueDate(current: Date, frequency: BillFrequency) {
  if (frequency === 'weekly') return addWeeks(current, 1);
  if (frequency === 'yearly') return addYears(current, 1);
  return addMonths(current, 1);
}

export default function BillsPage() {
  const { user } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/recurring`;
    const q = query(collection(db, path), orderBy('nextDueDate', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedBills = snapshot.docs.map((docItem) =>
          normalizeBill({
            id: docItem.id,
            ...docItem.data(),
          })
        );
        setBills(fetchedBills);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const userId = user?.uid ?? '';

async function handleMarkPaid(bill: Bill) {
  if (!user) return;

  try {
    const txPath = `users/${userId}/transactions`;
    await addDoc(collection(db, txPath), {
      uid: userId,
      type: 'expense',
      amount: bill.expectedAmount,
      category: bill.name,
      date: new Date().toISOString().split('T')[0],
      note: `Paid ${bill.name}`,
      linkedRecurringId: bill.id,
    });

    const dueDate = parseBillDate(bill.nextDueDate) ?? new Date();
    const nextDate = advanceDueDate(dueDate, bill.frequency);

    const billRef = doc(db, `users/${userId}/recurring`, bill.id);
    await updateDoc(billRef, {
      nextDueDate: nextDate.toISOString(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `users/${userId}/recurring/${bill.id}`
    );
  }
}

async function handleDeleteBill(billId: string) {
  if (!user) return;

  const confirmed = window.confirm(
    'Delete this bill? This action cannot be undone.'
  );

  if (!confirmed) return;

  const path = `users/${userId}/recurring/${billId}`;

  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

  const filteredBills = useMemo(() => {
    const queryValue = search.trim().toLowerCase();

    return bills.filter((bill) => {
      const status = getBillStatus(bill);

      const matchesSearch =
        !queryValue ||
        bill.name.toLowerCase().includes(queryValue) ||
        bill.type.toLowerCase().includes(queryValue) ||
        bill.frequency.toLowerCase().includes(queryValue);

      const matchesType = typeFilter === 'all' || bill.type === typeFilter;
      const matchesFrequency =
        frequencyFilter === 'all' || bill.frequency === frequencyFilter;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      return matchesSearch && matchesType && matchesFrequency && matchesStatus;
    });
  }, [bills, search, typeFilter, frequencyFilter, statusFilter]);

  const sections = useMemo(() => {
    return {
      overdue: filteredBills.filter((bill) => getBillStatus(bill) === 'overdue'),
      dueSoon: filteredBills.filter((bill) => getBillStatus(bill) === 'due-soon'),
      upcoming: filteredBills.filter((bill) => getBillStatus(bill) === 'upcoming'),
    };
  }, [filteredBills]);

  const summary = useMemo(() => {
    const totalMonthlyEquivalent = bills.reduce((sum, bill) => {
      if (bill.frequency === 'monthly') return sum + bill.expectedAmount;
      if (bill.frequency === 'weekly') return sum + bill.expectedAmount * 4;
      return sum + bill.expectedAmount / 12;
    }, 0);

    const overdueCount = bills.filter(
      (bill) => getBillStatus(bill) === 'overdue'
    ).length;

    const dueSoonCount = bills.filter(
      (bill) => getBillStatus(bill) === 'due-soon'
    ).length;

    const remainingAmount = bills
      .filter((bill) => {
        const status = getBillStatus(bill);
        return status === 'overdue' || status === 'due-soon' || status === 'upcoming';
      })
      .reduce((sum, bill) => sum + bill.expectedAmount, 0);

    return {
      totalCount: bills.length,
      totalMonthlyEquivalent,
      overdueCount,
      dueSoonCount,
      remainingAmount,
    };
  }, [bills]);

  function renderBillCard(bill: Bill) {
    const dueDate = parseBillDate(bill.nextDueDate);
    const status = getBillStatus(bill);

    let subtitle = 'No due date';
    if (dueDate) {
      if (status === 'overdue') {
        subtitle = `Overdue since ${format(dueDate, 'MMM d, yyyy')}`;
      } else if (status === 'due-soon') {
        subtitle = `Due ${format(dueDate, 'MMM d, yyyy')}`;
      } else {
        subtitle = `Next due ${format(dueDate, 'MMM d, yyyy')}`;
      }
    }

    return (
      <Card
        key={bill.id}
        className="rounded-lg border border-slate-200 bg-white shadow-sm transition-colors"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-lg text-slate-900">
                {bill.name}
              </CardTitle>
              <CardDescription className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getTypeBadgeClass(
                    bill.type
                  )}`}
                >
                  {bill.type}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getFrequencyBadgeClass(
                    bill.frequency
                  )}`}
                >
                  {bill.frequency}
                </span>
              </CardDescription>
            </div>

            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-medium ring-1 ${getStatusBadgeClass(
                status
              )}`}
            >
              {getStatusLabel(status)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-3xl font-semibold text-slate-900">
            {formatCurrency(bill.expectedAmount)}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-sm ${
                status === 'overdue'
                  ? 'font-medium text-rose-700'
                  : status === 'due-soon'
                    ? 'font-medium text-amber-700'
                    : 'text-slate-500'
              }`}
            >
              {subtitle}
            </span>

            <div className="flex items-center gap-2">
              <EditBillDialog userId={userId} bill={bill} />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                onClick={() => handleDeleteBill(bill.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>

              <Button
                type="button"
                variant={status === 'overdue' || status === 'due-soon' ? 'default' : 'outline'}
                size="sm"
                className={
                  status === 'overdue' || status === 'due-soon'
                    ? 'rounded-md bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
                }
                onClick={() => handleMarkPaid(bill)}
              >
                Mark Paid
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderSection(title: string, description: string, billsForSection: Bill[]) {
    if (billsForSection.length === 0) return null;

    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {billsForSection.map(renderBillCard)}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Bills & Subscriptions
          </h1>
          <p className="text-slate-500">
            Track recurring expenses, spot what is due next, and stay ahead of payments.
          </p>
        </div>

        <BillForm
          trigger={
            <Button className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
              Add Bill
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total recurring bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {summary.totalCount}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Monthly equivalent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.totalMonthlyEquivalent)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Overdue / due soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {summary.overdueCount + summary.dueSoonCount}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {summary.overdueCount} overdue, {summary.dueSoonCount} due soon
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Remaining amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.remainingAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-slate-900">Bill manager</CardTitle>
              <CardDescription className="text-slate-500">
                Search and filter recurring charges by type, frequency, or status.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bills"
                  className="h-10 rounded-md border-slate-200 pl-9 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as TypeFilter)}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-md border-slate-200 bg-white text-slate-900">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={frequencyFilter}
                onValueChange={(value) =>
                  setFrequencyFilter(value as FrequencyFilter)
                }
              >
                <SelectTrigger className="h-10 w-[170px] rounded-md border-slate-200 bg-white text-slate-900">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All frequencies</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-md border-slate-200 bg-white text-slate-900">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due-soon">Due soon</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">
              Loading recurring bills...
            </div>
          ) : bills.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">
                No recurring bills yet. Add your first one to start tracking future expenses.
              </p>
              <div className="mt-4 flex justify-center">
                <BillForm
                  trigger={
                    <Button className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                      Add Bill
                    </Button>
                  }
                />
              </div>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">
                No bills match your current filters.
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('all');
                    setFrequencyFilter('all');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {renderSection(
                'Overdue',
                'Bills that should already have been paid.',
                sections.overdue
              )}

              {renderSection(
                'Due soon',
                `Bills due within the next ${DUE_SOON_DAYS} days.`,
                sections.dueSoon
              )}

              {renderSection(
                'Upcoming',
                'Bills that are coming up later.',
                sections.upcoming
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}