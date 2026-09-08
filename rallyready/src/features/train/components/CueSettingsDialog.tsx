import { Settings2, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { isVibrationSupported } from '@/lib/audio/haptics'
import {
  CALL_LANGUAGES,
  callText,
  LANGUAGE_HINT,
  LANGUAGE_LABEL,
  type CallLanguage,
} from '@/lib/audio/language'
import {
  deliveryFor,
  hasVoiceFor,
  isSpeechSupported,
  primeSpeech,
  speak,
  whenVoicesReady,
} from '@/lib/audio/speech'
import { isAudioSupported } from '@/lib/audio/tones'
import { isWakeLockSupported } from '@/lib/audio/wakeLock'
import { CORNERS } from '@/lib/timer/corners'
import { MAX_SPLIT_STEP_LEAD_MS, MIN_SPLIT_STEP_LEAD_MS } from '@/lib/timer/plan'
import { useCueStore } from '@/store/cueStore'

/** The call the preview button plays: a real one, from a real corner. */
const SAMPLE_CORNER = CORNERS['rear-left']
const SAMPLE_STROKE = 'smash' as const

/**
 * Whether this device can speak Filipino, re-answered when the voice list
 * arrives. Chrome publishes voices asynchronously and returns an empty list on
 * the first call, so asking once on mount would tell every Chrome user their
 * phone has no Filipino voice — including the ones whose phone does.
 */
function useHasFilipinoVoice(): boolean {
  const [present, setPresent] = useState(() => hasVoiceFor('fil'))
  useEffect(() => whenVoicesReady(() => setPresent(hasVoiceFor('fil'))), [])
  return present
}

interface ToggleRowProps {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  disabledHint?: string
}

function ToggleRow({ id, label, hint, checked, onChange, disabled, disabledHint }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className={disabled ? 'text-muted-foreground' : undefined}>
          {label}
        </Label>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {disabled ? disabledHint : hint}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked && !disabled}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  )
}

/**
 * Cue settings. Anything the device cannot do is shown disabled with the
 * reason, rather than hidden or — worse — offered and silently ignored.
 */
