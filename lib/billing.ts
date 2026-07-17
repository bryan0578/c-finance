import {
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';

export type BillFrequency = 'weekly' | 'monthly' | 'yearly';
export type BillStatus = 'overdue' | 'due-soon' | 'upcoming' | 'partial' | 'paid';

export type BillLike = {
  id?: string;
  expectedAmount: number;
  frequency: BillFrequency;
  nextDueDate: string;
};

export type TransactionLike = {
  type: 'income' | 'expense';
  amount: number;
  date: string;
  linkedRecurringId?: string | null;
  linkedRecurringDueDate?: string | null;
};

export function parseFinancialDate(value: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

export function advanceDueDate(value: string, frequency: BillFrequency) {
  const dueDate = parseFinancialDate(value);
  if (!dueDate) return value;

  const next =
    frequency === 'weekly'
      ? addWeeks(dueDate, 1)
      : frequency === 'yearly'
        ? addYears(dueDate, 1)
        : addMonths(dueDate, 1);

  return next.toISOString().split('T')[0];
}

function previousDueDate(value: string, frequency: BillFrequency) {
  const dueDate = parseFinancialDate(value);
  if (!dueDate) return null;
  return frequency === 'weekly'
    ? addWeeks(dueDate, -1)
    : frequency === 'yearly'
      ? addYears(dueDate, -1)
      : addMonths(dueDate, -1);
}

export function getPaidAmountForBill(bill: BillLike, transactions: TransactionLike[]) {
  if (!bill.id) return 0;
  const dueDate = parseFinancialDate(bill.nextDueDate);
  const cycleStart = previousDueDate(bill.nextDueDate, bill.frequency);
  const nextCycle = advanceDueDate(bill.nextDueDate, bill.frequency);
  const cycleEnd = parseFinancialDate(nextCycle);

  return transactions
    .filter((transaction) => {
      if (transaction.type !== 'expense' || transaction.linkedRecurringId !== bill.id) {
        return false;
      }

      if (transaction.linkedRecurringDueDate) {
        return transaction.linkedRecurringDueDate === bill.nextDueDate;
      }

      // Backward compatibility for transactions created before cycle IDs existed.
      const transactionDate = parseFinancialDate(transaction.date);
      if (!transactionDate || !dueDate || !cycleStart || !cycleEnd) return false;
      const day = startOfDay(transactionDate);
      return day >= startOfDay(cycleStart) && day < startOfDay(cycleEnd);
    })
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
}

export function getBillStatus(
  bill: BillLike,
  transactions: TransactionLike[],
  now = new Date(),
  dueSoonDays = 7
): BillStatus {
  const paidAmount = getPaidAmountForBill(bill, transactions);
  if (bill.expectedAmount > 0 && paidAmount >= bill.expectedAmount) return 'paid';
  if (paidAmount > 0) return 'partial';

  const dueDate = parseFinancialDate(bill.nextDueDate);
  if (!dueDate) return 'upcoming';
  const difference = differenceInCalendarDays(startOfDay(dueDate), startOfDay(now));
  if (difference < 0) return 'overdue';
  if (difference <= dueSoonDays) return 'due-soon';
  return 'upcoming';
}
