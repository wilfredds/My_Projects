import { useQuery } from '@tanstack/react-query'

import { useRepositories } from '@/lib/data/context'
import type { Discipline, SkillLevel } from '@/lib/data/types'
import type { TrainingProfile } from '@/lib/training/profile'
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
 */
export function useTrainingProfile(): TrainingProfile {
  const repositories = useRepositories()
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })
  const storedLevel = useUiStore((state) => state.browseLevel)
  const storedDiscipline = useUiStore((state) => state.browseDiscipline)

  const level: SkillLevel = storedLevel ?? profile?.skillLevel ?? 'beginner'
  const discipline: Discipline = storedDiscipline ?? profile?.primaryDiscipline ?? 'both'
  return { level, discipline }
}