export function CueSettingsDialog() {
  const cues = useCueStore()
  const filipinoVoice = useHasFilipinoVoice()

  // Capability checks are stable for the life of the page.
  const support = useMemo(
    () => ({
      speech: isSpeechSupported(),
      audio: isAudioSupported(),
      vibration: isVibrationSupported(),
      wakeLock: isWakeLockSupported(),
    }),
    [],
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Audio and cue settings">
          <Settings2 />
          <span className="sr-only">Audio and cue settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cues</DialogTitle>
          <DialogDescription>
            How the drill reaches you. Keep voice and tone on and you never need to look at the
            screen.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-border divide-y">
          <ToggleRow
            id="cue-voice"
            label="Spoken callouts"
            hint="Says the corner as it is called."
            checked={cues.voiceEnabled}
            onChange={(value) => cues.set('voiceEnabled', value)}
            disabled={!support.speech}
            disabledHint="This browser has no speech synthesis."
          />
          {support.speech && (
            <div className="py-4">
              <p className="mb-2 text-sm font-medium">Call language</p>
              <Segmented
                label="Call language"
                value={cues.callLanguage}
                options={CALL_LANGUAGES.map((language) => ({
                  value: language,
                  label: LANGUAGE_LABEL[language],
                  hint: LANGUAGE_HINT[language],
                }))}
                layout="stacked"
                onChange={(value) => cues.set('callLanguage', value as CallLanguage)}
              />
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {cues.callLanguage === 'en'
                  ? 'Shot names stay in English either way — nobody calls a smash anything else.'
                  : filipinoVoice
                    ? 'This device has a Filipino voice, so the calls are spoken properly.'
                    : 'This device has no Filipino voice, so the words are spelled out for the English one. Close enough to act on, but it will sound like an accent. Hear it before you commit to it.'}
              </p>
              {/*
               * Inside a click, which is the only place iOS will speak at all —
               * and the reason this button exists rather than a note claiming
               * the fallback sounds fine. Judge it by ear.
               */}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  primeSpeech()
                  const language = cues.callLanguage
                  speak(callText(SAMPLE_CORNER, SAMPLE_STROKE, language, deliveryFor(language)), {
                    rate: cues.voiceRate,
                    language,
                  })
                }}
              >
                <Volume2 />
                Hear a call
              </Button>
            </div>
          )}

          <ToggleRow
            id="cue-tone"
            label="Tones"
            hint="Pitch tells you the row, stereo position tells you the side."
            checked={cues.toneEnabled}
            onChange={(value) => cues.set('toneEnabled', value)}
            disabled={!support.audio}
            disabledHint="This browser has no Web Audio support."
          />
          <ToggleRow
            id="cue-vibration"
            label="Vibration"
            hint="A distinct buzz per row — net, mid or rear."
            checked={cues.vibrationEnabled}
            onChange={(value) => cues.set('vibrationEnabled', value)}
            disabled={!support.vibration}
            disabledHint="This device does not expose vibration to the browser."
          />
          <ToggleRow
            id="cue-countdown"
            label="Countdown into work"
            hint="Three beeps before every work block starts."
            checked={cues.countdownEnabled}
            onChange={(value) => cues.set('countdownEnabled', value)}
          />
          <ToggleRow
            id="cue-wakelock"
            label="Keep the screen awake"
            hint="Stops the phone sleeping mid-drill."
            checked={cues.wakeLockEnabled}
            onChange={(value) => cues.set('wakeLockEnabled', value)}
            disabled={!support.wakeLock}
            disabledHint="This browser has no Wake Lock API."
          />

          <ToggleRow
            id="cue-splitstep"
            label="Split-step tick"
            hint="A metronome tick just before each call, to train the timing of your split-step."
            checked={cues.splitStepEnabled}
            onChange={(value) => cues.set('splitStepEnabled', value)}
            disabled={!support.audio}
            disabledHint="Needs Web Audio, which this browser does not have."
          />

          {cues.splitStepEnabled && support.audio && (
            <div className="py-4">
              <div className="mb-2 flex items-baseline justify-between">
                <Label htmlFor="cue-lead">Tick lead time</Label>
                <span className="tnum text-muted-foreground text-sm">
                  {cues.splitStepLeadMs} ms before the call
                </span>
              </div>
              <Slider
                id="cue-lead"
                min={MIN_SPLIT_STEP_LEAD_MS}
                max={MAX_SPLIT_STEP_LEAD_MS}
                step={50}
                value={[cues.splitStepLeadMs]}
                onValueChange={([value]) => cues.set('splitStepLeadMs', value ?? 400)}
                aria-label="Split-step tick lead time in milliseconds"
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Land the split-step as the call arrives. Around 300–500ms suits most players.
              </p>
            </div>
          )}

          {support.audio && (
            <div className="py-4">
              <div className="mb-2 flex items-baseline justify-between">
                <Label htmlFor="cue-volume">Tone volume</Label>
                <span className="tnum text-muted-foreground text-sm">
                  {Math.round(cues.toneVolume * 100)}%
                </span>
              </div>
              <Slider
                id="cue-volume"
                min={0}
                max={1}
                step={0.05}
                value={[cues.toneVolume]}
                onValueChange={([value]) => cues.set('toneVolume', value ?? 0.8)}
                aria-label="Tone volume"
              />
            </div>
          )}

          {support.speech && (
            <div className="py-4">
              <div className="mb-2 flex items-baseline justify-between">
                <Label htmlFor="cue-rate">Voice speed</Label>
                <span className="tnum text-muted-foreground text-sm">
                  {cues.voiceRate.toFixed(2)}×
                </span>
              </div>
              <Slider
                id="cue-rate"
                min={0.8}
                max={2}
                step={0.05}
                value={[cues.voiceRate]}
                onValueChange={([value]) => cues.set('voiceRate', value ?? 1.3)}
                aria-label="Voice speed"
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Faster is better at short intervals — the call has to finish before you move.
              </p>
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={cues.reset} className="self-start">
          Reset to defaults
        </Button>
      </DialogContent>
    </Dialog>
  )
}
