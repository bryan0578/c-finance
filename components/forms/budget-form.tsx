'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

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

const formSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(50, 'Category must be 50 characters or less'),
  limit: z
    .string()
    .min(1, 'Monthly limit is required')
    .refine((value) => !Number.isNaN(Number(value)), 'Limit must be a valid number')
    .transform((value) => Number(value))
    .refine((value) => value > 0, 'Limit must be greater than 0'),
});

type BudgetFormValues = z.infer<typeof formSchema>;

type BudgetFormInput = {
  category: string;
  limit: string;
};

const defaultValues: BudgetFormInput = {
  category: '',
  limit: '',
};

export function BudgetForm() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: BudgetFormValues) {
    if (!user) return;

    const path = `users/${user.uid}/budgets`;

    try {
      await addDoc(collection(db, path), {
        uid: user.uid,
        category: values.category,
        limit: values.limit,
        period: 'monthly',
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

    if (!nextOpen) {
      form.reset(defaultValues);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-md bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Create Budget
        </Button>
      </DialogTrigger>

      <DialogContent className="p-0 sm:max-w-[520px] rounded-xl">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Create budget
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-[44ch] text-sm text-muted-foreground">
            Set a monthly spending limit for a category so you can track your
            progress before you go over budget.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Food & Dining"
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
                name="limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly limit</FormLabel>
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
                  {isSubmitting ? 'Saving...' : 'Save budget'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}