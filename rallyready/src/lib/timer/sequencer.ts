import { cornerIdsForLayout, isCornerInLayout, type CornerId } from './corners'
import type { Rng } from './rng'
import type { DrillMode, SequencerConfig } from './types'

export interface CallPlan {
  corner: CornerId
  /** Set when this slot is a deception: the fake called before the real one. */
  feint?: CornerId
}

export interface Sequencer {
  next(): CallPlan
}

export const DEFAULT_DECEPTION_PROBABILITY = 0.35
export const DEFAULT_DECEPTION_GAP_MS = 600

/**
 * Drops zones that are not part of the layout, restores numbered order (so
 * Sequential mode walks the same 1..n path the board shows), and falls back to
 * the full layout if a caller managed to disable everything.
 */
export function normalizeSequencerConfig(config: SequencerConfig): SequencerConfig {
  const order = cornerIdsForLayout(config.layout)
  const enabled = order.filter(
    (id) => config.enabled.includes(id) && isCornerInLayout(config.layout, id),
  )
  return {
    ...config,
    enabled: enabled.length > 0 ? enabled : order,
  }
}

function weightOf(config: SequencerConfig, id: CornerId): number {
  const w = config.weights[id]
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 1
}

function weightedPick(candidates: CornerId[], config: SequencerConfig, rng: Rng): CornerId {
  const total = candidates.reduce((sum, id) => sum + weightOf(config, id), 0)
  let roll = rng.next() * total
  for (const id of candidates) {
    roll -= weightOf(config, id)
    if (roll < 0) return id
  }
  // Only reachable through floating-point drift on the final candidate.
  return candidates[candidates.length - 1] as CornerId
}

export function createSequencer(rawConfig: SequencerConfig, rng: Rng): Sequencer {
  const config = normalizeSequencerConfig(rawConfig)
  const { enabled } = config
  let cursor = 0
  let previous: CornerId | null = null

  const pickCorner = (): CornerId => {
    if (config.selection === 'sequential') {
      const corner = enabled[cursor % enabled.length] as CornerId
      cursor += 1
      return corner
    }

    // A single enabled zone can never avoid repeating itself.
    const avoidRepeat = config.avoidImmediateRepeat && enabled.length > 1 && previous !== null
    const candidates = avoidRepeat ? enabled.filter((id) => id !== previous) : enabled

    return config.selection === 'weighted'
      ? weightedPick(candidates, config, rng)
      : rng.pick(candidates)
  }

  return {
    next(): CallPlan {
      const corner = pickCorner()
      previous = corner

      const canFeint = config.deception.enabled && enabled.length > 1
      if (canFeint && rng.next() < config.deception.probability) {
        const alternatives = enabled.filter((id) => id !== corner)
        return { corner, feint: rng.pick(alternatives) }
      }
      return { corner }
    },
  }
}

/**
 * Maps the five user-facing modes (§4) onto the orthogonal knobs the
 * sequencer actually consumes.
 */
export function applyMode(config: SequencerConfig, mode: DrillMode): SequencerConfig {
  const base: SequencerConfig = {
    ...config,
    deception: { ...config.deception, enabled: false },
  }
  switch (mode) {
    case 'sequential':
      return { ...base, selection: 'sequential', announce: 'position' }
    case 'random':
      return { ...base, selection: 'random', announce: 'position' }
    case 'number':
      return { ...base, selection: 'random', announce: 'number' }
    case 'weighted':
      return { ...base, selection: 'weighted', announce: 'position' }
    case 'stroke':
      return { ...base, selection: 'random', announce: 'stroke' }
    case 'deception':
      return {
        ...base,
        selection: 'random',
        announce: 'position',
        deception: { ...config.deception, enabled: true },
      }
  }
}

/** Recovers the UI mode from a config, for round-tripping saved settings. */
export function modeFromConfig(config: SequencerConfig): DrillMode {
  if (config.deception.enabled) return 'deception'
  if (config.selection === 'sequential') return 'sequential'
  if (config.selection === 'weighted') return 'weighted'
  if (config.announce === 'stroke') return 'stroke'
  return config.announce === 'number' ? 'number' : 'random'
}
