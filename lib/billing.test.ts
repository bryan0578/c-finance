import { describe, expect, it } from 'vitest';

import { advanceDueDate, getBillStatus, getPaidAmountForBill } from './billing';

const bill = {
  id: 'rent',
  expectedAmount: 1_000,
  frequency: 'monthly' as const,
  nextDueDate: '2026-08-01',
};

describe('billing cycles', () => {
  it('advances weekly, monthly, and yearly due dates', () => {
    expect(advanceDueDate('2026-07-17', 'weekly')).toBe('2026-07-24');
    expect(advanceDueDate('2026-07-31', 'monthly')).toBe('2026-08-31');
    expect(advanceDueDate('2026-07-17', 'yearly')).toBe('2027-07-17');
  });

  it('counts only payments assigned to the current due-date cycle', () => {
    const transactions = [
      {
        type: 'expense' as const,
        amount: 600,
        date: '2026-07-20',
        linkedRecurringId: 'rent',
        linkedRecurringDueDate: '2026-08-01',
      },
      {
        type: 'expense' as const,
        amount: 1_000,
        date: '2026-06-20',
        linkedRecurringId: 'rent',
        linkedRecurringDueDate: '2026-07-01',
      },
      {
        type: 'expense' as const,
        amount: 50,
        date: '2026-07-20',
        linkedRecurringId: 'another-bill',
      },
    ];

    expect(getPaidAmountForBill(bill, transactions)).toBe(600);
    expect(getBillStatus(bill, transactions, new Date('2026-07-17'))).toBe('partial');
  });

  it('marks a cycle paid when linked payments reach the expected amount', () => {
    const transactions = [
      {
        type: 'expense' as const,
        amount: 1_000,
        date: '2026-07-20',
        linkedRecurringId: 'rent',
        linkedRecurringDueDate: '2026-08-01',
      },
    ];

    expect(getBillStatus(bill, transactions, new Date('2026-07-17'))).toBe('paid');
  });

  it('distinguishes overdue, due-soon, and upcoming unpaid bills', () => {
    expect(
      getBillStatus({ ...bill, nextDueDate: '2026-07-16' }, [], new Date(2026, 6, 17))
    ).toBe('overdue');
    expect(
      getBillStatus({ ...bill, nextDueDate: '2026-07-20' }, [], new Date(2026, 6, 17))
    ).toBe('due-soon');
    expect(
      getBillStatus({ ...bill, nextDueDate: '2026-08-01' }, [], new Date(2026, 6, 17))
    ).toBe('upcoming');
  });

  it('supports legacy linked transactions without a cycle date', () => {
    const transactions = [
      {
        type: 'expense' as const,
        amount: 1_000,
        date: '2026-07-15',
        linkedRecurringId: 'rent',
      },
    ];
    expect(getPaidAmountForBill(bill, transactions)).toBe(1_000);
  });
});
