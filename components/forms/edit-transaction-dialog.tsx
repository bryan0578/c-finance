'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarDays, Pencil } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

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
  note: z.string().trim().max(200, 'Note must be 200 characters or less'),
});

type TransactionFormValues = z.infer<typeof formSchema>;

type TransactionFormInput = {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  date: string;
  note: string;
};

type EditTransactionDialogProps = {
  userId: string;
  transaction: {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    date: string;
    note: string;
  };
};

function toDateInputValue(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

export function EditTransactionDialog({
  userId,
  transaction,
}: EditTransactionDialogProps) {
  const [open, setOpen] = useState(false);

  const defaultValues: TransactionFormInput = {
    type: transaction.type,
    amount: String(transaction.amount),
    category: transaction.category,
    date: toDateInputValue(transaction.date),
    note: transaction.note ?? '',
  };

  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: TransactionFormValues) {
    const path = `users/${userId}/transactions/${transaction.id}`;

    try {
      await updateDoc(doc(db, path), {
        type: values.type,
        amount: values.amount,
        category: values.category,
        date: values.date,
        note: values.note || '',
      });

      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
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
        <Button type="button" variant="outline" size="sm" className="cursor-pointer">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="p-0 sm:max-w-[560px] rounded-xl">
        <div className="px-5 pt-5 pb-3">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Edit transaction
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Update the details for this transaction.
          </DialogDescription>
        </div>

        <div className="px-5 pb-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
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
                    <FormItem className="space-y-1.5">
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
                            className="h-10 pl-8"
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
                    <FormItem className="space-y-1.5">
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="h-10"
                          placeholder="Groceries, Salary, Rent"
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
                    <FormItem className="space-y-1.5">
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="date"
                            className="h-10 pl-10"
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
                  <FormItem className="space-y-1.5">
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-10"
                        placeholder="Brief description"
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
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}