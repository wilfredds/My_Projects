import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * What stands in for a screen while its code arrives.
 *
 * Invisible for the first 400ms (`animate-appear` holds it at opacity 0 until
 * then). Once the service worker has its copy a screen arrives in a few
 * milliseconds, and a spinner that flashes for one frame on every tap reads as
 * the app stuttering. It only shows for a download somebody can feel.
 */
export function ScreenFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      className={cn('grid place-items-center', fullScreen ? 'min-h-dvh' : 'min-h-[50dvh]')}
    >
      <span className="animate-appear text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading
      </span>
    </div>
  )
}
