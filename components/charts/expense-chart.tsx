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
    .sort((a, b) => b.total - a.total);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        No expense data for this month yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          formatter={(value) => {
            const numericValue =
              typeof value === 'number'
                ? value
                : typeof value === 'string'
                  ? Number(value)
                  : 0;
            return [`$${numericValue.toFixed(2)}`, 'Amount'];
          }}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Bar
          dataKey="total"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}