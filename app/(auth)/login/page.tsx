import { signIn } from '@/lib/actions/auth'
import { IconShieldAlert } from '@/components/icons'

interface Props {
  searchParams: Promise<{ error?: string; redirectTo?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const errorMessage = params.error ? decodeURIComponent(params.error) : null

  return (
    <div className="w-full max-w-sm">
      {/* Logo / branding */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 mb-4">
          <IconShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">ProofPilot</h1>
        <p className="mt-1 text-sm text-slate-500">AI Review Intelligence Platform</p>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">Sign in to your account</h2>
        <p className="mb-5 text-xs text-slate-500">Enter your credentials to access the dashboard.</p>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
            <p className="text-xs text-red-400">{errorMessage}</p>
          </div>
        )}

        <form action={signIn} className="space-y-4">
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
              className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="text-xs font-medium text-slate-400">
                Password
              </label>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-colors duration-150"
          >
            Sign in
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-[11px] text-slate-600">
        Enterprise access only · Contact your administrator
      </p>
    </div>
  )
}
