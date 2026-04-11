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
  name: z
    .string()
    .trim()
    .min(1, 'Bill name is required')
    .max(50, 'Bill name must be 50 characters or less'),
  type: z.enum(['fixed', 'variable', 'subscription']),
  expectedAmount: z
    .string()
    .min(1, 'Expected amount is required')
    .refine((value) => !Number.isNaN(Number(value)), 'Amount must be a valid number')
    .transform((value) => Number(value))
    .refine((value) => value >= 0, 'Amount must be 0 or greater'),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  nextDueDate: z.string().min(1, 'Next due date is required'),
});

type BillFormValues = z.infer<typeof formSchema>;

type BillFormInput = {
  name: string;
  type: 'fixed' | 'variable' | 'subscription';
  expectedAmount: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
};

type EditBillDialogProps = {
  userId: string;
  bill: {
    id: string;
    name: string;
    type: 'fixed' | 'variable' | 'subscription';
    expectedAmount: number;
    frequency: 'weekly' | 'monthly' | 'yearly';
    nextDueDate: string;
  };
};

function toDateInputValue(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

export function EditBillDialog({ userId, bill }: EditBillDialogProps) {
  const [open, setOpen] = useState(false);

  const defaultValues: BillFormInput = {
    name: bill.name,
    type: bill.type,
    expectedAmount: String(bill.expectedAmount),
    frequency: bill.frequency,
    nextDueDate: toDateInputValue(bill.nextDueDate),
  };

  const form = useForm<BillFormInput, unknown, BillFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: BillFormValues) {
    const path = `users/${userId}/recurring/${bill.id}`;

    try {
      await updateDoc(doc(db, path), {
        name: values.name,
        type: values.type,
        expectedAmount: values.expectedAmount,
        frequency: values.frequency,
        nextDueDate: values.nextDueDate,
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
        <Button type="button" variant="outline" size="sm" className="rounded-md">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="p-0 sm:max-w-[560px] rounded-xl">
        <div className="px-5 pt-5 pb-3">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Edit bill
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Update the details for this recurring bill or subscription.
          </DialogDescription>
        </div>

        <div className="px-5 pb-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Bill name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-10 rounded-md"
                        placeholder="Rent, Netflix, Spotify"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full rounded-md">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed bill</SelectItem>
                          <SelectItem value="variable">Variable bill</SelectItem>
                          <SelectItem value="subscription">Subscription</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>Frequency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full rounded-md">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expectedAmount"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>Expected amount</FormLabel>
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
                            className="h-10 rounded-md pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextDueDate"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>Next due date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="date"
                            className="h-10 rounded-md pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-md"
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