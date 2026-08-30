'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

type Transaction = {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  note?: string;
};

type ExpenseChartProps = {
  transactions: Transaction[];
};

export function ExpenseChart({ transactions }: ExpenseChartProps) {
  const expenseTransactions = transactions.filter(
    (tx) => tx.type === 'expense'
  );

  const categoryTotals = expenseTransactions.reduce<Record<string, number>>(
    (acc, tx) => {
      const category = tx.category || 'Other';
      acc[category] = (acc[category] || 0) + tx.amount;
      return acc;
    },
    {}
  );

  const chartData = Object.entries(categoryTotals)
    .map(([name, total]) => ({
      name,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        No expense data for this period yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="name"
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          tickFormatter={(value) => String(value).length > 12 ? `${String(value).slice(0, 11)}…` : String(value)}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value) => `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
        />
        <Tooltip
          cursor={{ fill: 'color-mix(in srgb, var(--primary) 6%, transparent)' }}
          formatter={(value) => {
            const numericValue =
              typeof value === 'number'
                ? value
                : typeof value === 'string'
                  ? Number(value)
                  : 0;
            return [numericValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), 'Amount'];
          }}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            boxShadow: '0 18px 42px rgb(0 0 0 / 0.24)',
          }}
          labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--popover-foreground)' }}
        />
        <Bar
          dataKey="total"
          fill="var(--primary)"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
