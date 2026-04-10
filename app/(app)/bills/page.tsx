'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isPast,
  isToday,
  parseISO,
  startOfDay,
} from 'date-fns';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Search,
  AlertTriangle,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
type BillStatus = 'overdue' | 'due-soon' | 'upcoming' | 'paid';

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
const PAID_VISUAL_DAYS = 10;

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

  const isDueOrPast = isPast(due) || isToday(due);
  const visuallyPaid =
    !isDueOrPast && dayDiff > PAID_VISUAL_DAYS;

  if (visuallyPaid) return 'paid';
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
    case 'paid':
      return 'Paid';
  }
}

function getStatusBadgeClass(status: BillStatus) {
  switch (status) {
    case 'overdue':
      return 'bg-red-50 text-red-700 ring-red-200';
    case 'due-soon':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'upcoming':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'paid':
      return 'bg-green-50 text-green-700 ring-green-200';
  }
}

function getTypeBadgeClass(type: BillType) {
  switch (type) {
    case 'fixed':
      return 'bg-slate-50 text-slate-700 ring-slate-200';
    case 'variable':
      return 'bg-orange-50 text-orange-700 ring-orange-200';
    case 'subscription':
      return 'bg-purple-50 text-purple-700 ring-purple-200';
  }
}

function getFrequencyBadgeClass(frequency: BillFrequency) {
  switch (frequency) {
    case 'weekly':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
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

  async function handleMarkPaid(bill: Bill) {
    if (!user) return;

    try {
      const txPath = `users/${user.uid}/transactions`;
      await addDoc(collection(db, txPath), {
        uid: user.uid,
        type: 'expense',
        amount: bill.expectedAmount,
        category: bill.name,
        date: new Date().toISOString().split('T')[0],
        note: `Paid ${bill.name}`,
        linkedRecurringId: bill.id,
      });

      const dueDate = parseBillDate(bill.nextDueDate) ?? new Date();
      const nextDate = advanceDueDate(dueDate, bill.frequency);

      const billRef = doc(db, `users/${user.uid}/recurring`, bill.id);
      await updateDoc(billRef, {
        nextDueDate: nextDate.toISOString(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `users/${user.uid}/recurring/${bill.id}`
      );
    }
  }

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase();

    return bills.filter((bill) => {
      const status = getBillStatus(bill);

      const matchesSearch =
        !q ||
        bill.name.toLowerCase().includes(q) ||
        bill.type.toLowerCase().includes(q) ||
        bill.frequency.toLowerCase().includes(q);

      const matchesType = typeFilter === 'all' || bill.type === typeFilter;
      const matchesFrequency =
        frequencyFilter === 'all' || bill.frequency === frequencyFilter;
      const matchesStatus =
        statusFilter === 'all' || status === statusFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesFrequency &&
        matchesStatus
      );
    });
  }, [bills, search, typeFilter, frequencyFilter, statusFilter]);

  const sections = useMemo(() => {
    return {
      overdue: filteredBills.filter((bill) => getBillStatus(bill) === 'overdue'),
      dueSoon: filteredBills.filter((bill) => getBillStatus(bill) === 'due-soon'),
      upcoming: filteredBills.filter((bill) => getBillStatus(bill) === 'upcoming'),
      paid: filteredBills.filter((bill) => getBillStatus(bill) === 'paid'),
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

    const upcomingAmount = bills
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
      upcomingAmount,
    };
  }, [bills]);

  if (!user) return null;

  const userId = user.uid;

  function renderBillCard(bill: Bill) {
    const dueDate = parseBillDate(bill.nextDueDate);
    const status = getBillStatus(bill);

    let subtitle = 'No due date';
    if (dueDate) {
      if (status === 'paid') {
        subtitle = 'Paid for this period';
      } else if (status === 'overdue') {
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
        className={`rounded-lg transition-colors ${
          status === 'paid' ? 'opacity-80' : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-lg">{bill.name}</CardTitle>
              <CardDescription className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${getTypeBadgeClass(
                    bill.type
                  )}`}
                >
                  {bill.type}
                </span>
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${getFrequencyBadgeClass(
                    bill.frequency
                  )}`}
                >
                  {bill.frequency}
                </span>
              </CardDescription>
            </div>

            <span
              className={`inline-flex shrink-0 rounded-md px-2 py-1 text-xs font-medium ring-1 ${getStatusBadgeClass(
                status
              )}`}
            >
              {getStatusLabel(status)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-3xl font-semibold">
            {formatCurrency(bill.expectedAmount)}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span
                className={`text-sm ${
                status === 'overdue'
                    ? 'text-red-600 font-medium'
                    : status === 'due-soon'
                    ? 'text-amber-700 font-medium'
                    : 'text-muted-foreground'
                }`}
            >
                {subtitle}
            </span>

            <div className="flex items-center gap-2">
                <EditBillDialog userId={userId} bill={bill} />

                {status === 'paid' ? (
                <span className="inline-flex items-center text-sm font-medium text-green-600">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Paid
                </span>
                ) : (
                <Button
                    variant={status === 'overdue' || status === 'due-soon' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-md"
                    onClick={() => handleMarkPaid(bill)}
                >
                    Mark Paid
                </Button>
                )}
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
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Bills & Subscriptions</h1>
          <p className="text-muted-foreground">
            Track recurring expenses, spot what is due next, and stay ahead of payments.
          </p>
        </div>

        <BillForm />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total recurring bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.totalCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly equivalent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(summary.totalMonthlyEquivalent)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue / due soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {summary.overdueCount + summary.dueSoonCount}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.overdueCount} overdue, {summary.dueSoonCount} due soon
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(summary.upcomingAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Bill manager</CardTitle>
              <CardDescription>
                Search and filter recurring charges by type, frequency, or status.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bills"
                  className="h-10 rounded-md pl-9"
                />
              </div>

              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as TypeFilter)}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-md">
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
                <SelectTrigger className="h-10 w-[170px] rounded-md">
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
                <SelectTrigger className="h-10 w-[160px] rounded-md">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due-soon">Due soon</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading recurring bills...
            </div>
          ) : bills.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No recurring bills yet. Add your first one to start tracking future expenses.
              </p>
              <div className="mt-4 flex justify-center">
                <BillForm />
              </div>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No bills match your current filters.
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
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

              {renderSection(
                'Paid',
                'Bills that appear covered for the current cycle.',
                sections.paid
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}