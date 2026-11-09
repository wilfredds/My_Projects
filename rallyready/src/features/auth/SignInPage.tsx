import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { useAuth } from '@/lib/auth/context'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup'

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = true,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
      </Label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'border-input bg-background focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base',
          'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:outline-none',
        )}
      />
    </div>
  )
}

export function SignInPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  if (auth.status === 'signed-in') return <Navigate to="/profile" replace />

  if (auth.status === 'unavailable') {
    return (
      <div className="mx-auto max-w-md py-10">
        <Card>
          <CardContent className="space-y-4 p-6">
            {/* A player reads this, not a developer. How to switch accounts
                on — the two environment variables — is in the README. */}
            <h1 className="text-xl font-semibold">Accounts are not switched on yet</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              There is nothing to sign in to yet. Everything still works. Your sessions, streaks and
              badges are saved on this phone.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To keep a copy somewhere safe, use <strong>Back up your training</strong> on the
              Profile screen.
            </p>
            <Button asChild>
              <Link to="/">Back to Train</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const ok =
      mode === 'signin'
        ? await auth.signInWithPassword(email, password)
        : await auth.signUpWithPassword(
            email,
            password,
            displayName || email.split('@')[0] || 'Player',
          )
    if (ok) navigate('/onboarding', { replace: true })
  }

  return (
    <div className="mx-auto max-w-md">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
        <Link to="/">
          <ArrowLeft />
          Train
        </Link>
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">
        {mode === 'signin' ? 'Welcome back' : 'Create an account'}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        An account syncs your sessions across devices. Everything you have already logged on this
        device comes with you.
      </p>

      <div className="mt-6">
        <Segmented
          label="Sign in or create an account"
          value={mode}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create account' },
          ]}
          onChange={(next) => {
            setMode(next as Mode)
            auth.clearError()
          }}
        />
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === 'signup' && (
          <Field
            id="name"
            label="Display name"
            type="text"
            value={displayName}
            onChange={setDisplayName}
            autoComplete="name"
            placeholder="How should we greet you?"
            required={false}
          />
        )}
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
        />

        {auth.error && (
          <p
            role="alert"
            className="text-destructive flex items-start gap-2 text-sm leading-relaxed"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {auth.error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={auth.busy}>
          {auth.busy && <Loader2 className="animate-spin" />}
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => void auth.signInWithGoogle()}
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
        You never have to sign in. RallyReady works fully offline without an account — signing in
        only adds sync.
      </p>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4h6.6c-.1 1.1-.9 2.8-2.5 3.9l-.02.15 3.6 2.8.25.03c2.3-2.1 3.6-5.2 3.6-8.7Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.3 0 6-1.1 8-3l-3.8-3c-1 .7-2.4 1.2-4.2 1.2a7.3 7.3 0 0 1-6.9-5l-.14.01-3.7 2.9-.05.14A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.3a7.4 7.4 0 0 1 0-4.6l-.01-.16-3.75-2.9-.12.06a12 12 0 0 0 0 10.8l3.9-3Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2.3 0 3.9 1 4.8 1.8l3.5-3.4A12 12 0 0 0 12 0 12 12 0 0 0 1.2 6.7l3.9 3A7.3 7.3 0 0 1 12 4.7Z"
      />
    </svg>
  )
}
