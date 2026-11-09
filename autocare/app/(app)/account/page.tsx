import { getTranslations, getLocale } from 'next-intl/server';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { intlTagFor } from '@/i18n/locales';
import { formatDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChangePasswordForm } from './change-password-form';

export const metadata = { title: 'My Account — AutoCare' };
export const dynamic = 'force-dynamic';

/**
 * The signed-in user's own account page.
 *
 * Doubles as the forced-password-change screen: when `mustChangePassword` is
 * set the app layout sends the user here and nowhere else until they pick a
 * password of their own.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ forced?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;

  const [t, tu, locale, row] = await Promise.all([
    getTranslations('account'),
    getTranslations('users'),
    getLocale(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { lastLoginAt: true, createdAt: true },
    }),
  ]);
  const tag = intlTagFor(locale);

  const forced = user.mustChangePassword || params.forced === '1';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1>{t('title')}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>

      {forced ? (
        <div
          role="alert"
          className="animate-in fade-in slide-in-from-top-2 flex items-start gap-4 rounded-2xl border-2 border-warning/40 bg-warning-tint p-5"
        >
          <ShieldAlert className="mt-0.5 size-8 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-lg font-bold text-warning">{t('mustChangeTitle')}</p>
            <p className="text-base text-foreground">{t('mustChangeBody')}</p>
          </div>
        </div>
      ) : null}

      <Card className="p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-base font-semibold text-muted-foreground">{tu('name')}</dt>
            <dd className="text-xl font-bold">{user.name}</dd>
          </div>
          <div>
            <dt className="text-base font-semibold text-muted-foreground">{tu('username')}</dt>
            <dd className="text-xl font-bold">@{user.username}</dd>
          </div>
          <div>
            <dt className="text-base font-semibold text-muted-foreground">{tu('role')}</dt>
            <dd className="mt-1">
              <Badge variant={user.role === 'ADMIN' ? 'outline' : 'muted'}>
                {tu(`role_${user.role}` as never)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-base font-semibold text-muted-foreground">{tu('lastLogin')}</dt>
            <dd className="text-lg">
              {row?.lastLoginAt ? formatDateTime(row.lastLoginAt, tag) : tu('never')}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="mb-6 flex items-center gap-3">
          <KeyRound className="size-7" aria-hidden />
          {t('changePassword')}
        </h2>
        <ChangePasswordForm forced={forced} />
      </Card>
    </div>
  );
}
