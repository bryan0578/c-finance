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
import { format, parseISO, isValid, startOfDay } from 'date-fns';

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
  const grouped = new Map<string, { date: Date; total: number }>();

  transactions
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      const parsedDate = parseDate(tx.date);
      if (!parsedDate) return;
      const day = startOfDay(parsedDate);
      const key = day.toISOString();
      const existing = grouped.get(key);
      grouped.set(key, { date: day, total: (existing?.total ?? 0) + Number(tx.amount || 0) });
    });

  const chartData = Array.from(grouped.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ date, total }) => ({
      dateLabel: format(date, 'MMM d'),
      fullDate: format(date, 'MMM d, yyyy'),
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
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="dateLabel"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke="var(--muted-foreground)"
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke="var(--muted-foreground)"
          width={52}
          tickFormatter={(value) => `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
        />
        <Tooltip
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
          formatter={(value) => {
            const amount = typeof value === 'number' ? value : Number(value ?? 0);
            return [amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), 'Expenses'];
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
        <Line
          type="monotone"
          dataKey="total"
          stroke="var(--primary)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--background)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
