'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

/** Date-range picker with one-tap presets so no typing is needed. */
export function ReportRangePicker({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const t = useTranslations('reports');
  const tcom = useTranslations('common');
  const router = useRouter();

  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(defaultTo);

  const iso = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  };

  function go(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    router.push(`/reports?from=${nextFrom}&to=${nextTo}`);
  }

  const presets = [
    {
      label: t('presetToday'),
      run: () => {
        const today = iso(new Date());
        go(today, today);
      },
    },
    {
      label: t('presetWeek'),
      run: () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        go(iso(start), iso(now));
      },
    },
    {
      label: t('presetMonth'),
      run: () => {
        const now = new Date();
        go(iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now));
      },
    },
    {
      label: t('presetYear'),
      run: () => {
        const now = new Date();
        go(iso(new Date(now.getFullYear(), 0, 1)), iso(now));
      },
    },
  ];

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-xl font-bold">{t('dateRange')}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {presets.map((preset) => (
          <Button key={preset.label} variant="outline" size="default" onClick={preset.run}>
            <span>{preset.label}</span>
          </Button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={tcom('from')} htmlFor="report-from">
          <Input
            id="report-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={tcom('to')} htmlFor="report-to">
          <Input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <Button size="default" className="w-full sm:w-auto" onClick={() => go(from, to)}>
        <CalendarRange aria-hidden />
        <span>{tcom('apply')}</span>
      </Button>
    </section>
  );
}
