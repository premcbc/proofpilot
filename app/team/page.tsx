'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconUsers, IconPlus, IconMoreHorizontal } from '@/components/icons'
import {
  TABLE_ACTION_REVEAL,
  TABLE_SCROLL_WRAPPER,
  THEAD_STICKY,
  THEAD_ROW_BG,
  SortableHeader,
  TableEmptyState,
  useSortable,
} from '@/components/ui/table'

const members = [
  {
    name: 'Prem Chandar',
    email: 'premcbc23@gmail.com',
    role: 'Admin',
    status: 'Active',
    reviews: 1204,
    approvals: 1148,
    joined: 'Jan 2026',
    initials: 'PC',
    color: 'from-violet-500 to-indigo-600',
  },
  {
    name: 'Sarah Chen',
    email: 'schen@proofpilot.ai',
    role: 'Senior Reviewer',
    status: 'Active',
    reviews: 3821,
    approvals: 3609,
    joined: 'Nov 2025',
    initials: 'SC',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    name: 'Marcus Webb',
    email: 'mwebb@proofpilot.ai',
    role: 'Reviewer',
    status: 'Active',
    reviews: 2134,
    approvals: 2019,
    joined: 'Jan 2026',
    initials: 'MW',
    color: 'from-slate-500 to-slate-600',
  },
  {
    name: 'Priya Nair',
    email: 'pnair@proofpilot.ai',
    role: 'Reviewer',
    status: 'Active',
    reviews: 1892,
    approvals: 1801,
    joined: 'Feb 2026',
    initials: 'PN',
    color: 'from-purple-500 to-violet-600',
  },
  {
    name: 'James Okafor',
    email: 'jokafor@proofpilot.ai',
    role: 'Reviewer',
    status: 'On leave',
    reviews: 987,
    approvals: 934,
    joined: 'Mar 2026',
    initials: 'JO',
    color: 'from-amber-500 to-orange-600',
  },
  {
    name: 'Ana Kovač',
    email: 'akovac@proofpilot.ai',
    role: 'Analyst',
    status: 'Active',
    reviews: 412,
    approvals: 390,
    joined: 'Apr 2026',
    initials: 'AK',
    color: 'from-pink-500 to-rose-600',
  },
]

// Pre-compute accuracy for sort — defined at module level for stable reference.
const membersEnhanced = members.map((m) => ({
  ...m,
  accuracyNum: m.approvals / m.reviews,
}))

const roleConfig: Record<string, string> = {
  Admin: 'info',
  'Senior Reviewer': 'success',
  Reviewer: 'default',
  Analyst: 'warning',
}

export default function TeamPage() {
  const { sorted: sortedMembers, sortKey, sortDir, onSort } = useSortable(membersEnhanced)

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage reviewers, roles, and performance</p>
        </div>
        <Button variant="primary" size="md">
          <IconPlus className="w-4 h-4" />
          Invite Member
        </Button>
      </div>

      {/* Team stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Members', value: '6' },
          { label: 'Active Now', value: '4' },
          { label: 'Reviews Today', value: '312' },
          { label: 'Team Accuracy', value: '94.8%' },
        ].map((s) => (
          <Card key={s.label} padding="md">
            <p className="text-xl font-bold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Members table */}
      <Card padding="none">
        <div className="p-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <IconUsers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Team Members</h3>
              <p className="text-xs text-slate-500 mt-0.5">{members.length} members</p>
            </div>
          </div>
        </div>
        <div className={TABLE_SCROLL_WRAPPER}>
          <table className="w-full text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={`border-b border-slate-800/60 ${THEAD_ROW_BG}`}>
                <SortableHeader sortKey="name" activeKey={sortKey} direction={sortDir} onSort={onSort}>
                  Member
                </SortableHeader>
                <SortableHeader sortKey="role" activeKey={sortKey} direction={sortDir} onSort={onSort}>
                  Role
                </SortableHeader>
                <SortableHeader
                  sortKey="status"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  className="hidden sm:table-cell"
                >
                  Status
                </SortableHeader>
                <SortableHeader
                  sortKey="reviews"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  className="hidden md:table-cell"
                >
                  Reviews
                </SortableHeader>
                <SortableHeader
                  sortKey="accuracyNum"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  className="hidden lg:table-cell"
                >
                  Accuracy
                </SortableHeader>
                <SortableHeader
                  sortKey="joined"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  className="hidden lg:table-cell"
                >
                  Joined
                </SortableHeader>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {sortedMembers.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  icon={<IconUsers className="w-5 h-5" />}
                  title="No team members found"
                  description="Invite your first team member to get started."
                  action={
                    <Button variant="secondary" size="sm">
                      <IconPlus className="w-3.5 h-3.5" />
                      Invite Member
                    </Button>
                  }
                />
              ) : (
                sortedMembers.map((m) => {
                  const accuracy = ((m.approvals / m.reviews) * 100).toFixed(1) + '%'
                  return (
                    <tr
                      key={m.email}
                      className="group hover:bg-slate-800/40 transition-colors duration-200 ease-out"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${m.color} text-[10px] font-semibold text-white`}
                          >
                            {m.initials}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-200">{m.name}</p>
                            <p className="text-[10px] text-slate-500 hidden sm:block">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={roleConfig[m.role] as 'info' | 'success' | 'default' | 'warning'}>
                          {m.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant={m.status === 'Active' ? 'success' : 'muted'} dot>
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300 hidden md:table-cell">
                        {m.reviews.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-300 hidden lg:table-cell">
                        {accuracy}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                        {m.joined}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex justify-end ${TABLE_ACTION_REVEAL}`}>
                          <Button variant="ghost" size="sm" ariaLabel="Member options">
                            <IconMoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
