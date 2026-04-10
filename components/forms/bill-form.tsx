'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, CalendarDays, Landmark } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';

import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
  name: z.string().min(1, 'Name is required').max(50, 'Name is too long'),
  type: z.enum(['fixed', 'variable', 'subscription']),
  expectedAmount: z.coerce
    .number()
    .min(0, 'Amount must be 0 or greater'),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  nextDueDate: z.string().min(1, 'Next due date is required'),
});

type BillFormValues = z.infer<typeof formSchema>;
type BillFormInput = z.input<typeof formSchema>;

const defaultValues: BillFormInput = {
  name: '',
  type: 'fixed',
  expectedAmount: 0,
  frequency: 'monthly',
  nextDueDate: new Date().toISOString().split('T')[0],
};

export function BillForm() {
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
        name: values.name.trim(),
        type: values.type,
        expectedAmount: values.expectedAmount,
        frequency: values.frequency,
        nextDueDate: new Date(values.nextDueDate).toISOString(),
        autoPay: false,
        createdAt: new Date().toISOString(),
      });

      form.reset(defaultValues);
      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(defaultValues);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="h-4 w-4" />
        Add Bill
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl">Add recurring bill</DialogTitle>
          <DialogDescription className="pt-1 text-sm text-muted-foreground">
            Save a fixed bill, variable expense, or subscription so you can keep
            upcoming payments visible.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Rent, Netflix, Spotify"
                        autoComplete="off"
                        {...field}
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
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
                          <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="pl-10"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={
                              typeof field.value === 'number' ? field.value : ''
                            }
                            onChange={(event) =>
                              field.onChange(event.currentTarget.value)
                            }
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
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="border-t pt-5">
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save bill'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}