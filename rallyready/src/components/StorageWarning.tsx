import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'

import { isStorageWritable } from '@/lib/data/local/storage'
import { cn } from '@/lib/utils'

/**
 * Says out loud that nothing is being saved.
 *
 * Only renders where it is true, so it is never noise: for almost everybody
 * this component draws nothing at all. For the rest — iOS Private Browsing,
 * "block all cookies", and the in-app browsers inside Messenger and Facebook —
 * it is the difference between finding out now and finding out after a month
 * of training that none of it was ever kept.
 *
 * An in-app browser is not an edge case here. It is how somebody opens a link
 * a friend sent them, which is how every tester of this app will arrive.
 */
export function StorageWarning({ className }: { className?: string }) {
  // A settled fact for the life of the page: the browser is not going to
  // change its mind about storage between renders.
  const writable = useMemo(() => isStorageWritable(), [])
  if (writable) return null

  return (
    <div
      role="status"
      className={cn(
        'border-destructive/40 bg-destructive/10 text-foreground flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed',
        className,
      )}
    >
      <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">This browser will not let RallyReady save anything.</span> You
        can train, and every call still works — but your sessions, streak and settings will be gone
        when you close this tab. Open RallyReady in Safari or Chrome to keep them.
      </p>
    </div>
  )
}
