'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deleteJobAction } from '../actions';

/** Delete, behind a large Yes/No confirmation. */
export function DeleteJobButton({
  jobId,
  jobNumber,
  customerName,
}: {
  jobId: string;
  jobNumber: string;
  customerName: string;
}) {
  const t = useTranslations('jobs');
  const tcom = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteJobAction(jobId);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        setOpen(false);
        return;
      }
      toast.success(t('deleted'));
      setOpen(false);
      router.push('/jobs');
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="destructive" size="lg" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        <span>{tcom('delete')}</span>
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('deleteTitle')}
        description={t('deleteBody', { number: jobNumber, customer: customerName })}
        confirmLabel={t('deleteConfirm')}
        cancelLabel={t('deleteCancel')}
        onConfirm={confirm}
        pending={pending}
      />
    </>
  );
}
