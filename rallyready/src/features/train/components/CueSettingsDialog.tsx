import { Settings2, Volume2 } from 'lucide-react'
import { useMemo, useSyncExternalStore } from 'react'

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
  isSpeechSupported,
  listVoices,
  primeSpeech,
  serverVoicesSnapshot,
  speak,
  subscribeVoices,
  voicesSnapshot,
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
 * The voices that can speak a language, re-read when the list arrives.
 *
 * Chrome publishes voices asynchronously and returns an empty list on the first
 * call, so reading once on mount would tell every Chrome user their phone has
 * no Filipino voice — including the ones whose phone does.
 */
function useVoices(language: CallLanguage): SpeechSynthesisVoice[] {
  // The voice list is external mutable state that changes without React's
  // knowledge, which is exactly what `useSyncExternalStore` is for. The
  // snapshot keeps its identity until the voices actually change, so the memo
  // below only re-sorts when there is something new to sort.
  const all = useSyncExternalStore(subscribeVoices, voicesSnapshot, serverVoicesSnapshot)
  return useMemo(() => (all.length === 0 ? [] : listVoices(language)), [all, language])
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
  const filipinoVoice = useVoices('fil').length > 0
  /*
   * Which voice actually reads the call. On the respelled path the text is
   * English spelling of Filipino words, so it is an English voice doing the
   * reading and an English voice the player should be choosing between.
   */
  const voiceLanguage: CallLanguage =
    deliveryFor(cues.callLanguage) === 'native' ? cues.callLanguage : 'en'
  const voices = useVoices(voiceLanguage)
  const chosenUri = cues.voiceUris[voiceLanguage] ?? ''

  const hearACall = () => {
    // Inside a click, which is the only place iOS will speak at all.
    primeSpeech()
    const language = cues.callLanguage
    speak(callText(SAMPLE_CORNER, SAMPLE_STROKE, language, deliveryFor(language)), {
      rate: cues.voiceRate,
      language,
      voiceUris: cues.voiceUris,
    })
  }

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
               * A picker only when there is something to pick. One voice is not
               * a choice, and an empty select is worse than none.
               */}
              {voices.length > 1 && (
                <div className="mt-4">
                  <Label className="mb-2 block" htmlFor="cue-voice-name">
                    Voice
                  </Label>
                  <select
                    id="cue-voice-name"
                    className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none"
                    value={chosenUri}
                    onChange={(event) =>
                      cues.set('voiceUris', {
                        ...cues.voiceUris,
                        [voiceLanguage]: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Chosen for me</option>
                    {voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                        {voice.localService ? '' : ' · needs a connection'}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                    Voices that need a connection fetch every call as you train, which arrives late
                    and does not work offline. The ones on your phone are listed first.
                  </p>
                </div>
              )}

              {/*
               * The reason this button exists rather than a note claiming the
               * voice sounds fine. Judge it by ear, and change it if it is not.
               */}
              <Button variant="outline" size="sm" className="mt-3" onClick={hearACall}>
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
