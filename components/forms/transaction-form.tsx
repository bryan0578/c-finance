'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, CalendarDays } from 'lucide-react';
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((value) => !Number.isNaN(Number(value)), 'Amount must be a valid number')
    .transform((value) => Number(value))
    .refine((value) => value > 0, 'Amount must be greater than 0'),
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(50, 'Category must be 50 characters or less'),
  date: z.string().min(1, 'Date is required'),
  note: z
    .string()
    .trim()
    .max(200, 'Note must be 200 characters or less'),
});

type TransactionFormValues = z.infer<typeof formSchema>;

type TransactionFormInput = {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  date: string;
  note: string;
};

type TransactionFormProps = {
  trigger?: React.ReactNode;
};

type RecurringBill = {
  id: string;
  name: string;
  expectedAmount: number;
  nextDueDate: string;
};

const defaultValues: TransactionFormInput = {
  type: 'expense',
  amount: '',
  category: '',
  date: new Date().toISOString().split('T')[0],
  note: '',
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function parseDateSafe(value: string) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBillMatchScore(
  bill: RecurringBill,
  tx: {
    amount: number;
    category: string;
    note?: string;
    date: string;
    type: 'income' | 'expense';
  }
) {
  if (tx.type !== 'expense') return 0;

  let score = 0;

  const billName = normalizeText(bill.name);
  const txCategory = normalizeText(tx.category);
  const txNote = normalizeText(tx.note || '');

  const amountDiff = Math.abs(Number(tx.amount) - Number(bill.expectedAmount));

  if (amountDiff < 0.01) {
    score += 5;
  } else if (amountDiff <= 5) {
    score += 3;
  } else if (amountDiff <= 20) {
    score += 1;
  }

  if (txCategory === billName) {
    score += 5;
  } else if (txCategory.includes(billName) || billName.includes(txCategory)) {
    score += 3;
  }

  if (txNote.includes(billName)) {
    score += 3;
  }

  const txDate = parseDateSafe(tx.date);
  const dueDate = parseDateSafe(bill.nextDueDate);

  if (txDate && dueDate) {
    const diffDays = Math.abs(
      Math.round((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (diffDays <= 3) {
      score += 4;
    } else if (diffDays <= 7) {
      score += 2;
    } else if (diffDays > 14) {
      score = 0;
    }
  }

  return score;
}

function findMatchingBill(
  bills: RecurringBill[],
  tx: {
    amount: number;
    category: string;
    note?: string;
    date: string;
    type: 'income' | 'expense';
  }
) {
  let bestMatch: RecurringBill | null = null;
  let bestScore = 0;

  for (const bill of bills) {
    const score = getBillMatchScore(bill, tx);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = bill;
    }
  }

  return bestScore >= 7 ? bestMatch : null;
}

export function TransactionForm({ trigger }: TransactionFormProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: TransactionFormValues) {
    if (!user) return;

    const txPath = `users/${user.uid}/transactions`;
    const billsPath = `users/${user.uid}/recurring`;

    try {
      let linkedRecurringId: string | undefined;

      if (values.type === 'expense') {
        const billsSnapshot = await getDocs(collection(db, billsPath));
        const bills = billsSnapshot.docs.map((docItem) => ({
          id: docItem.id,
          name: String(docItem.data().name ?? ''),
          expectedAmount: Number(docItem.data().expectedAmount ?? 0),
          nextDueDate: String(docItem.data().nextDueDate ?? ''),
        }));

        const matchedBill = findMatchingBill(bills, {
          type: values.type,
          amount: values.amount,
          category: values.category,
          note: values.note,
          date: values.date,
        });

        linkedRecurringId = matchedBill?.id;
      }

      await addDoc(collection(db, txPath), {
        uid: user.uid,
        type: values.type,
        amount: values.amount,
        category: values.category,
        date: values.date,
        note: values.note || '',
        ...(linkedRecurringId ? { linkedRecurringId } : {}),
        createdAt: serverTimestamp(),
      });

      form.reset(defaultValues);
      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, txPath);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(defaultValues);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="rounded-xl p-0 sm:max-w-[560px]">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Add transaction
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-[46ch] text-sm text-muted-foreground">
            Record income or expenses so your dashboard, budgets, and insights
            stay accurate.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            $
                          </span>
                          <Input
                            {...field}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="h-11 pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Groceries, Salary, Rent"
                          autoComplete="off"
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="date"
                            className="h-11 pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Brief description"
                        autoComplete="off"
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-md border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {isSubmitting ? 'Saving...' : 'Save transaction'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}