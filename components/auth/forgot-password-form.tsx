'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/lib/actions/auth'
import { IconShieldAlert } from '@/components/icons'
import { Spinner } from '@/components/auth/auth-shared'

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState(requestPasswordReset, null)

  const error = state && 'error' in state ? state.error : null
  const success = state && 'success' in state ? state.success : null

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 mb-4">
          <IconShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">ProofPilot</h1>
        <p className="mt-1 text-sm text-slate-500">AI Review Intelligence Platform</p>
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-sm">
        {success ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-2 text-sm font-semibold text-slate-200">Check your email</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{success}</p>
            <Link
              href="/login"
              className="mt-5 inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-sm font-semibold text-slate-200">Reset your password</h2>
            <p className="mb-5 text-xs text-slate-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <form action={action} className="space-y-3.5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isPending}
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  placeholder="you@company.com"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-150"
              >
                {isPending && <Spinner />}
                {isPending ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Remember your password?{' '}
              <Link
                href="/login"
                className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
