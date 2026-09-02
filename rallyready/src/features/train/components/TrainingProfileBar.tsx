import { useQuery } from '@tanstack/react-query'

import { Card, CardContent } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { useRepositories } from '@/lib/data/context'
import type { Discipline, SkillLevel } from '@/lib/data/types'
import { patternsForProfile, DISCIPLINE_NOTE, LEVEL_NOTE } from '@/lib/training/profile'
import { newAtLevel } from '@/lib/training/profile'
import { STROKES } from '@/lib/timer/strokes'
import { useTrainingProfile } from '@/hooks/useTrainingProfile'
import { useUiStore } from '@/store/uiStore'

const LEVELS: { value: SkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const GAMES: { value: Discipline; label: string }[] = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'both', label: 'Both' },
]

/**
 * The two questions that decide what the session actually is.
 *
 * They were asked once in onboarding and then never used for anything you
 * could see. Putting them on the training screen — with the consequence spelled
 * out underneath rather than implied — is the difference between a preference
 * and a setting: change the level here and the rounds, the rest, the pace of
 * the calls and the shots you get asked for all move with it.
 */
export function TrainingProfileBar() {
  const repositories = useRepositories()
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })
  const { level, discipline } = useTrainingProfile()
  const setLevel = useUiStore((state) => state.setBrowseLevel)
  const setDiscipline = useUiStore((state) => state.setBrowseDiscipline)
  const pickedLevel = useUiStore((state) => state.browseLevel)
  const pickedDiscipline = useUiStore((state) => state.browseDiscipline)

  const unlocked = newAtLevel(level)
  const rallies = patternsForProfile({ level, discipline }).length
  // Subscribed rather than read off the store during render: this line is the
  // only thing telling somebody their profile is still in charge, so it has to
  // disappear the moment they touch either control.
  const followingProfile = Boolean(profile) && pickedLevel === null && pickedDiscipline === null

  return (
    <Card className="mb-6">
      <CardContent className="space-y-3 px-4 py-3.5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented
            label="Which game"
            value={discipline}
            options={GAMES}
            onChange={(next) => setDiscipline(next as Discipline)}
          />
          <Segmented
            label="Your level"
            value={level}
            options={LEVELS}
            onChange={(next) => setLevel(next as SkillLevel)}
          />
        </div>

        {/* Two lines, no more. This is the frame around the session, not the
            session — anything longer pushes today's drill below the fold. */}
        <div className="text-muted-foreground space-y-1 text-xs leading-relaxed">
          <p>
            <span className="text-foreground font-medium">{LEVEL_NOTE[level]}</span>{' '}
            {DISCIPLINE_NOTE[discipline]}
          </p>
          <p>
            {rallies} rally {rallies === 1 ? 'pattern' : 'patterns'}
            {unlocked.length > 0 && (
              <>
                {' · new shots: '}
                {unlocked.map((id) => STROKES[id].label.toLowerCase()).join(', ')}
              </>
            )}
            {followingProfile && ' · following your profile'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
