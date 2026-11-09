'use client';

import { useLocale } from 'next-intl';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';

/**
 * Monthly income, last 12 months. Bars are the one orange in the chart; the
 * current month is the right-most bar, so the eye lands on "now" last.
 */
export function MonthlyIncomeChart({ data }: { data: { label: string; value: number }[] }) {
  const tag = intlTagFor(useLocale());

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 16, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            tick={{ fontSize: 14, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={80}
            tickFormatter={(value: number) =>
              new Intl.NumberFormat(tag, { notation: 'compact' }).format(value)
            }
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--accent))' }}
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid hsl(var(--border))',
              fontSize: '1.125rem',
              fontWeight: 600,
            }}
            formatter={(value: number) => formatPeso(value, tag)}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
