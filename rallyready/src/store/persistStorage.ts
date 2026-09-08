import { createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'

/**
 * Persistence that cannot take the app down.
 *
 * `zustand/persist` guards *getting* the storage object but not the calls on
 * it: `setItem` goes straight through, so a browser that refuses storage
 * throws out of whatever render happened to change a setting. In this app that
 * was the drill runner — it writes one cue preference as it mounts — so every
 * screen degraded politely except the only one that matters, which hit the
 * error boundary and left the player unable to train at all.
 *
 * That is not an exotic case. iOS Private Browsing, "block all cookies", a
 * locked-down corporate profile, and the in-app browsers inside Messenger and
 * Facebook all land here — and an in-app browser is exactly how somebody opens
 * a link a friend sent them, which is how every tester will arrive.
 *
 * So each call is wrapped, the same way `lib/data/local/storage` already wraps
 * the session history. A refusal means settings do not survive a reload, which
 * is a disappointment. A crash means no training at all, which is a broken app.
 */
const guarded: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* not saved — the store still holds it for this visit */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* nothing to do */
    }
  },
}

/**
 * Hand this to every `persist` call. Built once: `createJSONStorage` resolves
 * its storage eagerly, and `guarded` touches `localStorage` only inside the
 * calls, so it is safe even where reading `window.localStorage` itself throws.
 */
export const persistStorage = createJSONStorage(() => guarded)
