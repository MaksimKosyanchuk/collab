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
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="panel p-5">
        <p className="brand text-lg text-ink">Collab Docs</p>
        <h1 className="mt-2 text-base font-semibold text-ink">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {next
            ? 'Continue to open the shared document.'
            : mode === 'login'
              ? 'Access your workspaces.'
              : 'Start a workspace in a minute.'}
        </p>

        <form action={formAction} className="mt-5 space-y-2.5">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {mode === 'register' ? (
            <label className="block space-y-1 text-[13px]">
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
          <label className="block space-y-1 text-[13px]">
            <span className="text-muted">Email</span>
            <input
              className="field"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
            />
          </label>
          <label className="block space-y-1 text-[13px]">
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

          <button className="btn btn-primary mt-1 w-full" disabled={pending}>
            {pending
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-muted">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <Link className="font-medium text-ink underline-offset-2 hover:underline" href={otherHref}>
                Register
              </Link>
            </>
          ) : (
            <>
              Already registered?{' '}
              <Link className="font-medium text-ink underline-offset-2 hover:underline" href={otherHref}>
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
