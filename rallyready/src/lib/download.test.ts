import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from './download'

describe('downloadBlob', () => {
  let created: string[]
  let revoked: string[]
  let clicked: { download: string; connected: boolean }[]

  beforeEach(() => {
    vi.useFakeTimers()
    created = []
    revoked = []
    clicked = []
    let counter = 0
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:test/${(counter += 1)}`
      created.push(url)
      return url
    })
    URL.revokeObjectURL = vi.fn((url: string) => revoked.push(url))
    // jsdom does not navigate, but it does dispatch the click.
    // Captured at click time: the helper removes the anchor immediately
    // afterwards, so reading `isConnected` later would always be false.
    document.addEventListener('click', (event) => {
      const target = event.target
      if (target instanceof HTMLAnchorElement) {
        clicked.push({ download: target.download, connected: target.isConnected })
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const run = () => downloadBlob(new Blob(['hello'], { type: 'text/plain' }), 'notes.txt')

  it('clicks an anchor that is actually in the document', () => {
    // Firefox ignores a click on a detached element and the download never
    // starts — silently.
    run()
    expect(clicked).toHaveLength(1)
    expect(clicked[0]?.download).toBe('notes.txt')
    expect(clicked[0]?.connected).toBe(true)
  })

  it('does not revoke the URL before the download can start', () => {
    // The bug this file exists to prevent: revoking on the next line pulls the
    // blob out from under a download that has only been queued.
    run()
    expect(revoked).toEqual([])
    vi.advanceTimersByTime(60_000)
    expect(revoked).toEqual(created)
  })

  it('does not leak the URL either', () => {
    run()
    vi.runAllTimers()
    expect(revoked).toHaveLength(created.length)
  })

  it('leaves no anchors behind', () => {
    run()
    run()
    run()
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })

  it('still cleans up when the click throws', () => {
    const boom = new Error('blocked')
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag)
      if (tag === 'a') {
        el.click = () => {
          throw boom
        }
      }
      return el
    })

    expect(run).toThrow(boom)
    expect(document.querySelectorAll('a')).toHaveLength(0)
    vi.runAllTimers()
    expect(revoked).toEqual(created)
    vi.restoreAllMocks()
  })
})
