'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, registerAction } from '@/lib/actions';

type AuthState = { error?: string } | undefined;

export function AuthForm({
  mode,
  next,
}: {
  mode: 'login' | 'register';
  next?: string | null;
}) {
  const action = mode === 'login' ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthState, formData: FormData) => action(formData),
    undefined as AuthState,
  );
  const otherHref = next
    ? `${mode === 'login' ? '/register' : '/login'}?next=${encodeURIComponent(next)}`
    : mode === 'login'
      ? '/register'
      : '/login';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="panel rounded-[1.5rem] p-8">
        <p className="brand text-3xl text-ink">Collab Docs</p>
        <h1 className="mt-3 text-xl font-semibold text-ink">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {next
            ? 'Sign in to open the shared document.'
            : mode === 'login'
              ? 'Sign in to continue to your workspaces.'
              : 'Start a workspace and invite collaborators later.'}
        </p>

        <form action={formAction} className="mt-8 space-y-3">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {mode === 'register' ? (
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">Display name</span>
              <input
                className="field"
                name="displayName"
                required
                minLength={2}
                maxLength={40}
                placeholder="Ada Lovelace"
              />
            </label>
          ) : null}
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Email</span>
            <input
              className="field"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Password</span>
            <input
              className="field"
              type="password"
              name="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </label>

          {state?.error ? <p className="error">{state.error}</p> : null}

          <button className="btn btn-primary mt-2 w-full" disabled={pending}>
            {pending
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <Link className="font-semibold text-accent" href={otherHref}>
                Register
              </Link>
            </>
          ) : (
            <>
              Already registered?{' '}
              <Link className="font-semibold text-accent" href={otherHref}>
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
