'use client'

import { useActionState } from 'react'
import { createOrgForUser } from '@/lib/actions/auth'
import { IconShieldAlert } from '@/components/icons'
import { Spinner } from '@/components/auth/auth-shared'

export function OnboardingForm() {
  const [state, action, isPending] = useActionState(createOrgForUser, null)

  const error = state && 'error' in state ? state.error : null

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
        <h2 className="mb-1 text-sm font-semibold text-slate-200">Set up your workspace</h2>
        <p className="mb-5 text-xs text-slate-500">
          Create your organization to get started with ProofPilot.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
            <p className="text-xs text-red-400">{error}</p>
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
              disabled={isPending}
              className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="Acme Corp"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-150"
          >
            {isPending && <Spinner />}
            {isPending ? 'Creating workspace…' : 'Create workspace'}
          </button>
        </form>
      </div>
    </div>
  )
}
