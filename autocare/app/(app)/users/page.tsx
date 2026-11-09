import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { requirePageAdmin } from '@/lib/session';
import { intlTagFor } from '@/i18n/locales';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RowList } from '@/components/ui/card';
import { CreateUserDialog, UserRowActions } from './user-controls';

export const metadata = { title: 'Users — AutoCare' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const admin = await requirePageAdmin();
  const [t, locale] = await Promise.all([getTranslations('users'), getLocale()]);
  const tag = intlTagFor(locale);

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      lockedUntil: true,
    },
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>{t('title')}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
        <CreateUserDialog />
      </div>

      <RowList>
        {users.map((user) => {
          const locked = Boolean(user.lockedUntil && user.lockedUntil > now);
          return (
            <li key={user.id} className="space-y-4 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xl font-semibold leading-snug [overflow-wrap:anywhere]">{user.name}</p>
                  <p className="text-lg text-muted-foreground [overflow-wrap:anywhere]">@{user.username}</p>
                  <p className="mt-1 text-base text-muted-foreground">
                    {t('lastLogin')}:{' '}
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt, tag) : t('never')}
                  </p>
                  {locked && user.lockedUntil ? (
                    <p className="mt-1 text-base font-semibold text-destructive">
                      {t('lockedUntil', { time: formatDateTime(user.lockedUntil, tag) })}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={user.role === 'ADMIN' ? 'outline' : 'muted'}>
                    {t(`role_${user.role}` as never)}
                  </Badge>
                  <Badge variant={user.isActive ? 'outline' : 'muted'}>
                    {user.isActive ? t('active') : t('inactive')}
                  </Badge>
                </div>
              </div>

              <UserRowActions
                user={{
                  id: user.id,
                  name: user.name,
                  isActive: user.isActive,
                  locked,
                }}
                isSelf={user.id === admin.id}
              />
            </li>
          );
        })}
      </RowList>
    </div>
  );
}
