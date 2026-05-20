'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconSettings, IconShieldAlert, IconUsers, IconActivity, IconZap } from '@/components/icons'

const settingsSections = [
  {
    id: 'general',
    title: 'General',
    icon: <IconSettings className="w-4 h-4" />,
    bg: 'bg-slate-500/10',
    color: 'text-slate-400',
  },
  {
    id: 'fraud',
    title: 'Fraud & Detection',
    icon: <IconShieldAlert className="w-4 h-4" />,
    bg: 'bg-red-500/10',
    color: 'text-red-400',
  },
  {
    id: 'team',
    title: 'Team & Permissions',
    icon: <IconUsers className="w-4 h-4" />,
    bg: 'bg-indigo-500/10',
    color: 'text-indigo-400',
  },
  {
    id: 'webhooks',
    title: 'Webhooks & API',
    icon: <IconActivity className="w-4 h-4" />,
    bg: 'bg-violet-500/10',
    color: 'text-violet-400',
  },
  {
    id: 'ai',
    title: 'AI Model Config',
    icon: <IconZap className="w-4 h-4" />,
    bg: 'bg-amber-500/10',
    color: 'text-amber-400',
  },
]

function Toggle({ defaultEnabled = false }: { defaultEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(defaultEnabled)
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? 'Disable' : 'Enable'}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
        enabled ? 'bg-indigo-600' : 'bg-slate-700',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
          enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-800/60 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200">{label}</p>
        {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure ProofPilot for your organization</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Sidebar nav */}
        <div className="lg:col-span-1">
          <Card padding="sm">
            <nav className="space-y-0.5">
              {settingsSections.map((s) => {
                const active = s.id === activeSection
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={[
                      'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-left transition-colors',
                      active
                        ? 'bg-indigo-600/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70',
                    ].join(' ')}
                  >
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${s.bg} ${s.color}`}>
                      {s.icon}
                    </div>
                    {s.title}
                  </button>
                )
              })}
            </nav>
          </Card>
        </div>

        {/* Settings content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Organization */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-100 mb-4">Organization</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Organization Name</label>
                <input
                  defaultValue="ProofPilot Corp"
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-colors placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Workspace Slug</label>
                <div className="flex items-center rounded-md border border-slate-700 bg-slate-800/60 overflow-hidden">
                  <span className="px-3 py-2 text-sm text-slate-500 border-r border-slate-700 bg-slate-900/60">
                    app.proofpilot.ai/
                  </span>
                  <input
                    defaultValue="proofpilot-corp"
                    className="flex-1 px-3 py-2 text-sm text-slate-200 bg-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Contact Email</label>
                <input
                  defaultValue="premcbc23@gmail.com"
                  className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-slate-800/60">
              <Button variant="primary" size="sm">Save Changes</Button>
            </div>
          </Card>

          {/* Review Settings */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-100 mb-1">Review Settings</h3>
            <p className="text-xs text-slate-500 mb-4">Configure auto-approval, escalation, and SLA thresholds</p>
            <div>
              <SettingRow label="Auto-approve low-risk submissions" description="Automatically approve items with risk score below 15">
                <Toggle defaultEnabled />
              </SettingRow>
              <SettingRow label="Auto-reject critical fraud signals" description="Immediately reject items flagged with critical severity">
                <Toggle defaultEnabled />
              </SettingRow>
              <SettingRow label="AI-assisted pre-screening" description="Use AI model to pre-score all submissions before queue">
                <Toggle defaultEnabled />
              </SettingRow>
              <SettingRow label="SLA alert at 80% threshold" description="Notify team when approaching SLA deadline">
                <Toggle />
              </SettingRow>
              <SettingRow label="Require dual approval for escalations" description="Escalated items must be approved by 2 reviewers">
                <Toggle defaultEnabled />
              </SettingRow>
            </div>
          </Card>

          {/* API Keys */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">API Keys</h3>
                <p className="text-xs text-slate-500 mt-0.5">Manage your integration credentials</p>
              </div>
              <Button variant="secondary" size="sm">
                Generate Key
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Production Key', key: 'pp_live_8x7k...f4d2', created: 'Jan 15, 2026', last: '2m ago' },
                { name: 'Staging Key', key: 'pp_test_3m9p...a1c8', created: 'Feb 3, 2026', last: '1d ago' },
              ].map((k) => (
                <div key={k.name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <p className="text-xs font-medium text-slate-200">{k.name}</p>
                      <p className="font-mono text-[10px] text-slate-500 mt-0.5">{k.key}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] text-slate-500">Last used {k.last}</p>
                      <p className="text-[10px] text-slate-600">Created {k.created}</p>
                    </div>
                    <Badge variant="success" dot>Active</Badge>
                    <Button variant="ghost" size="sm">Revoke</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
