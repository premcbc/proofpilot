interface AiCopilotCardProps {
  summary?: string | null
  recommendation?: string | null
  confidence?: number | null

  reasoning?: string[]

  riskScore?: number
  riskLevel?: string

  /**
   * True when this analysis was generated from an older OCR extraction.
   * A new OCR run completed after the analysis was stored but has not yet
   * triggered a fresh AI pass (e.g. due to a pipeline failure).
   */
  isStale?: boolean
}

/**
 * Tiered indigo palette for AI recommendation badges.
 *
 * All three states stay inside the AI/advisory color system (indigo/violet).
 * Intensity increases with severity of the recommendation so there is still
 * subtle visual signal — but NO semantic decision colors (no red/green/amber)
 * appear inside an AI-only surface.
 *
 * Semantic color system key:
 *   Indigo/violet  = AI advisory output   (never authoritative)
 *   Emerald/amber/red = human final decision (the only authoritative surface)
 */
function getRecommendationColor(
  recommendation?: string | null
): string {
  switch (recommendation) {
    // Softest: AI leans toward approval — lightest indigo
    case 'approve':
      return 'text-indigo-300 border-indigo-500/20 bg-indigo-500/8'

    // Mid: AI recommends human review — medium indigo
    case 'review':
      return 'text-indigo-300 border-indigo-500/30 bg-indigo-500/12'

    // Most emphatic: AI leans toward rejection — deeper indigo/violet
    case 'reject':
      return 'text-indigo-200 border-violet-400/35 bg-violet-500/15'

    default:
      return 'text-indigo-400 border-indigo-500/20 bg-indigo-500/8'
  }
}

export function AiCopilotCard({
  summary,
  recommendation,
  confidence,

  reasoning = [],

  riskScore = 0,
  riskLevel = 'low',

  isStale = false,
}: AiCopilotCardProps) {
  const suggestedAction =
    recommendation === 'approve'
      ? 'AI recommends approval — human confirmation required'

      : recommendation === 'reject'
      ? 'AI recommends rejection — human confirmation required'

      : 'AI recommends manual review — human confirmation required'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      {isStale && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Analysis may be outdated — a newer OCR extraction has completed since this was generated.
        </div>
      )}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            AI Review Copilot
          </div>

          <div className="mt-1 text-lg font-semibold text-white">
            Reviewer Guidance
          </div>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRecommendationColor(
            recommendation
          )}`}
        >
          {recommendation === 'approve'
            ? 'Recommends Approval'
            : recommendation === 'reject'
            ? 'Recommends Rejection'
            : 'Recommends Review'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-white/40">
            AI Confidence
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${confidence ?? 0}%`,
                }}
              />
            </div>

            <div className="text-sm font-medium text-white">
              {confidence ?? 0}%
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-white/40">
            Risk Assessment
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {riskScore}
            </div>

            <div className="text-sm capitalize text-white/60">
              {riskLevel} risk
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-white/40">
          AI Summary
        </div>

        <div className="text-sm leading-6 text-white/80">
          {summary ?? 'No AI summary available yet.'}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-white/40">
          AI Reasoning
        </div>

        <div className="space-y-2">
          {reasoning.length > 0 ? (
            reasoning.map((item, index) => (
              <div
                key={`${index}-${item}`}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/80"
              >
                • {item}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-white/40">
              No reasoning generated yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-white/40">
          Suggested Reviewer Action
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white">
          {suggestedAction}
        </div>
      </div>
    </div>
  )
}