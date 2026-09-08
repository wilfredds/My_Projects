import { afterEach, describe, expect, it, vi } from 'vitest'

import { isStorageWritable } from '@/lib/data/local/storage'

import { persistStorage } from './persistStorage'

const real = Object.getOwnPropertyDescriptor(window, 'localStorage')

/** A browser that answers every storage call by refusing. */
function refuseStorage(): void {
  const boom = () => {
    throw new DOMException('denied', 'SecurityError')
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => ({ getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom }),
  })
}

afterEach(() => {
  if (real) Object.defineProperty(window, 'localStorage', real)
  else Reflect.deleteProperty(window, 'localStorage')
})

describe('a browser that refuses to store anything', () => {
  it('does not throw out of a write', () => {
    /*
     * The whole point. zustand's own storage lets a refused `setItem` escape,
     * and the drill runner writes a cue preference as it mounts — so the one
     * screen that matters was the one that hit the error boundary.
     */
    refuseStorage()
    expect(() =>
      persistStorage?.setItem('rallyready.test', { state: {}, version: 1 }),
    ).not.toThrow()
  })

  it('reads as empty rather than throwing', () => {
    refuseStorage()
    expect(() => persistStorage?.getItem('rallyready.test')).not.toThrow()
    expect(persistStorage?.getItem('rallyready.test')).toBeNull()
  })

  it('removes without throwing', () => {
    refuseStorage()
    expect(() => persistStorage?.removeItem('rallyready.test')).not.toThrow()
  })

  it('is reported honestly, so no screen promises the training is safe', () => {
    refuseStorage()
    expect(isStorageWritable()).toBe(false)
  })
})

describe('a browser that stores normally', () => {
  it('round-trips a value', () => {
    persistStorage?.setItem('rallyready.test', { state: { a: 1 }, version: 2 })
    expect(persistStorage?.getItem('rallyready.test')).toEqual({ state: { a: 1 }, version: 2 })
    persistStorage?.removeItem('rallyready.test')
    expect(persistStorage?.getItem('rallyready.test')).toBeNull()
  })

  it('says so', () => {
    expect(isStorageWritable()).toBe(true)
  })

  it('leaves nothing behind when it probes', () => {
    // The probe writes a key to find out whether it can. It must not be the
    // one thing left in a player's storage.
    const before = { ...localStorage }
    isStorageWritable()
    expect({ ...localStorage }).toEqual(before)
  })

  it('does not swallow a failure the caller needs to see', () => {
    // A quota error on one key must not be reported as a successful save;
    // `writeJson` returns false and the session repository turns that into an
    // error rather than an id that resolves to nothing.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(isStorageWritable()).toBe(false)
    setItem.mockRestore()
  })
})
