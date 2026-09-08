import { useQuery } from '@tanstack/react-query'

import { useRepositories } from '@/lib/data/context'
import type { Discipline, SkillLevel } from '@/lib/data/types'
import type { TrainingProfile } from '@/lib/training/profile'
import { useCueStore } from '@/store/cueStore'
import { useUiStore } from '@/store/uiStore'

/**
 * The level and game every screen shapes itself around.
 *
 * Onboarding asks for both and the profile stores them, but a stored answer is
 * not always the current one: somebody who plays doubles all year and has a
 * singles tournament next month should be able to say so without editing their
 * profile. So the browse choice wins where one has been made, the profile
 * seeds it, and beginner/both is the safe floor for a player the app has never
 * met — never the hardest option by default.
 *
 * The call language rides along because it changes the shape of a session: a
 * Filipino call takes longer to say, so the interval floor is higher. Reading
 * it here means every screen that already fits a drill to the player — the
 * cards, the estimates and the setup screen — agrees with what will actually
 * run, without any of them having to know about the audio layer.
 */
export function useTrainingProfile(): TrainingProfile {
  const repositories = useRepositories()
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })
  const storedLevel = useUiStore((state) => state.browseLevel)
  const storedDiscipline = useUiStore((state) => state.browseDiscipline)
  const language = useCueStore((state) => state.callLanguage)

  const level: SkillLevel = storedLevel ?? profile?.skillLevel ?? 'beginner'
  const discipline: Discipline = storedDiscipline ?? profile?.primaryDiscipline ?? 'both'
  return { level, discipline, language }
}
