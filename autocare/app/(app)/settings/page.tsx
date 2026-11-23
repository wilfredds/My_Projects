import { getTranslations } from 'next-intl/server';
import { requirePageAdmin } from '@/lib/session';
import { getShopInfo } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { SettingsForm } from './settings-form';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = { title: 'Settings — AutoCare' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const admin = await requirePageAdmin();
  const [t, shop, me] = await Promise.all([
    getTranslations('settings'),
    getShopInfo(),
    prisma.user.findUnique({ where: { id: admin.id }, select: { locale: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <SettingsForm
        shop={{
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email ?? '',
          footer: shop.footer ?? '',
          tin: shop.tin ?? '',
        }}
        accent={shop.accent}
        logo={shop.logo}
        myLocale={me?.locale ?? 'fil'}
      />
    </div>
  );
}
