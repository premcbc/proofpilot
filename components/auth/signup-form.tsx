'use client'

import { useActionState, useTransition } from 'react'
import Link from 'next/link'
import { signUpWithPassword, signInWithGoogle } from '@/lib/actions/auth'
import { IconShieldAlert } from '@/components/icons'
import { Spinner, GoogleIcon } from '@/components/auth/auth-shared'

export function SignupForm() {
  const [state, action, isPending] = useActionState(signUpWithPassword, null)
  const [isGooglePending, startGoogleTransition] = useTransition()

  const error = state && 'error' in state ? state.error : null
  const success = state && 'success' in state ? state.success : null
  const anyPending = isPending || isGooglePending

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      await signInWithGoogle()
    })
  }

  return (
    <div className="w-full max-w-sm">
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 mb-4">
          <IconShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">ProofPilot</h1>
        <p className="mt-1 text-sm text-slate-500">AI Review Intelligence Platform</p>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-sm">
        {success ? (
          /* Success state */
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
            <h2 className="mb-1 text-sm font-semibold text-slate-200">Create your account</h2>
            <p className="mb-5 text-xs text-slate-500">Set up your workspace to get started.</p>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={anyPending}
              className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-md border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150"
            >
              {isGooglePending ? <Spinner /> : <GoogleIcon />}
              Sign up with Google
            </button>

            {/* Divider */}
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-900 px-2 text-[11px] text-slate-600">or continue with email</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <form action={action} className="space-y-3.5">
              <div>
                <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Full name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  disabled={anyPending}
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  placeholder="Jane Smith"
                />
              </div>

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
                  disabled={anyPending}
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  placeholder="jane@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Password
                  <span className="ml-1 text-slate-600 font-normal">(min. 8 characters)</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={anyPending}
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="orgName" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Organization name
                </label>
                <input
                  id="orgName"
                  name="orgName"
                  type="text"
                  autoComplete="organization"
                  required
                  disabled={anyPending}
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  placeholder="Acme Corp"
                />
              </div>

              <button
                type="submit"
                disabled={anyPending}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-150"
              >
                {isPending && <Spinner />}
                {isPending ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Already have an account?{' '}
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

      <p className="mt-6 text-center text-[11px] text-slate-600">
        By creating an account you agree to our terms of service.
      </p>
    </div>
  )
}

