'use client'

import { useActionState, useEffect, useTransition } from 'react'
import { createOrgForUser, signOut, type OnboardingState } from '@/lib/actions/auth'
import { IconShieldAlert, IconLogOut } from '@/components/icons'
import { Spinner } from '@/components/auth/auth-shared'

export function OnboardingForm() {
  const [state, action, isPending] = useActionState<OnboardingState, FormData>(createOrgForUser, null)
  const [isSigningOut, startSignOut] = useTransition()

  // Derived — no separate state needed
  const isRedirecting = state?.status === 'success'

  // Log every state change so we can see what the action is returning
  useEffect(() => {
    console.log('[OnboardingForm] state updated:', JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (state?.status !== 'success') return

    console.log('[OnboardingForm] success — org_id:', state.orgId, '— starting redirect')

    // Hard navigation bypasses the Next.js router cache completely.
    // router.push('/') uses the cached (stale) router state and may redirect
    // back to /onboarding if the client cache still holds the pre-membership layout.
    // window.location.assign triggers a full page request, guaranteed to hit the
    // server fresh and see the new organization_members row.
    const timer = setTimeout(() => {
      console.log('[OnboardingForm] executing window.location.assign("/")')
      window.location.assign('/')
    }, 150)

    return () => clearTimeout(timer)
  }, [state])

  function handleSignOut() {
    startSignOut(async () => {
      await signOut()
    })
  }

  const error   = state?.status === 'error' ? state.error : null
  const disabled = isPending || isRedirecting || isSigningOut

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 mb-4">
          <IconShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">ProofPilot</h1>
        <p className="mt-1 text-sm text-slate-500">AI Review Intelligence Platform</p>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">Set up your workspace</h2>
        <p className="mb-5 text-xs text-slate-500">
          Create your organization to get started with ProofPilot.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {isRedirecting && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
            <p className="text-xs text-emerald-400">Workspace created — opening your dashboard…</p>
          </div>
        )}

        <form action={action} className="space-y-3.5">
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
              disabled={disabled}
              className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="Acme Corp"
            />
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-150"
          >
            {(isPending || isRedirecting) && <Spinner />}
            {isRedirecting
              ? 'Opening dashboard…'
              : isPending
              ? 'Creating workspace…'
              : 'Create workspace'}
          </button>
        </form>
      </div>

      {/* Escape hatch — always visible so a stuck user can get out */}
      <div className="mt-6 space-y-2 text-center">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut || isRedirecting}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50 transition-colors"
        >
          <IconLogOut className="w-3.5 h-3.5" />
          {isSigningOut ? 'Signing out…' : 'Sign out / use a different account'}
        </button>
      </div>
    </div>
  )
}
