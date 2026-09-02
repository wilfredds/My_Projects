import { CORNERS } from '@/lib/timer/corners'
import { patternById } from '@/lib/timer/patterns'
import { STROKES } from '@/lib/timer/strokes'

/**
 * The rallies a pattern session will run, written out before you start.
 *
 * Shown rather than hidden because a pattern is a thing to *understand* before
 * you shadow it: the sequence only trains rally construction if you know what
 * the sequence is for, and reading four of them takes fifteen seconds. Once the
 * session starts the board says the name and the voice says the shots, and you
 * never need this screen again.
 */
export function RallyPatternList({ ids }: { ids: string[] }) {
  const patterns = ids.map(patternById).filter((pattern) => pattern !== undefined)
  if (patterns.length === 0) return null

  return (
    <ul className="space-y-4">
      {patterns.map((pattern) => (
        <li key={pattern.id}>
          <p className="text-sm font-medium">{pattern.name}</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{pattern.intent}</p>
          <ol className="mt-2 flex flex-wrap items-center gap-1.5">
            {pattern.shots.map((shot, index) => (
              <li
                key={`${pattern.id}-${index}`}
                className="bg-muted/60 text-foreground/90 rounded-md px-2 py-1 text-[11px] leading-tight"
              >
                <span className="text-muted-foreground">{CORNERS[shot.corner].spoken}</span>{' '}
                <span className="font-medium">{STROKES[shot.stroke].label.toLowerCase()}</span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  )
}
