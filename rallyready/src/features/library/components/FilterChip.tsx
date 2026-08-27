import { cn } from '@/lib/utils'

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

/**
 * A filter value as a toggle. `aria-pressed` rather than a checkbox because
 * these read as one control each, and a screen reader announcing "pressed" is
 * exactly what a chip means.
 */
export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // `min-h-9` plus the wrapper's gap keeps these on the right side of a
        // thumb. They were 30px tall, which is a miss about one tap in five.
        'focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-secondary/60',
      )}
    >
      {label}
    </button>
  )
}
