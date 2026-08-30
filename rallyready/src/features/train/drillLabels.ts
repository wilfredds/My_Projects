import type { Drill } from '@/lib/data/types'

export const CATEGORY_LABEL: Record<Drill['category'], string> = {
  footwork: 'Footwork',
  net: 'Net',
  'rear-court': 'Rear court',
  conditioning: 'Conditioning',
  strength: 'Strength',
  agility: 'Agility',
  plyometric: 'Plyometric',
  warmup: 'Warm-up',
  cooldown: 'Cool-down',
}

export const LEVEL_LABEL: Record<Drill['level'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}
