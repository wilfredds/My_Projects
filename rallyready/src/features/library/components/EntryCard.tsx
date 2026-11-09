import { BookOpen, Dumbbell, Home, MapPin, Target, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Pressable } from '@/components/motion/Pressable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { LibraryEntry, LibraryKind } from '@/lib/library/entries'

import { CATEGORY_LABEL, LEVEL_LABEL } from '../../train/drillLabels'

const KIND_ICON: Record<LibraryKind, typeof BookOpen> = {
  technique: BookOpen,
  drill: Target,
  exercise: Dumbbell,
}

const KIND_TINT: Record<LibraryKind, string> = {
  technique: 'bg-cooldown/15 text-cooldown-ink',
  drill: 'bg-work/15 text-work-ink',
  exercise: 'bg-sprint/15 text-sprint-ink',
}

export function EntryCard({ entry }: { entry: LibraryEntry }) {
  const Icon = KIND_ICON[entry.kind]

  return (
    <Pressable className="h-full">
      <Card className="hover:border-primary/50 h-full transition-colors">
        <CardContent className="p-4">
          <Link to={`/library/${entry.kind}/${entry.slug}`} className="flex gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-lg ${KIND_TINT[entry.kind]}`}
            >
              <Icon className="size-5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="leading-snug font-semibold text-balance">{entry.title}</h3>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
                {entry.summary}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline">{CATEGORY_LABEL[entry.category]}</Badge>
                <Badge variant="outline">{LEVEL_LABEL[entry.level]}</Badge>
                <Badge variant="outline">
                  {entry.minutes} min{entry.kind === 'technique' ? ' read' : ''}
                </Badge>
                {entry.practiceMode === 'partner' ? (
                  <Badge variant="outline" title="Needs a partner to practise properly">
                    <Users className="size-3" aria-hidden />
                    Partner
                  </Badge>
                ) : entry.location === 'anywhere' ? (
                  <Badge variant="outline" title="No court needed">
                    <Home className="size-3" aria-hidden />
                    No court
                  </Badge>
                ) : (
                  <Badge variant="outline" title="Best on a court">
                    <MapPin className="size-3" aria-hidden />
                    Court
                  </Badge>
                )}
              </div>
            </div>
          </Link>
        </CardContent>
      </Card>
    </Pressable>
  )
}
