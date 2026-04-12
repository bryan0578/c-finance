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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl p-0 sm:max-w-[520px]">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900">
            Recategorize transactions
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Update the category for {count} selected transaction
            {count !== 1 ? 's' : ''}.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <label className="text-sm font-medium text-slate-700">
              New category
            </label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Dining, Utilities, Transport"
              className="h-10 border-slate-200"
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
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