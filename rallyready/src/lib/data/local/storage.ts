/**
 * A very small JSON-over-localStorage layer.
 *
 * Every read and write is guarded: private browsing, disabled storage and a
 * full quota must degrade to "this session was not saved", never to a crash
 * in the middle of a drill (§6).
 */

const PREFIX = 'rallyready.'

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* nothing to do */
  }
}

/**
 * Whether this browser will actually keep what we write.
 *
 * Asked by the screens that promise the player their training is safe, because
 * the alternative is telling somebody in private browsing that their history
 * is "saved in this browser" for a week before they find out it never was.
 *
 * A real write and delete rather than a feature check: `localStorage` exists
 * and answers on iOS Private Browsing and inside the Messenger and Facebook
 * in-app browsers, and only refuses when you try to store something.
 */
export function isStorageWritable(): boolean {
  try {
    localStorage.setItem(PREFIX + 'probe', '1')
    localStorage.removeItem(PREFIX + 'probe')
    return true
  } catch {
    return false
  }
}

/** `crypto.randomUUID` where available, with a plain fallback for old webviews. */
export function newId(): string {
  const cryptoRef = globalThis.crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const STORAGE_KEYS = {
  sessions: 'sessions',
  metrics: 'session-metrics',
  profile: 'profile',
  benchmarks: 'benchmarks',
  badges: 'badges',
  readiness: 'readiness',
  programs: 'programs',
  programDays: 'program-days',
  enrollments: 'program-enrollments',
  /** Set once a local history has been uploaded, so it uploads only once. */
  migratedAt: 'migrated-at',
  drillSettings: 'drill-settings',
  cuePreferences: 'cue-preferences',
} as const
