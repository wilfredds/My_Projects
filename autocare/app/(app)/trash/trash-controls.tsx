'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Undo2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { restoreJobAction, purgeJobAction } from '../jobs/actions';

/** Restore (safe, one tap) or purge (irreversible, confirmed). */
export function TrashRowActions({
  jobId,
  jobNumber,
  customerName,
}: {
  jobId: string;
  jobNumber: string;
  customerName: string;
}) {
  const t = useTranslations('trash');
  const tj = useTranslations('jobs');
  const tcom = useTranslations('common');
  const router = useRouter();

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function restore() {
    startTransition(async () => {
      const result = await restoreJobAction(jobId);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        return;
      }
      toast.success(t('restored'));
      router.refresh();
    });
  }

  function purge() {
    startTransition(async () => {
      const result = await purgeJobAction(jobId);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        setConfirmOpen(false);
        return;
      }
      toast.success(t('purged'));
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
      {/* Restoring is the safe path, so it comes first; removing for good is
          outlined in red and still asks before it does anything. */}
      <Button variant="secondary" onClick={restore} disabled={pending}>
        <Undo2 aria-hidden />
        <span>{t('restore')}</span>
      </Button>

      <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={pending}>
        <Trash2 aria-hidden />
        <span>{t('purge')}</span>
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('purgeTitle')}
        description={t('purgeBody', { number: jobNumber, customer: customerName })}
        confirmLabel={t('purgeConfirm')}
        cancelLabel={tj('deleteCancel')}
        onConfirm={purge}
        pending={pending}
      />
    </div>
  );
}
