import { FraudAlerts } from '@/components/dashboard/fraud-alerts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconShieldAlert, IconAlertTriangle, IconActivity, IconDownload } from '@/components/icons'

const rulesets = [
  { name: 'AI Content Detection', status: 'Active', detections: 47, accuracy: '99.2%', model: 'GAN-v4' },
  { name: 'Coordinated Behavior', status: 'Active', detections: 23, accuracy: '96.8%', model: 'Graph-v2' },
  { name: 'Metadata Integrity', status: 'Active', detections: 12, accuracy: '100%', model: 'Rule-based' },
  { name: 'Rate Anomaly', status: 'Active', detections: 8, accuracy: '94.1%', model: 'TimeSeries-v1' },
  { name: 'Hash Deduplication', status: 'Active', detections: 31, accuracy: '100%', model: 'Hash-exact' },
  { name: 'Geolocation Check', status: 'Inactive', detections: 0, accuracy: '—', model: 'IP-v2' },
]

export default function FraudPage() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Fraud Detection</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered threat intelligence and rule management</p>
        </div>
        <Button variant="primary" size="md">
          <IconShieldAlert className="w-4 h-4" />
          Configure Rules
        </Button>
      </div>

      {/* Threat level banner */}
      <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 text-red-400 shrink-0">
          <IconAlertTriangle className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-300">Elevated Threat Level</p>
          <p className="text-xs text-slate-500 mt-0.5">3 critical alerts require immediate review. Coordinated attack pattern detected from AS12345.</p>
        </div>
        <Button variant="danger" size="sm">Review Now</Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Blocked Today', value: '47', color: 'text-red-400', bg: 'bg-red-500/10', sub: 'Coordinated attack' },
          { label: 'Detection Rate', value: '99.1%', color: 'text-emerald-400', bg: 'bg-emerald-500/10', sub: 'Last 30 days' },
          { label: 'False Positive Rate', value: '0.3%', color: 'text-indigo-400', bg: 'bg-indigo-500/10', sub: 'Industry avg 1.2%' },
          { label: 'Rules Active', value: '5/6', color: 'text-violet-400', bg: 'bg-violet-500/10', sub: '1 paused' },
        ].map((s) => (
          <Card key={s.label} padding="md">
            <div className={`inline-flex rounded-lg ${s.bg} px-2 py-1 mb-3`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
            <p className="text-xs font-medium text-slate-300">{s.label}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Alerts panel - wider */}
        <div className="xl:col-span-2">
          <FraudAlerts />
        </div>

        {/* Detection rulesets */}
        <div className="xl:col-span-3">
          <Card padding="none">
            <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <IconActivity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Detection Rulesets</h3>
                  <p className="text-xs text-slate-500 mt-0.5">AI models and rule engines</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <IconDownload className="w-3.5 h-3.5" />
                Report
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800/60">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ruleset</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Model</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hits</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Accuracy</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {rulesets.map((r) => (
                    <tr key={r.name} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-medium text-slate-200">{r.name}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-800/60 rounded px-1.5 py-0.5">{r.model}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-300">{r.detections}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{r.accuracy}</td>
                      <td className="px-4 py-3">
                        <Badge variant={r.status === 'Active' ? 'success' : 'muted'} dot>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
