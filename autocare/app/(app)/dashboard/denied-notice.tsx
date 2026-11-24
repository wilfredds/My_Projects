'use client';

import { useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';

/** Shown when RBAC bounced the user back here from an admin-only page. */
export function DeniedNotice() {
  const t = useTranslations('errors');
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-lg border-2 border-warning/40 bg-warning-tint p-5"
    >
      <ShieldAlert className="mt-0.5 size-8 shrink-0 text-warning" aria-hidden />
      <div>
        <p className="text-lg font-bold text-warning">{t('forbidden')}</p>
        <p className="text-base text-foreground">{t('forbiddenBody')}</p>
      </div>
    </div>
  );
}
