'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deleteCustomerAction } from '../actions';

export function DeleteCustomerButton({
  customerId,
  customerName,
  jobCount,
}: {
  customerId: string;
  customerName: string;
  jobCount: number;
}) {
  const t = useTranslations('customers');
  const tj = useTranslations('jobs');
  const tcom = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteCustomerAction(customerId);
      if (!result.ok) {
        // The most likely reason is job history, so say so specifically.
        toast.error(
          result.messageKey === 'customers.deleteBlocked'
            ? t('deleteBlocked', { count: jobCount })
            : tcom('unknownError'),
        );
        setOpen(false);
        return;
      }
      toast.success(t('deleted'));
      setOpen(false);
      router.push('/customers');
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
        description={
          jobCount > 0
            ? t('deleteBlocked', { count: jobCount })
            : t('deleteBody', { name: customerName })
        }
        confirmLabel={tj('deleteConfirm')}
        cancelLabel={tj('deleteCancel')}
        onConfirm={confirm}
        pending={pending}
      />
    </>
  );
}
