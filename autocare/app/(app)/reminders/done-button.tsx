'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { closeReminderAction, reopenReminderAction } from './actions';

/**
 * "Tapos na": the customer has been called or texted, so the car leaves the
 * list. The toast that confirms it carries an "Ibalik" (undo) button, because
 * a mis-tap here would quietly lose a returning customer.
 */
export function ReminderDoneButton({
  jobId,
  label,
  ariaLabel,
}: {
  jobId: string;
  label: string;
  ariaLabel: string;
}) {
  const t = useTranslations('reminders');
  const tcom = useTranslations('common');
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function close() {
    start(async () => {
      const result = await closeReminderAction(jobId);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        return;
      }
      router.refresh();
      toast.success(t('closed'), {
        duration: 10_000,
        action: {
          label: t('undo'),
          onClick: async () => {
            const undone = await reopenReminderAction(jobId);
            if (undone.ok) {
              toast.success(t('reopened'));
              router.refresh();
            } else {
              toast.error(tcom('unknownError'));
            }
          },
        },
      });
    });
  }

  return (
    <Button
      variant="ghost"
      className="col-span-2 border-[1.5px] border-dashed border-input"
      onClick={close}
      disabled={pending}
      aria-label={ariaLabel}
    >
      <CheckCheck aria-hidden />
      <span>{pending ? tcom('saving') : label}</span>
    </Button>
  );
}
