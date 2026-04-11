'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, CalendarDays } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import * as z from 'zod';

import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';

import { zodResolver } from '@hookform/resolvers/zod';
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

const defaultValues: BillFormInput = {
  name: '',
  type: 'fixed',
  expectedAmount: '',
  frequency: 'monthly',
  nextDueDate: new Date().toISOString().split('T')[0],
};

type BillFormProps = {
    trigger?: React.ReactNode;
  };
  
export function BillForm({ trigger }: BillFormProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const form = useForm<BillFormInput, unknown, BillFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: BillFormValues) {
    if (!user) return;

    const path = `users/${user.uid}/recurring`;

    try {
      await addDoc(collection(db, path), {
        uid: user.uid,
        name: values.name,
        type: values.type,
        expectedAmount: values.expectedAmount,
        frequency: values.frequency,
        nextDueDate: values.nextDueDate,
        autoPay: false,
        createdAt: serverTimestamp(),
      });

      form.reset(defaultValues);
      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) form.reset(defaultValues);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
            {trigger ?? (
                <Button className="gap-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                <Plus className="h-4 w-4" />
                Add Bill
                </Button>
            )}
        </DialogTrigger>

      <DialogContent className="sm:max-w-[620px] rounded-2xl p-0">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Add recurring bill
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-[48ch] text-sm text-muted-foreground">
            Save a fixed bill, variable expense, or subscription so upcoming
            payments stay visible.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Rent, Netflix, Spotify"
                        autoComplete="off"
                        className="h-11"
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
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 w-full">
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
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 w-full">
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
                    <FormItem>
                      <FormLabel>Expected amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="h-11 pl-8"
                            {...field}
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
                    <FormItem>
                      <FormLabel>Next due date</FormLabel>
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

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                  className=""
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className=""
                >
                  {isSubmitting ? 'Saving...' : 'Save bill'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}