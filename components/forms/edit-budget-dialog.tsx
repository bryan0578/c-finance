'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type EditBudgetDialogProps = {
  userId: string;
  budget: { id: string; category: string; limit: number };
};

export function EditBudgetDialog({ userId, budget }: EditBudgetDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(budget.category);
  const [limit, setLimit] = useState(String(budget.limit));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const path = `users/${userId}/budgets/${budget.id}`;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const parsedLimit = Number(limit);
    const normalizedCategory = category.trim();
    if (!normalizedCategory || !Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError('Enter a category and a monthly limit greater than zero.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await updateDoc(doc(db, path), {
        category: normalizedCategory,
        limit: parsedLimit,
        updatedAt: serverTimestamp(),
      });
      setOpen(false);
    } catch (caught) {
      setError('The budget could not be updated. Please try again.');
      handleFirestoreError(caught, OperationType.UPDATE, path);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    try {
      setSaving(true);
      setError('');
      await deleteDoc(doc(db, path));
      setOpen(false);
    } catch (caught) {
      setError('The budget could not be deleted. Please try again.');
      handleFirestoreError(caught, OperationType.DELETE, path);
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCategory(budget.category);
      setLimit(String(budget.limit));
      setError('');
      setConfirmingDelete(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11 rounded-xl border-border bg-card text-foreground hover:bg-secondary">
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Edit budget</DialogTitle>
        <DialogDescription>Update the category or monthly spending limit.</DialogDescription>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="space-y-2">
            <Label htmlFor={`budget-category-${budget.id}`}>Category</Label>
            <Input
              id={`budget-category-${budget.id}`}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`budget-limit-${budget.id}`}>Monthly limit</Label>
            <Input
              id={`budget-limit-${budget.id}`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {confirmingDelete && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Delete the {budget.category} budget? This removes the budget limit, not your transactions.
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className={confirmingDelete ? 'border-destructive/50 bg-destructive text-white hover:bg-destructive/90' : 'border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive'}
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {confirmingDelete ? 'Confirm delete' : 'Delete budget'}
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
