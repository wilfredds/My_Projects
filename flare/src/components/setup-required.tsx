/**
 * Shown when FLARE has no Firebase configuration.
 *
 * Without .env.local, almost every page throws while initializing Firebase and
 * the visitor gets a stack trace or a blank error. That is the first thing
 * anyone cloning this repository hits, and "Missing required environment
 * variable" tells them what broke without telling them what to do about it.
 *
 * This replaces that with the two commands that fix it.
 */
export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-5 px-6 py-16">
      <div>
        <p className="flare-label text-xs text-accent">FLARE</p>
        <h1 className="mt-1 text-2xl font-semibold">This copy isn&rsquo;t configured yet</h1>
      </div>

      <p className="text-muted">
        FLARE needs Firebase settings before it can run. Nothing is wrong with the code —
        the file that holds them, <code className="font-mono text-sm">.env.local</code>, is
        never committed, so a fresh clone has to create it.
      </p>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-semibold">Run this in the <code className="font-mono">flare</code> folder:</p>
        <pre className="overflow-x-auto rounded bg-background p-3 font-mono text-sm">
{`cp .env.emulator.example .env.local
npm install`}</pre>
        <p className="mt-3 text-sm text-muted">
          Then, in three terminals — all from <code className="font-mono">flare</code>:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-background p-3 font-mono text-sm">
{`npm run emulators
npm run seed
npm run dev`}</pre>
        <p className="mt-3 text-sm text-muted">
          Sign in as <span className="font-mono">admin@bfp.gov.ph</span> with the password{" "}
          <span className="font-mono">flare-emulator</span>. This needs Node 22+ and a JDK,
          because the Firebase emulators are Java programs.
        </p>
      </div>

      <details className="text-sm text-muted">
        <summary className="cursor-pointer">Which settings are missing</summary>
        <ul className="mt-2 list-inside list-disc font-mono text-xs">
          {missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </details>
    </main>
  );
}
