'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BigCheckbox } from '@/components/ui/misc';
import { acceptPolicyAction } from './actions';

/** The first-login gate: tick the box, then continue. */
export function PolicyAcknowledgement({ alreadyAccepted }: { alreadyAccepted: boolean }) {
  const t = useTranslations('policy');
  const tc = useTranslations('common');
  const router = useRouter();
  const { update } = useSession();

  const [checked, setChecked] = React.useState(alreadyAccepted);
  const [pending, startTransition] = React.useTransition();

  function submit() {
    if (!checked) {
      toast.error(t('mustAccept'));
      return;
    }
    startTransition(async () => {
      const result = await acceptPolicyAction();
      if (!result.ok) {
        toast.error(tc('unknownError'));
        return;
      }
      // Refresh the JWT so middleware stops redirecting back here.
      await update({ policyAccepted: true });
      toast.success(t('acknowledged'));
      router.replace('/dashboard');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border-2 border-primary bg-primary-tint p-5">
      <BigCheckbox
        id="policy-ack"
        checked={checked}
        onCheckedChange={setChecked}
        label={t('acknowledge')}
      />
      <Button size="lg" className="w-full" onClick={submit} disabled={pending}>
        <CheckCircle2 aria-hidden />
        <span>{pending ? tc('saving') : t('acknowledgeButton')}</span>
      </Button>
    </div>
  );
}
