'use client'

import { useState, useCallback, useActionState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  IconSettings, IconShieldAlert, IconUsers, IconActivity, IconZap,
  IconCheck, IconCopy, IconLink, IconX, IconPlus, IconRefresh, IconUser,
} from '@/components/icons'
import { updateProfile, changePassword } from '@/lib/actions/auth'
import { Spinner } from '@/components/auth/auth-shared'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved'
type SectionId = 'general' | 'fraud' | 'team' | 'webhooks' | 'ai' | 'account'

// ─── Static data ─────────────────────────────────────────────────────────────

const SECTIONS: { id: SectionId; title: string; icon: React.ReactNode; bg: string; color: string }[] = [
  { id: 'general',  title: 'General',            icon: <IconSettings className="w-4 h-4" />,     bg: 'bg-slate-500/10',  color: 'text-slate-400'  },
  { id: 'fraud',    title: 'Fraud & Detection',   icon: <IconShieldAlert className="w-4 h-4" />,  bg: 'bg-red-500/10',    color: 'text-red-400'    },
  { id: 'team',     title: 'Team & Permissions',  icon: <IconUsers className="w-4 h-4" />,        bg: 'bg-indigo-500/10', color: 'text-indigo-400' },
  { id: 'webhooks', title: 'Webhooks & API',      icon: <IconActivity className="w-4 h-4" />,     bg: 'bg-violet-500/10', color: 'text-violet-400' },
  { id: 'ai',       title: 'AI Model Config',     icon: <IconZap className="w-4 h-4" />,          bg: 'bg-amber-500/10',  color: 'text-amber-400'  },
  { id: 'account',  title: 'My Account',          icon: <IconUser className="w-4 h-4" />,         bg: 'bg-emerald-500/10',color: 'text-emerald-400'},
]

const PERMISSION_MATRIX = [
  { action: 'View reviews',          admin: true,  manager: true,  reviewer: true,  viewer: true  },
  { action: 'Approve / Reject',      admin: true,  manager: true,  reviewer: true,  viewer: false },
  { action: 'Export data',           admin: true,  manager: true,  reviewer: false, viewer: false },
  { action: 'Manage team',           admin: true,  manager: false, reviewer: false, viewer: false },
  { action: 'Configure settings',    admin: true,  manager: false, reviewer: false, viewer: false },
  { action: 'Fraud rule editing',    admin: true,  manager: true,  reviewer: false, viewer: false },
  { action: 'API key management',    admin: true,  manager: false, reviewer: false, viewer: false },
  { action: 'Audit log access',      admin: true,  manager: true,  reviewer: false, viewer: false },
]

const WEBHOOK_LIST = [
  { id: 1, name: 'Production Endpoint', url: 'https://api.yourapp.com/webhooks/pp',      events: 4, enabled: true,  lastDelivery: '2m ago', status: 'success' as const },
  { id: 2, name: 'Staging Endpoint',    url: 'https://staging.yourapp.com/pp-hook',      events: 2, enabled: true,  lastDelivery: '1h ago', status: 'success' as const },
  { id: 3, name: 'Slack Alerting',      url: 'https://hooks.slack.com/services/T0…XYZ',  events: 1, enabled: false, lastDelivery: '3d ago', status: 'failed'  as const },
]

const WEBHOOK_EVENTS = [
  { id: 'review.approved',  desc: 'Fired when a reviewer approves a submission'      },
  { id: 'review.rejected',  desc: 'Fired when a submission is rejected'              },
  { id: 'review.escalated', desc: 'Fired when a review is escalated'                 },
  { id: 'fraud.detected',   desc: 'Fired when critical fraud signals are found'      },
  { id: 'fraud.cleared',    desc: 'Fired when a fraud alert is dismissed'            },
  { id: 'member.invited',   desc: 'Fired when a new member is invited to workspace'  },
]

