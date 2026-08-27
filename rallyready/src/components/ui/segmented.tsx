import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Shown under the label in the taller `stacked` layout. */
  hint?: string
}

interface SegmentedProps<T extends string> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
  /** `stacked` gives each option two lines and wraps into a grid. */
  layout?: 'inline' | 'stacked'
  columns?: 2 | 3
}

/**
 * A radio group that looks like a segmented control. Radix has no primitive
 * for this shape, and roving-focus radio semantics are what we actually want:
 * arrow keys move between options, one tab stop for the whole group.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  layout = 'inline',
  columns = 2,
}: SegmentedProps<T>) {
  const stacked = layout === 'stacked'

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        stacked
          ? cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')
          : 'bg-secondary/60 inline-flex w-full rounded-xl p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
              event.preventDefault()
              const index = options.findIndex((o) => o.value === value)
              const delta = event.key === 'ArrowRight' ? 1 : -1
              const next = options[(index + delta + options.length) % options.length]
              if (next) onChange(next.value)
            }}
            className={cn(
              'focus-visible:ring-ring rounded-lg font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none',
              stacked
                ? 'flex min-h-[4.25rem] flex-col justify-center gap-0.5 border px-3 py-2.5 text-left text-sm'
                : 'h-11 flex-1 px-3 text-sm',
              selected
                ? stacked
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'bg-background text-foreground shadow-sm'
                : stacked
                  ? 'border-border hover:bg-secondary/60 text-muted-foreground'
                  : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{option.label}</span>
            {option.hint && (
              <span
                className={cn(
                  'text-xs font-normal',
                  selected ? 'opacity-80' : 'text-muted-foreground/80',
                )}
              >
                {option.hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
