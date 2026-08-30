'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (category: string) => Promise<void>;
  count: number;
  loading?: boolean;
}

export function BulkRecategorizeDialog({
  open,
  onOpenChange,
  onConfirm,
  count,
  loading,
}: Props) {
  const [category, setCategory] = useState('');

  const handleSubmit = async () => {
    if (!category.trim()) return;
    await onConfirm(category.trim());
    setCategory('');
  };

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setCategory('');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-t-[24px] p-0 sm:max-w-[520px] sm:rounded-xl">
        <div className="px-6 pb-4 pt-6 pr-16">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
            Recategorize transactions
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Update the category for {count} selected transaction
            {count !== 1 ? 's' : ''}.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <div className="space-y-3 rounded-xl border border-border bg-secondary/45 p-4">
            <label htmlFor="bulk-category" className="text-sm font-medium text-foreground">
              New category
            </label>
            <Input
              id="bulk-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Dining, Utilities, Transport"
              autoComplete="off"
              className="h-11 border-input bg-background"
            />
          </div>

          <div className="sticky bottom-0 z-10 -mx-2 mt-6 flex flex-col-reverse gap-2 bg-gradient-to-t from-popover via-popover to-transparent px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4 sm:static sm:flex-row sm:justify-end sm:bg-none sm:p-0">
            <Button
              variant="outline"
              className="min-h-11 rounded-xl border-border bg-card text-foreground hover:bg-secondary"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              className="min-h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={loading || !category.trim()}
            >
              {loading ? 'Updating...' : 'Apply category'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