const SIGNAL_WEIGHTS = [
  { label: 'OCR Confidence',      defaultVal: 85, color: 'bg-indigo-500' },
  { label: 'Fraud Score',         defaultVal: 90, color: 'bg-red-500'    },
  { label: 'Document Similarity', defaultVal: 70, color: 'bg-violet-500' },
  { label: 'Behavioral Pattern',  defaultVal: 60, color: 'bg-amber-500'  },
  { label: 'Merchant Risk Score', defaultVal: 75, color: 'bg-emerald-500'},
]

// ─── Shared primitives ────────────────────────────────────────────────────────

function Toggle({ defaultEnabled = false }: { defaultEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(defaultEnabled)
  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? 'Disable' : 'Enable'}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200',
        enabled ? 'bg-indigo-600' : 'bg-slate-700',
      ].join(' ')}
    >
      <span className={[
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
        enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
      ].join(' ')} />
    </button>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
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

function useSaveState() {
  const [state, setState] = useState<SaveState>('idle')
  const save = useCallback(() => {
    setState('saving')
    setTimeout(() => {
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    }, 700)
  }, [])
  const reset = useCallback(() => setState('idle'), [])
  return { state, save, reset }
}

function SaveBar({ state, onSave, onReset }: { state: SaveState; onSave: () => void; onReset?: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-800/60">
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset}>Reset</Button>
      )}
      <Button variant="primary" size="sm" onClick={onSave} disabled={state === 'saving'}>
        {state === 'saving' && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            className="inline-flex"
          >
            <IconRefresh className="w-3 h-3" />
          </motion.span>
        )}
        {state === 'saved' && <IconCheck className="w-3 h-3" />}
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save Changes'}
      </Button>
    </div>
  )
}

const INPUT_CLS = 'w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-colors placeholder:text-slate-600'
const SELECT_CLS = 'rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/60 transition-colors'
const THRESHOLD_INPUT_CLS = 'w-16 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/60 text-center'

// ─── Section: General ─────────────────────────────────────────────────────────

