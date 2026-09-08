import { CORNERS } from '@/lib/timer/corners'
import type { StrokeId } from '@/lib/timer/strokes'
import type { BlockPhase, TimelineEvent } from '@/lib/timer/types'

import { vibrateComplete, vibrateCorner, vibrateCountdown } from './haptics'
import { callText, completeText, numberText, phaseText, type CallLanguage } from './language'
import { deliveryFor, speak } from './speech'
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
  /** Which language the calls come in. */
  callLanguage: CallLanguage
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
  callLanguage: 'en',
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

  const language = preferences.callLanguage
  const delivery = deliveryFor(language)

  /*
   * Three things the voice can say, in order of specificity: the shot to play
   * from a corner, the corner's number, or the corner itself. A stroke always
   * wins — it is strictly more information, and it is the only one of the
   * three that tells you what to do once you get there.
   */
  const text = stroke
    ? callText(def, stroke, language, delivery)
    : preferences.announceNumbers
      ? numberText(zoneNumber, language, delivery)
      : callText(def, undefined, language, delivery)
  speak(text, { rate: preferences.voiceRate, language })
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

      /*
       * An exercise name is always spoken in English — "push up" and "plank"
       * are the words used in a Filipino gym — so it carries no language, and
       * the phase word around it does.
       */
      const exercise = context.exerciseNameOf?.(event.blockIndex)
      if (exercise) {
        speak(exercise, { rate: preferences.voiceRate })
        return
      }
      const language = preferences.callLanguage
      const word = phaseText(phase, language, deliveryFor(language))
      if (word) speak(word, { rate: preferences.voiceRate, language })
      return
    }

    case 'complete':
      if (preferences.toneEnabled) playCompleteTone()
      if (preferences.vibrationEnabled) vibrateComplete()
      if (preferences.voiceEnabled) {
        const language = preferences.callLanguage
        speak(completeText(language, deliveryFor(language)), {
          rate: preferences.voiceRate,
          language,
        })
      }
      return
  }
}
