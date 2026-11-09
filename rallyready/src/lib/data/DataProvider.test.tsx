import { onlineManager, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTrainingProfile } from '@/hooks/useTrainingProfile'

import { useRepositories } from './context'
import { DataProvider, PROFILE_WAIT_MS } from './DataProvider'
import type * as Index from './index'
import { createLocalRepositories } from './local/repositories'
import type { Repositories } from './ports'
import type { Profile } from './types'

// Real repositories unless a test swaps in its own, to tell two people apart.
// Hoisted with the mock below, which runs before anything else in this file.
const swap = vi.hoisted(() => ({
  make: null as ((userId: string | null) => Repositories) | null,
}))
vi.mock('./index', async (actual) => {
  const real = await actual<typeof Index>()
  return {
    ...real,
    createRepositories: (userId: string | null) =>
      swap.make ? swap.make(userId) : real.createRepositories(userId),
  }
})

/** Repositories for one named person; only what these screens read. */
function personRepositories(name: string, get?: () => Promise<Profile | null>): Repositories {
  return {
    backend: 'local',
    profiles: {
      get: get ?? (() => Promise.resolve({ displayName: name, skillLevel: 'advanced' } as Profile)),
      save: () => Promise.reject(new Error('read-only')),
    },
  } as unknown as Repositories
}

beforeEach(() => {
  localStorage.clear()
  swap.make = null
})
afterEach(() => {
  swap.make = null
  onlineManager.setOnline(true)
})

describe('a screen never draws before the player is known', () => {
  it('has the saved level on its very first render, not the beginner placeholder', async () => {
    await createLocalRepositories().profiles.save({ skillLevel: 'advanced' })

    const levels: string[] = []
    function Screen() {
      const { level } = useTrainingProfile()
      levels.push(level)
      return <p>level {level}</p>
    }
    render(
      <DataProvider userId={null}>
        <Screen />
      </DataProvider>,
    )

    await screen.findByText('level advanced')
    // The runner built a beginner's drill from exactly this first render.
    expect(levels[0]).toBe('advanced')
    expect(levels).not.toContain('beginner')
  })

  it('opens anyway when the profile never answers', async () => {
    swap.make = () => personRepositories('nobody', () => new Promise(() => {}))
    render(
      <DataProvider userId="slow">
        <p>the app</p>
      </DataProvider>,
    )

    expect(screen.queryByText('the app')).toBeNull()
    await waitFor(() => expect(screen.getByText('the app')).toBeTruthy(), {
      timeout: PROFILE_WAIT_MS + 1000,
    })
  })
})

describe("signing in or out never shows the last person's data", () => {
  it('serves the new person from their own cache, from the first frame', async () => {
    swap.make = (userId) => personRepositories(userId ?? 'this phone')

    const seen: string[] = []
    function Name() {
      const repositories = useRepositories()
      const { data } = useQuery({
        queryKey: ['profile'],
        queryFn: () => repositories.profiles.get(),
      })
      const name = data?.displayName ?? '(loading)'
      seen.push(name)
      return <p>name {name}</p>
    }

    const { rerender } = render(
      <DataProvider userId="ana">
        <Name />
      </DataProvider>,
    )
    await screen.findByText('name ana')

    // A shared phone: Ana signs out and Ben signs in, well inside the 30s
    // a cached profile counts as fresh.
    rerender(
      <DataProvider userId="ben">
        <Name />
      </DataProvider>,
    )
    await screen.findByText('name ben')

    const afterSwitch = seen.slice(seen.lastIndexOf('ana') + 1)
    expect(afterSwitch.length).toBeGreaterThan(0)
    expect(afterSwitch.every((name) => name === 'ben')).toBe(true)
  })
})

describe('no signal is not a reason to stop reading this phone', () => {
  it('reads data after the phone has gone offline', async () => {
    // A court with no signal: the browser has fired 'offline'. Training data
    // is on the phone, so a read must not wait for a network it never uses.
    // It used to pause, and a screen that took "nothing yet" for "nothing"
    // greeted every drill finished offline with "Session not found".
    onlineManager.setOnline(false)
    swap.make = () => personRepositories('court')

    function Summary() {
      const repositories = useRepositories()
      const { data, isLoading } = useQuery({
        queryKey: ['session', 'just-saved'],
        queryFn: () => repositories.profiles.get(),
      })
      if (isLoading) return <p>loading</p>
      return <p>{data ? `found ${data.displayName}` : 'Session not found'}</p>
    }
    render(
      <DataProvider userId="court">
        <Summary />
      </DataProvider>,
    )

    // Well inside the profile gate's own timeout, so a paused gate fails too.
    await screen.findByText('found court', {}, { timeout: PROFILE_WAIT_MS / 3 })
    expect(screen.queryByText('Session not found')).toBeNull()
  })
})
