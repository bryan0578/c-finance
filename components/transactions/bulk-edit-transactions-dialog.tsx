"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TransactionType = "income" | "expense";

type BulkEditValues = {
  category?: string;
  type?: TransactionType;
  unlinkBills?: boolean;
};

type BulkEditTransactionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (values: BulkEditValues) => Promise<void>;
  count: number;
  loading?: boolean;
  suggestedCategories?: string[];
  hasLinkedTransactions?: boolean;
};

const fallbackCategories = [
  "Groceries",
  "Dining",
  "Utilities",
  "Transport",
  "Rent",
  "Entertainment",
  "Health",
  "Shopping",
  "Salary",
  "Subscriptions",
];

export function BulkEditTransactionsDialog({
  open,
  onOpenChange,
  onConfirm,
  count,
  loading = false,
  suggestedCategories = [],
  hasLinkedTransactions = false,
}: BulkEditTransactionsDialogProps) {
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"keep" | TransactionType>("keep");
  const [unlinkBills, setUnlinkBills] = useState(false);

  function resetForm() {
    setCategory("");
    setType("keep");
    setUnlinkBills(false);
  }

  const mergedSuggestions = useMemo(() => {
    const merged = [...suggestedCategories, ...fallbackCategories]
      .map((item) => item.trim())
      .filter(Boolean);

    return Array.from(new Set(merged)).slice(0, 12);
  }, [suggestedCategories]);

  const hasChanges =
    category.trim().length > 0 || type !== "keep" || unlinkBills;

  async function handleSubmit() {
    if (!hasChanges) return;

    await onConfirm({
      category: category.trim() || undefined,
      type: type === "keep" ? undefined : type,
      unlinkBills,
    });

    resetForm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (loading) return;

        if (!nextOpen) {
          resetForm();
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="rounded-xl p-0 sm:max-w-[620px]">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900">
            Bulk edit transactions
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Update {count} selected transaction{count !== 1 ? "s" : ""} in one
            step.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  New category
                </label>
                <Input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Leave blank to keep current category"
                  className="h-11 border-slate-200 bg-white"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  New type
                </label>
                <Select
                  value={type}
                  onValueChange={(value) =>
                    setType(value as "keep" | TransactionType)
                  }
                >
                  <SelectTrigger className="h-11 border-slate-200 bg-white text-slate-900">
                    <SelectValue placeholder="Keep current type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep current type</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                Suggested categories
              </p>
              <div className="flex flex-wrap gap-2">
                {mergedSuggestions.map((item) => {
                  const active =
                    category.trim().toLowerCase() === item.toLowerCase();

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      className={
                        active
                          ? "inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors"
                          : "inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      }
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasLinkedTransactions && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={unlinkBills}
                    onChange={(event) => setUnlinkBills(event.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Unlink bill matches
                    </p>
                    <p className="text-sm text-slate-500">
                      Remove existing bill links from the selected matched
                      transactions.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleSubmit}
              disabled={!hasChanges || loading}
            >
              {loading ? "Applying..." : "Apply changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