function GeneralSection() {
  const org = useSaveState()
  const review = useSaveState()

  return (
    <div className="space-y-4">
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-4">Organization</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Organization Name</label>
            <input defaultValue="ProofPilot Corp" className={INPUT_CLS} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Workspace Slug</label>
            <div className="flex items-center rounded-md border border-slate-700 bg-slate-800/60 overflow-hidden">
              <span className="px-3 py-2 text-sm text-slate-500 border-r border-slate-700 bg-slate-900/60 shrink-0">
                app.proofpilot.ai/
              </span>
              <input defaultValue="proofpilot-corp" className="flex-1 px-3 py-2 text-sm text-slate-200 bg-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Contact Email</label>
            <input defaultValue="premcbc23@gmail.com" className={INPUT_CLS} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Timezone</label>
            <select defaultValue="UTC+05:30" className={`${SELECT_CLS} w-full`}>
              <option value="UTC+00:00">UTC+00:00 — London</option>
              <option value="UTC-05:00">UTC-05:00 — New York</option>
              <option value="UTC-08:00">UTC-08:00 — Los Angeles</option>
              <option value="UTC+05:30">UTC+05:30 — Mumbai</option>
            </select>
          </div>
        </div>
        <SaveBar state={org.state} onSave={org.save} onReset={org.reset} />
      </Card>

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
        <SaveBar state={review.state} onSave={review.save} />
      </Card>

      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">API Keys</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage your integration credentials</p>
          </div>
          <Button variant="secondary" size="sm"><IconPlus className="w-3 h-3" />Generate Key</Button>
        </div>
        <div className="space-y-2">
          {[
            { name: 'Production Key', key: 'pp_live_8x7k…f4d2', created: 'Jan 15, 2026', last: '2m ago' },
            { name: 'Staging Key',    key: 'pp_test_3m9p…a1c8', created: 'Feb 3, 2026',  last: '1d ago' },
          ].map((k) => (
            <div key={k.name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-slate-200">{k.name}</p>
                <p className="font-mono text-[10px] text-slate-500 mt-0.5">{k.key}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:block text-right">
                  <p className="text-[10px] text-slate-500">Last used {k.last}</p>
                  <p className="text-[10px] text-slate-600">Created {k.created}</p>
                </div>
                <Badge variant="success" dot>Active</Badge>
                <Button variant="ghost" size="sm" ariaLabel="Copy key"><IconCopy className="w-3 h-3" /></Button>
                <Button variant="danger" size="sm">Revoke</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Section: Fraud & Detection ───────────────────────────────────────────────

function FraudSection() {
  const thresholds = useSaveState()
  const modules = useSaveState()
  const [low,  setLow]  = useState(20)
  const [med,  setMed]  = useState(50)
  const [high, setHigh] = useState(75)

  return (
    <div className="space-y-4">
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Risk Score Thresholds</h3>
        <p className="text-xs text-slate-500 mb-4">Define the score ranges that trigger each review action</p>
        <div
          className="relative h-3 rounded-full overflow-hidden mb-5"
          style={{ background: 'linear-gradient(to right, #10b981, #f59e0b, #f97316, #ef4444)' }}
        >
          {[low, med, high].map((v, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-0.5 bg-slate-950/60" style={{ left: `${v}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { label: 'Auto-Approve below', value: low,  setter: setLow,  badge: 'success' as const },
            { label: 'Manual review above', value: med, setter: setMed,  badge: 'warning' as const },
            { label: 'Auto-Reject above',  value: high, setter: setHigh, badge: 'danger'  as const },
          ] as const).map(({ label, value, setter, badge }) => (
            <div key={label}>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100}
                  value={value}
                  onChange={e => setter(Number(e.target.value))}
                  className={THRESHOLD_INPUT_CLS}
                />
                <Badge variant={badge}>{value}</Badge>
              </div>
            </div>
          ))}
        </div>
        <SaveBar state={thresholds.state} onSave={thresholds.save} onReset={thresholds.reset} />
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Detection Modules</h3>
        <p className="text-xs text-slate-500 mb-4">Enable or disable individual fraud detection engines</p>
        <div>
          <SettingRow label="OCR Validation" description="Extract and verify text from uploaded images and PDFs">
            <Toggle defaultEnabled />
          </SettingRow>
          <SettingRow label="Receipt Pattern Analysis" description="Detect forged or manipulated receipt structures">
            <Toggle defaultEnabled />
          </SettingRow>
          <SettingRow label="Velocity Checks" description="Flag users submitting unusually high claim volumes">
            <Toggle defaultEnabled />
          </SettingRow>
          <SettingRow label="Merchant Blacklist" description="Cross-reference submissions against known bad merchants">
            <Toggle defaultEnabled />
          </SettingRow>
          <SettingRow label="Geolocation Anomaly" description="Detect submissions from unexpected geographic regions">
            <Toggle />
          </SettingRow>
          <SettingRow label="Duplicate Submission Detection" description="Hash-match to catch identical or near-identical receipts">
            <Toggle defaultEnabled />
          </SettingRow>
        </div>
        <SaveBar state={modules.state} onSave={modules.save} />
      </Card>

      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Blocklist Management</h3>
            <p className="text-xs text-slate-500 mt-0.5">Merchants, patterns, and identifiers to always reject</p>
          </div>
          <Button variant="secondary" size="sm">Manage Blocklist</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Blocked Merchants',    value: '847',   sub: '+12 this week'        },
            { label: 'Blocked Patterns',     value: '214',   sub: '6 custom rules'       },
            { label: 'Blocked Identifiers',  value: '1,203', sub: 'IPs, devices & users' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5">
              <p className="text-lg font-bold text-slate-100">{value}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">{label}</p>
              <p className="text-[10px] text-slate-500">{sub}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Section: Team & Permissions ──────────────────────────────────────────────

function TeamSection() {
  const security = useSaveState()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Reviewer')

  return (
    <div className="space-y-4">
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Role Permissions Matrix</h3>
        <p className="text-xs text-slate-500 mb-4">Permissions granted to each role across the platform</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left pb-2.5 pr-4 text-slate-500 font-semibold">Action</th>
                {['Admin', 'Manager', 'Reviewer', 'Viewer'].map(r => (
                  <th key={r} className="pb-2.5 text-slate-400 font-semibold text-center w-20">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.action}>
                  <td className="py-2.5 pr-4 text-slate-400">{row.action}</td>
                  {([row.admin, row.manager, row.reviewer, row.viewer] as boolean[]).map((has, i) => (
                    <td key={i} className="py-2.5 text-center">
                      {has
                        ? <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-500/15 text-indigo-400"><IconCheck className="w-3 h-3" /></span>
                        : <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-800 mx-auto" />
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-4">Invite Team Member</h3>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className={`flex-1 ${INPUT_CLS}`}
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className={SELECT_CLS}
          >
            {['Admin', 'Manager', 'Reviewer', 'Viewer'].map(r => <option key={r}>{r}</option>)}
          </select>
          <Button variant="primary" size="sm" disabled={!inviteEmail}>
            <IconPlus className="w-3 h-3" />Send Invite
          </Button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Invitee will receive an email to join your ProofPilot workspace.</p>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Access & Security</h3>
        <p className="text-xs text-slate-500 mb-4">Authentication and session policies for your workspace</p>
        <div>
          <SettingRow label="Single Sign-On (SSO)" description="Require SAML 2.0 or OIDC identity provider for login">
            <Toggle />
          </SettingRow>
          <SettingRow label="Enforce 2FA for all members" description="Multi-factor authentication required on every login">
            <Toggle defaultEnabled />
          </SettingRow>
          <SettingRow label="Audit log retention (90 days)" description="Keep detailed access and action logs for compliance">
            <Toggle defaultEnabled />
          </SettingRow>
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Session Timeout</label>
          <select defaultValue="8h" className={SELECT_CLS}>
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
            <option value="8h">8 hours</option>
            <option value="24h">24 hours</option>
          </select>
        </div>
        <SaveBar state={security.state} onSave={security.save} />
      </Card>
    </div>
  )
}

// ─── Section: Webhooks & API ──────────────────────────────────────────────────

function WebhooksSection() {
  const [copied, setCopied] = useState(false)

  function copyUrl() {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Webhook Endpoints</h3>
            <p className="text-xs text-slate-500 mt-0.5">HTTP callbacks for real-time event delivery</p>
          </div>
          <Button variant="secondary" size="sm"><IconPlus className="w-3 h-3" />Add Endpoint</Button>
        </div>
        <div className="space-y-2">
          {WEBHOOK_LIST.map((ep) => (
            <div key={ep.id} className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-medium text-slate-200">{ep.name}</p>
                    <Badge variant={ep.status === 'success' ? 'success' : 'danger'} dot>
                      {ep.status === 'success' ? 'Delivering' : 'Failing'}
                    </Badge>
                  </div>
                  <p className="font-mono text-[10px] text-slate-500 truncate max-w-xs">{ep.url}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {ep.events} events subscribed · Last delivery {ep.lastDelivery}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Toggle defaultEnabled={ep.enabled} />
                  <Button variant="ghost" size="sm">Test</Button>
                  <Button variant="ghost" size="sm" ariaLabel="Remove endpoint"><IconX className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Event Subscriptions</h3>
        <p className="text-xs text-slate-500 mb-4">Choose which events trigger webhook deliveries</p>
        <div className="space-y-3">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                defaultChecked={ev.id !== 'member.invited'}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-600 bg-slate-800 accent-indigo-600"
              />
              <div>
                <p className="font-mono text-xs text-slate-300 group-hover:text-slate-200 transition-colors">{ev.id}</p>
                <p className="text-[11px] text-slate-500">{ev.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-4">API Configuration</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Base URL</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 gap-2 min-w-0">
                <IconLink className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="font-mono text-xs text-slate-400 truncate">https://api.proofpilot.ai/v2</span>
              </div>
              <Button variant="ghost" size="sm" onClick={copyUrl} ariaLabel="Copy URL">
                {copied ? <IconCheck className="w-3 h-3" /> : <IconCopy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rate Limit',  value: '1,000 req/min' },
              { label: 'Burst Limit', value: '200 req/10s'   },
              { label: 'API Version', value: 'v2.4.1'        },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
                <p className="text-sm font-mono text-slate-300 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Section: AI Model Config ─────────────────────────────────────────────────

function AiSection() {
  const config = useSaveState()
  const [approveAt,  setApproveAt]  = useState(82)
  const [escalateAt, setEscalateAt] = useState(45)
  const [model, setModel] = useState('claude-3-5')
  const [weights, setWeights] = useState(SIGNAL_WEIGHTS.map(s => s.defaultVal))

  function setWeight(i: number, v: number) {
    setWeights(prev => { const next = [...prev]; next[i] = v; return next })
  }

  return (
    <div className="space-y-4">
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Confidence Thresholds</h3>
        <p className="text-xs text-slate-500 mb-4">AI confidence levels that drive automated decisions</p>
        <div
          className="relative h-3 rounded-full overflow-hidden mb-5"
          style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #10b981)' }}
        >
          {[escalateAt, approveAt].map((v, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-0.5 bg-slate-950/70" style={{ left: `${v}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">Escalate below</label>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="number" min={0} max={100}
                value={escalateAt}
                onChange={e => setEscalateAt(Number(e.target.value))}
                className={THRESHOLD_INPUT_CLS}
              />
              <span className="text-xs text-slate-500">% confidence</span>
            </div>
            <p className="text-[11px] text-slate-500">Routes to human review queue</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">Auto-approve above</label>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="number" min={0} max={100}
                value={approveAt}
                onChange={e => setApproveAt(Number(e.target.value))}
                className={THRESHOLD_INPUT_CLS}
              />
              <span className="text-xs text-slate-500">% confidence</span>
            </div>
            <p className="text-[11px] text-slate-500">~68% of queue auto-resolved</p>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Model Selection</h3>
        <p className="text-xs text-slate-500 mb-4">Choose the AI model powering the fraud detection pipeline</p>
        <div className="space-y-2">
          {[
            { id: 'claude-3-5', label: 'Claude 3.5 Sonnet',  desc: 'Best accuracy — recommended for production',        badge: 'Recommended' },
            { id: 'claude-3-7', label: 'Claude 3.7 Sonnet',  desc: 'Faster inference, slightly lower accuracy',          badge: null           },
            { id: 'gpt-4o',     label: 'GPT-4o',             desc: 'Strong alternative with broad document support',     badge: null           },
            { id: 'custom',     label: 'Custom Endpoint',    desc: 'Route to your own fine-tuned or self-hosted model',  badge: null           },
          ].map(({ id, label, desc, badge }) => (
            <label
              key={id}
              className={[
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                model === id
                  ? 'border-indigo-500/40 bg-indigo-500/5'
                  : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700',
              ].join(' ')}
            >
              <input
                type="radio"
                name="model"
                value={id}
                checked={model === id}
                onChange={() => setModel(id)}
                className="accent-indigo-600 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-200">{label}</span>
                  {badge && <Badge variant="info">{badge}</Badge>}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Signal Weights</h3>
        <p className="text-xs text-slate-500 mb-4">Adjust the relative importance of each fraud signal in the composite score</p>
        <div className="space-y-4">
          {SIGNAL_WEIGHTS.map(({ label, color }, i) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300">{label}</span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">{weights[i]}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-75`}
                    style={{ width: `${weights[i]}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0} max={100}
                  value={weights[i]}
                  onChange={e => setWeight(i, Number(e.target.value))}
                  className="w-24 accent-indigo-600"
                />
              </div>
            </div>
          ))}
        </div>
        <SaveBar state={config.state} onSave={config.save} onReset={config.reset} />
      </Card>
    </div>
  )
}

// ─── Section: My Account ─────────────────────────────────────────────────────

function AccountSection() {
  const [profileState, profileAction, isProfilePending] = useActionState(updateProfile, null)
  const [passwordState, passwordAction, isPasswordPending] = useActionState(changePassword, null)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setProfileLoaded(true)
        return
      }
      supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const p = data as { id: string; full_name: string | null; email: string; avatar_url: string | null } | null
          setDisplayName(p?.full_name ?? '')
          setEmail(p?.email ?? user.email ?? '')
          setProfileLoaded(true)
        })
    })
  }, [])

  const profileError   = profileState && 'error'   in profileState ? profileState.error   : null
  const profileSuccess = profileState && 'success' in profileState ? profileState.success : null
  const passwordError   = passwordState && 'error'   in passwordState ? passwordState.error   : null
  const passwordSuccess = passwordState && 'success' in passwordState ? passwordState.success : null

  return (
    <div className="space-y-4">
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Profile</h3>
        <p className="text-xs text-slate-500 mb-4">Update your display name shown across the platform.</p>

        {profileError && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
            <p className="text-xs text-red-400">{profileError}</p>
          </div>
        )}
        {profileSuccess && (
          <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
            <p className="text-xs text-emerald-400">{profileSuccess}</p>
          </div>
        )}

        <form action={profileAction} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Display name</label>
            <input
              name="displayName"
              type="text"
              required
              disabled={isProfilePending || !profileLoaded}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              disabled
              readOnly
              className={`${INPUT_CLS} opacity-50 cursor-not-allowed`}
            />
            <p className="mt-1 text-[11px] text-slate-500">Email changes require contacting support.</p>
          </div>
          <div className="flex justify-end pt-1">
            <Button variant="primary" size="sm" type="submit" disabled={isProfilePending || !profileLoaded}>
              {isProfilePending && <Spinner />}
              {isProfilePending ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Change password</h3>
        <p className="text-xs text-slate-500 mb-4">Choose a new password for your account.</p>

        {passwordError && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
            <p className="text-xs text-red-400">{passwordError}</p>
          </div>
        )}
        {passwordSuccess && (
          <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
            <p className="text-xs text-emerald-400">{passwordSuccess}</p>
          </div>
        )}

        <form action={passwordAction} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">
              New password
              <span className="ml-1 text-slate-600 font-normal">(min. 8 characters)</span>
            </label>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={isPasswordPending}
              placeholder="••••••••"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Confirm new password</label>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={isPasswordPending}
              placeholder="••••••••"
              className={INPUT_CLS}
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button variant="primary" size="sm" type="submit" disabled={isPasswordPending}>
              {isPasswordPending && <Spinner />}
              {isPasswordPending ? 'Updating…' : 'Change password'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function renderSection(id: SectionId) {
  switch (id) {
    case 'general':  return <GeneralSection />
    case 'fraud':    return <FraudSection />
    case 'team':     return <TeamSection />
    case 'webhooks': return <WebhooksSection />
    case 'ai':       return <AiSection />
    case 'account':  return <AccountSection />
  }
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('general')

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure ProofPilot for your organization</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card padding="sm">
            <nav className="space-y-0.5">
              {SECTIONS.map((s) => {
                const active = s.id === activeSection
                return (
                  <button
                    key={s.id}
                    type="button"
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

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              {renderSection(activeSection)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
