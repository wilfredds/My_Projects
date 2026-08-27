import { useQueryClient } from '@tanstack/react-query'
import { Download, HardDriveDownload, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { backupFilename, buildBackup, parseBackup, planRestore } from '@/lib/data/backup'
import { useRepositories } from '@/lib/data/context'
import { downloadBlob } from '@/lib/download'
import { pluralize } from '@/lib/utils'

/**
 * Getting your training out of the app and back in again.
 *
 * Local storage is scoped to one origin in one browser. Change the domain,
 * clear your browsing data or lose the phone and it is gone — so an export is
 * not a power-user nicety here, it is the only backup that exists.
 */
export function BackupCard() {
  const repositories = useRepositories()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const doExport = async () => {
    setBusy('export')
    setMessage(null)
    try {
      const [profile, sessions, metrics, benchmarks, readiness] = await Promise.all([
        repositories.profiles.get(),
        repositories.sessions.listRecent(100_000),
        repositories.sessions.listAllMetrics(),
        repositories.benchmarks.list(),
        repositories.readiness.listRecent(100_000),
      ])
      const file = buildBackup({ profile, sessions, metrics, benchmarks, readiness })
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      downloadBlob(blob, backupFilename())
      setMessage({
        tone: 'ok',
        text: `Exported ${pluralize(sessions.length, 'session')} and ${pluralize(benchmarks.length, 'benchmark')}.`,
      })
    } catch {
      setMessage({ tone: 'bad', text: 'Could not read your data to export it.' })
    } finally {
      setBusy(null)
    }
  }

  const doImport = async (file: File) => {
    setBusy('import')
    setMessage(null)
    try {
      const parsed = parseBackup(await file.text())
      if (!parsed.ok) {
        setMessage({ tone: 'bad', text: parsed.error })
        return
      }

      const [sessions, benchmarks, readiness] = await Promise.all([
        repositories.sessions.listRecent(100_000),
        repositories.benchmarks.list(),
        repositories.readiness.listRecent(100_000),
      ])
      const plan = planRestore(parsed.file, { sessions, benchmarks, readiness })

      if (
        plan.sessions.length === 0 &&
        plan.benchmarks.length === 0 &&
        plan.readiness.length === 0
      ) {
        setMessage({
          tone: 'ok',
          text: 'Nothing new in that file — everything in it is already here.',
        })
        return
      }

      const summary = `Add ${pluralize(plan.sessions.length, 'session')} and ${pluralize(
        plan.benchmarks.length,
        'benchmark',
      )}? Nothing already on this device is removed.`
      if (!window.confirm(summary)) return

      // Sequentially: the local adapter writes the whole collection on each
      // call, so racing them would have the last write win.
      for (const entry of plan.sessions) {
        await repositories.sessions.create(entry.input, entry.metrics)
      }
      for (const entry of plan.benchmarks) {
        await repositories.benchmarks.create(entry)
      }
      for (const entry of plan.readiness) {
        await repositories.readiness.save(entry)
      }

      await queryClient.invalidateQueries()
      setMessage({
        tone: 'ok',
        text: `Restored ${pluralize(plan.sessions.length, 'session')}${
          plan.skippedSessions > 0 ? `, skipped ${plan.skippedSessions} already here` : ''
        }.`,
      })
    } catch {
      setMessage({ tone: 'bad', text: 'Could not read that file.' })
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDriveDownload className="text-primary size-4" aria-hidden />
          Back up your training
        </CardTitle>
        <CardDescription>
          A single file with every session, effort rating, check-in and benchmark. Keep it somewhere
          safe and you can move to a new phone, or recover from clearing your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => void doExport()}
            disabled={busy !== null}
          >
            {busy === 'export' ? <Loader2 className="animate-spin" /> : <Download />}
            Export
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === 'import' ? <Loader2 className="animate-spin" /> : <Upload />}
            Import
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose a backup file to import"
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            if (chosen) void doImport(chosen)
          }}
        />

        {message && (
          <p
            role="status"
            className={`text-xs leading-relaxed ${
              message.tone === 'bad' ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {message.text}
          </p>
        )}

        <p className="text-muted-foreground text-xs leading-relaxed">
          Importing merges — sessions already on this device are kept, and anything the file
          duplicates is skipped, so importing the same backup twice is safe.
        </p>
      </CardContent>
    </Card>
  )
}
