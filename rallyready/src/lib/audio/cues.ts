import { CORNERS } from '@/lib/timer/corners'
import { spokenCall, type StrokeId } from '@/lib/timer/strokes'
import type { BlockPhase, TimelineEvent } from '@/lib/timer/types'

import { vibrateComplete, vibrateCorner, vibrateCountdown } from './haptics'
import { speak } from './speech'
import {
  playCompleteTone,
  playCornerTone,
  playCountdownTone,
  playPhaseTone,
  playSplitStepTick,
} from './tones'

/**
 * Turns timeline events into the three eyes-free channels: voice, tone and
 * haptics (§1). This is the only place that decides what a drill sounds like.
 */

export interface CuePreferences {
  voiceEnabled: boolean
  voiceRate: number
  voiceUri: string | null
  toneEnabled: boolean
  toneVolume: number
  vibrationEnabled: boolean
  countdownEnabled: boolean
  splitStepEnabled: boolean
  /** Lead time for the split-step tick, in ms before the call (§4). */
  splitStepLeadMs: number
  wakeLockEnabled: boolean
  /** Speak zone numbers instead of positions — set by Number mode. */
  announceNumbers: boolean
}

export const DEFAULT_CUE_PREFERENCES: CuePreferences = {
  voiceEnabled: true,
  voiceRate: 1.3,
  voiceUri: null,
  toneEnabled: true,
  toneVolume: 0.8,
  vibrationEnabled: true,
  countdownEnabled: true,
  splitStepEnabled: true,
  // ~0.4s before the call: enough to land the split-step as the call arrives.
  splitStepLeadMs: 400,
  wakeLockEnabled: true,
  announceNumbers: false,
}

const PHASE_SPEECH: Partial<Record<BlockPhase, string>> = {
  work: 'go',
  sprint: 'sprint',
  rest: 'rest',
  warmup: 'warm up',
  cooldown: 'cool down',
}

export interface CueContext {
  preferences: CuePreferences
  /** Phase of the block a `block-start` event refers to. */
  phaseOf: (blockIndex: number) => BlockPhase | undefined
  /**
   * Name of the exercise a circuit block calls for, if any. Announcing it is
   * what makes a circuit followable without looking — "tuck jumps" tells you
   * everything, where a generic "go" tells you nothing.
   */
  exerciseNameOf?: (blockIndex: number) => string | undefined
}

/**
 * A feint fires exactly the same cue as a real call. If a fake were
 * distinguishable the drill would train nothing — being unable to tell is the
 * entire point.
 */
function announceCorner(
  corner: keyof typeof CORNERS,
  zoneNumber: number,
  preferences: CuePreferences,
  stroke?: StrokeId,
): void {
  const def = CORNERS[corner]
  if (preferences.toneEnabled) playCornerTone(def.row, def.side)
  if (preferences.vibrationEnabled) vibrateCorner(def.row)
  if (!preferences.voiceEnabled) return

  /*
   * Three things the voice can say, in order of specificity: the shot to play
   * from a corner, the corner's number, or the corner itself. A stroke always
   * wins — it is strictly more information, and it is the only one of the
   * three that tells you what to do once you get there.
   */
  const text = stroke
    ? spokenCall(def.spoken, stroke)
    : preferences.announceNumbers
      ? String(zoneNumber)
      : def.spoken
  speak(text, { rate: preferences.voiceRate })
}

export function playCue(event: TimelineEvent, context: CueContext): void {
  const { preferences } = context

  switch (event.kind) {
    case 'call':
      announceCorner(event.corner, event.number, preferences, event.stroke)
      return

    /*
     * A feint names no shot, and that is deliberate. The fake has to be
     * indistinguishable from the real call until the real one arrives, and a
     * feint that announced a stroke would give the game away every time.
     */
    case 'feint':
      announceCorner(event.corner, event.number, preferences)
      return

    case 'split-step':
      if (preferences.splitStepEnabled && preferences.toneEnabled) playSplitStepTick()
      return

    case 'countdown':
      if (!preferences.countdownEnabled) return
      if (preferences.toneEnabled) playCountdownTone(event.secondsLeft)
      if (preferences.vibrationEnabled) vibrateCountdown()
      return

    case 'block-start': {
      const phase = context.phaseOf(event.blockIndex)
      if (!phase || phase === 'prepare') return
      if (preferences.toneEnabled) {
        playPhaseTone(phase === 'rest' || phase === 'cooldown' ? 'rest' : 'work')
      }
      if (!preferences.voiceEnabled) return

      const exercise = context.exerciseNameOf?.(event.blockIndex)
      const word = exercise ?? PHASE_SPEECH[phase]
      if (word) speak(word, { rate: preferences.voiceRate })
      return
    }

    case 'complete':
      if (preferences.toneEnabled) playCompleteTone()
      if (preferences.vibrationEnabled) vibrateComplete()
      if (preferences.voiceEnabled) {
        speak('Session complete. Well done.', { rate: preferences.voiceRate })
      }
      return
  }
}
