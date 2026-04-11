'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';

type Transaction = {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  note?: string;
};

type ExpenseTrendChartProps = {
  transactions: Transaction[];
};

function parseDate(value: string) {
  if (!value) return null;

  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

export function ExpenseTrendChart({ transactions }: ExpenseTrendChartProps) {
  const expenseTransactions = transactions.filter((tx) => tx.type === 'expense');

  const grouped = expenseTransactions.reduce<Record<string, number>>((acc, tx) => {
    const parsedDate = parseDate(tx.date);
    const key = parsedDate ? format(parsedDate, 'MMM d') : 'Unknown';
    acc[key] = (acc[key] || 0) + Number(tx.amount || 0);
    return acc;
  }, {});

  const chartData = Object.entries(grouped).map(([date, total]) => ({
    date,
    total,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        No expense trend data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#888888"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#888888"
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value) => {
            const amount = typeof value === 'number' ? value : Number(value ?? 0);
            return [`$${amount.toFixed(2)}`, 'Expenses'];
          }}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="currentColor"
          strokeWidth={2}
          className="text-primary"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}