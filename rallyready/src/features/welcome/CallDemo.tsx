import { Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { vibrateCorner } from '@/lib/audio/haptics'
import { cornerText } from '@/lib/audio/language'
import { deliveryFor, isSpeechSupported, primeSpeech, speak } from '@/lib/audio/speech'
import { isAudioSupported, playCornerTone, unlockAudio } from '@/lib/audio/tones'
import { CORNERS, cornerIdsForLayout, type CornerId } from '@/lib/timer/corners'
import { useCueStore } from '@/store/cueStore'

import { CourtBoard } from '@/features/train/components/CourtBoard'

/**
 * The one screen where the product demonstrates itself.
 *
 * RallyReady is audio-first — a whole session is meant to be done without
 * looking at the phone — and a new user has no way to know that from a
 * paragraph. So they press a button and hear a real call, with its real tone
 * and its real buzz, while the board shows where it would send them.
 *
 * It has to be a button press, not autoplay. iOS refuses to speak or to start
 * an AudioContext outside a user gesture, so this doubles as the moment the
 * whole audio layer is unlocked for the rest of the session. Autoplaying it
 * would leave the app mute until the player happened to tap something else.
 *
 * The rAF here drives one 1.4-second marker sweep on a welcome screen. Nothing
 * is running; this is not on the sequencer's path.
 */

const LAYOUT = 4
/** Roughly a real shot interval, so the demo is honest about the pace. */
const SWEEP_MS = 1400

export function CallDemo() {
  const reducedMotion = useReducedMotion()
  const cues = useCueStore()

  const [corner, setCorner] = useState<CornerId | null>(null)
  const [progress, setProgress] = useState(0)
  const [played, setPlayed] = useState(0)
  const [silent, setSilent] = useState<string | null>(null)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const play = useCallback(async () => {
    const options = cornerIdsForLayout(LAYOUT).filter((id) => id !== corner)
    const next = options[Math.floor(Math.random() * options.length)] as CornerId
    const def = CORNERS[next]

    // Unlock first, inside the gesture. Both of these are no-ops after the
    // first successful call, so pressing again costs nothing.
    const audioReady = await unlockAudio()
    primeSpeech()

    setCorner(next)
    setPlayed((n) => n + 1)

    if (isSpeechSupported()) {
      // Same options the cue layer uses, so the demo is not a nicer-sounding
      // version of the thing it is demonstrating.
      const language = cues.callLanguage
      speak(cornerText(def, language, deliveryFor(language)), {
        rate: cues.voiceRate,
        language,
      })
      setSilent(null)
    } else {
      // Degrade honestly rather than looking broken.
      setSilent('This browser will not speak, so you are seeing the call instead of hearing it.')
    }

    if (audioReady && isAudioSupported()) playCornerTone(def.row, def.side)
    else if (isSpeechSupported()) {
      setSilent('Sound is off or blocked — the call still buzzes and shows on the board.')
    }
    vibrateCorner(def.row)

    // The marker travels out and recovers, in step with the spoken call.
    cancelAnimationFrame(frame.current)
    if (reducedMotion) {
      setProgress(0.35)
      return
    }
    const started = performance.now()
    const tick = (now: number) => {
      const value = Math.min(1, (now - started) / SWEEP_MS)
      setProgress(value)
      if (value < 1) frame.current = requestAnimationFrame(tick)
    }
    setProgress(0)
    frame.current = requestAnimationFrame(tick)
  }, [corner, cues.callLanguage, cues.voiceRate, reducedMotion])

  return (
    <div>
      <div className="mx-auto w-full max-w-[15rem]">
        <CourtBoard
          layout={LAYOUT}
          enabled={cornerIdsForLayout(LAYOUT)}
          activeCorner={corner}
          callProgress={progress}
          showNumbers={false}
          reducedMotion={reducedMotion}
        />
      </div>

      <Button size="xl" className="mt-5 w-full" onClick={() => void play()}>
        {silent ? <VolumeX /> : <Volume2 />}
        {played === 0 ? 'Hear a call' : 'Again'}
      </Button>

      <p
        className="text-muted-foreground mt-3 min-h-[2.5rem] text-center text-sm leading-relaxed"
        role="status"
      >
        {silent ??
          (played === 0
            ? 'Turn your volume up. This is exactly what a drill sounds like.'
            : corner
              ? `“${cornerText(CORNERS[corner], cues.callLanguage)}” — spoken, toned and buzzed. You never have to look.`
              : '')}
      </p>
    </div>
  )
}
