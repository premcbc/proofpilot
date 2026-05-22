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
import type { TeamMember, TeamStats } from '@/lib/queries/team'

const roleConfig: Record<string, string> = {
  Admin: 'info',
  Manager: 'info',
  'Senior Reviewer': 'success',
  Reviewer: 'default',
  Analyst: 'warning',
  Viewer: 'muted',
}

interface Props {
  initialMembers: TeamMember[]
  stats: TeamStats
}

export default function TeamPageClient({ initialMembers, stats }: Props) {
  const { sorted: sortedMembers, sortKey, sortDir, onSort } = useSortable(initialMembers)

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Members', value: stats.totalMembers.toString() },
          { label: 'Active Now', value: stats.activeNow.toString() },
          { label: 'Reviews Today', value: stats.reviewsToday.toString() },
          {
            label: 'Team Accuracy',
            value: stats.teamAccuracy > 0 ? stats.teamAccuracy.toFixed(1) + '%' : '—',
          },
        ].map((s) => (
          <Card key={s.label} padding="md">
            <p className="text-xl font-bold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <IconUsers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Team Members</h3>
              <p className="text-xs text-slate-500 mt-0.5">{initialMembers.length} members</p>
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
                <SortableHeader sortKey="status" activeKey={sortKey} direction={sortDir} onSort={onSort} className="hidden sm:table-cell">
                  Status
                </SortableHeader>
                <SortableHeader sortKey="reviews" activeKey={sortKey} direction={sortDir} onSort={onSort} className="hidden md:table-cell">
                  Reviews
                </SortableHeader>
                <SortableHeader sortKey="accuracyNum" activeKey={sortKey} direction={sortDir} onSort={onSort} className="hidden lg:table-cell">
                  Accuracy
                </SortableHeader>
                <SortableHeader sortKey="joined" activeKey={sortKey} direction={sortDir} onSort={onSort} className="hidden lg:table-cell">
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
                  const accuracy = m.reviews > 0
                    ? ((m.approvals / m.reviews) * 100).toFixed(1) + '%'
                    : '—'
                  return (
                    <tr key={m.email} className="group hover:bg-slate-800/40 transition-colors duration-150 ease-out">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${m.color} text-[10px] font-semibold text-white`}>
                            {m.initials}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-200">{m.name}</p>
                            <p className="text-[10px] text-slate-500 hidden sm:block">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={roleConfig[m.role] as 'info' | 'success' | 'default' | 'warning' | 'muted'}>
                          {m.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <Badge variant={m.status === 'Active' ? 'success' : 'muted'} dot>
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-300 hidden md:table-cell">
                        {m.reviews.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-300 hidden lg:table-cell">
                        {accuracy}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 hidden lg:table-cell">
                        {m.joined}
                      </td>
                      <td className="px-4 py-3.5">
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
