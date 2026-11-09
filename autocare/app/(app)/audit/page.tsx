import Link from 'next/link';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePageAdmin } from '@/lib/session';
import { intlTagFor } from '@/i18n/locales';
import { formatDateTime } from '@/lib/utils';
import { AUDIT_ACTIONS } from '@/lib/audit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { RowList } from '@/components/ui/card';

export const metadata = { title: 'Activity Log — AutoCare' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/** The audit trail. ADMIN only — the owner can see everything that happened. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requirePageAdmin();
  const params = await searchParams;
  const [t, tcom, locale] = await Promise.all([
    getTranslations('audit'),
    getTranslations('common'),
    getLocale(),
  ]);
  const tag = intlTagFor(locale);

  const action =
    params.action && (AUDIT_ACTIONS as readonly string[]).includes(params.action)
      ? params.action
      : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.AuditLogWhereInput = action ? { action } : {};

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, username: true } } },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Known actions get a translated label; anything else falls back to its code. */
  const describe = (value: string) => {
    const key = `action_${value}`;
    const label = t.has(key as never) ? t(key as never) : value;
    return label;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('title')}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* The list of action types is long, so it folds away; it opens by
          itself when a filter is in use so the current choice stays visible. */}
      <details className="group rounded-2xl border border-border bg-card" open={action ? true : undefined}>
        <summary className="flex min-h-tap cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3 text-lg font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span>
            {t('filterAction')}:{' '}
            <span className="font-normal text-muted-foreground">
              {action ? describe(action) : tcom('all')}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className="size-6 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          <FilterChip href="/audit" active={!action}>
            {tcom('all')}
          </FilterChip>
          {AUDIT_ACTIONS.map((value) => (
            <FilterChip key={value} href={`/audit?action=${value}`} active={action === value}>
              {describe(value)}
            </FilterChip>
          ))}
        </div>
      </details>

      {entries.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <RowList>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
            >
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-lg font-semibold">{describe(entry.action)}</p>
                <p className="text-base text-muted-foreground [overflow-wrap:anywhere]">
                  {t('who')}: {entry.user ? `${entry.user.name} (@${entry.user.username})` : '—'}
                </p>
                <p className="text-base text-muted-foreground [overflow-wrap:anywhere]">
                  {t('record')}: {entry.entity}
                  {entry.entityId ? ` · ${entry.entityId}` : ''}
                </p>
                {entry.metadata && typeof entry.metadata === 'object' ? (
                  <p className="mt-1 text-base text-muted-foreground [overflow-wrap:anywhere]">
                    {Object.entries(entry.metadata as Record<string, unknown>)
                      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 sm:text-right">
                <p className="text-base font-semibold">{formatDateTime(entry.createdAt, tag)}</p>
                {entry.ipAddress ? (
                  <Badge variant="muted" className="mt-1">
                    {entry.ipAddress}
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </RowList>
      )}

      {pageCount > 1 ? (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={tcom('pages')}>
          {page > 1 ? (
            <Button asChild variant="outline" size="compact">
              <Link href={`/audit?${action ? `action=${action}&` : ''}page=${page - 1}`}>
                <ChevronLeft aria-hidden />
                <span>{tcom('previous')}</span>
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-lg font-semibold">
            {tcom('pageOf', { current: page, total: pageCount })}
          </span>
          {page < pageCount ? (
            <Button asChild variant="outline" size="compact">
              <Link href={`/audit?${action ? `action=${action}&` : ''}page=${page + 1}`}>
                <span>{tcom('next')}</span>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

/** One filter option. The chosen one is marked with an orange edge and a tick. */
function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="compact"
      className={active ? 'border-primary bg-primary-tint hover:bg-primary-tint' : undefined}
    >
      <Link href={href} aria-current={active ? 'true' : undefined}>
        {active ? <Check aria-hidden strokeWidth={3} className="text-primary-strong" /> : null}
        <span>{children}</span>
      </Link>
    </Button>
  );
}
