import { Check, Download, Loader2, Share2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/download'
import { canShareImages, renderShareCard, type ShareCardData } from '@/lib/share/card'

/**
 * Shares the session as an image through the OS share sheet, which is what
 * actually reaches Messenger, Facebook and Instagram — no per-platform SDKs,
 * no API keys, and it works from an installed PWA.
 *
 * Where the share sheet is unavailable (most desktop browsers) it downloads the
 * image instead, so the button is never a dead end.
 */
export function ShareSessionButton({ data }: { data: ShareCardData }) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle')
  const canShare = canShareImages()

  const run = async () => {
    setState('working')
    try {
      const blob = await renderShareCard(data)
      if (!blob) {
        setState('idle')
        return
      }
      const file = new File([blob], 'rallyready-session.png', { type: 'image/png' })

      if (canShare) {
        // Text alongside the image: some targets show one, some the other.
        await navigator.share({
          files: [file],
          title: 'RallyReady',
          text: `${data.drillName} — ${data.durationLabel} of solo badminton training.`,
        })
      } else {
        downloadBlob(blob, 'rallyready-session.png')
      }
      setState('done')
      window.setTimeout(() => setState('idle'), 2200)
    } catch {
      // A cancelled share sheet throws AbortError. Nothing went wrong and
      // there is nothing to tell the user about.
      setState('idle')
    }
  }

  return (
    <Button variant="outline" size="lg" className="sm:flex-1" onClick={() => void run()}>
      {state === 'working' ? (
        <Loader2 className="animate-spin" />
      ) : state === 'done' ? (
        <Check />
      ) : canShare ? (
        <Share2 />
      ) : (
        <Download />
      )}
      {state === 'done' ? 'Done' : canShare ? 'Share' : 'Save image'}
    </Button>
  )
}
