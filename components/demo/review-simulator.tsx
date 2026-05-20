'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadZone } from './upload-zone'
import { ImageScanner } from './image-scanner'
import { OcrPanel } from './ocr-panel'
import { FraudPanel } from './fraud-panel'
import { ConfidenceMeter } from './confidence-meter'
import { DecisionBanner } from './decision-banner'
import { ActivityTimeline } from './activity-timeline'
import { ReasoningPanel } from './reasoning-panel'
import { SCENARIOS, type FlowState, type AnalysisScenario, type TimelineEntry } from '@/lib/demo-data'

export function ReviewSimulator() {
  const [flowState, setFlowState] = useState<FlowState>('idle')
  const [scenario, setScenario] = useState<AnalysisScenario>(SCENARIOS[0])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [visibleOcr, setVisibleOcr] = useState(0)
  const [visibleFraud, setVisibleFraud] = useState(0)

  const addLog = useCallback((type: TimelineEntry['type'], message: string) => {
    setTimeline((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString().slice(11, 23),
        message,
        type,
      },
    ])
  }, [])

  const reset = useCallback(() => {
    setFlowState('idle')
    setTimeline([])
    setVisibleOcr(0)
    setVisibleFraud(0)
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const handleStart = useCallback(
    (selected: AnalysisScenario, uploadedUrl: string | null) => {
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return uploadedUrl
      })
      setScenario(selected)
      setTimeline([])
      setVisibleOcr(0)
      setVisibleFraud(0)
      setFlowState('scanning')
    },
    [],
  )

  // State machine: single effect handles all phases
  useEffect(() => {
    if (flowState === 'idle' || flowState === 'complete') return

    const timers: ReturnType<typeof setTimeout>[] = []
    const t = (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay)
      timers.push(id)
    }

    if (flowState === 'scanning') {
      t(() => {
        addLog('scan', 'Submission received — initiating AI scan pipeline')
        addLog('info', 'Image integrity pre-check started')
      }, 0)
      t(() => addLog('info', 'OCR engine initialised'), 700)
      t(() => {
        addLog('success', 'Scan complete — no critical artifacts in raw pass')
        setFlowState('extracting')
      }, 2500)
    }

    else if (flowState === 'extracting') {
      t(() => addLog('info', 'Starting OCR field extraction...'), 0)
      scenario.ocrFields.forEach((field, i) => {
        t(() => {
          setVisibleOcr(i + 1)
          addLog('info', `Extracted: ${field.label} → "${field.value}" (${field.confidence}% conf)`)
        }, i * 420)
      })
      t(() => {
        addLog('success', 'OCR extraction complete')
        setFlowState('analyzing')
      }, scenario.ocrFields.length * 420 + 300)
    }

    else if (flowState === 'analyzing') {
      t(() => addLog('info', 'Running fraud detection ruleset...'), 0)
      scenario.fraudChecks.forEach((check, i) => {
        t(() => {
          setVisibleFraud(i + 1)
          const type: TimelineEntry['type'] = check.passed
            ? 'success'
            : check.severity === 'critical'
            ? 'error'
            : 'warning'
          addLog(type, `${check.passed ? '✓' : '✗'} ${check.label}: ${check.detail}`)
        }, i * 520)
      })
      t(() => {
        addLog('info', 'Signals evaluated — computing final confidence score')
        setFlowState('scoring')
      }, scenario.fraudChecks.length * 520 + 400)
    }

    else if (flowState === 'scoring') {
      t(() => addLog('info', `Confidence: ${scenario.confidence}% · Risk index: ${scenario.riskScore}/100`), 0)
      t(() => {
        const type: TimelineEntry['type'] =
          scenario.decision === 'approved' ? 'success'
          : scenario.decision === 'rejected' ? 'error'
          : 'warning'
        addLog(type, `Decision: ${scenario.decision.replace('-', ' ').toUpperCase()} — analysis complete`)
        setFlowState('complete')
      }, 1800)
    }

    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowState, scenario])

  const isActive = flowState !== 'idle'
  const showOcr = flowState !== 'idle' && flowState !== 'scanning'
  const showFraud = flowState === 'analyzing' || flowState === 'scoring' || flowState === 'complete'
  const showScore = flowState === 'scoring' || flowState === 'complete'
  const showDecision = flowState === 'complete'

  return (
    <div>
      <AnimatePresence mode="wait">
        {!isActive ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <UploadZone onStart={handleStart} />
          </motion.div>
        ) : (
          <motion.div
            key="simulator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-5 lg:grid-cols-5"
          >
            {/* Left: image preview + log (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <ImageScanner
                imageUrl={imageUrl}
                isScanning={flowState === 'scanning'}
                scenario={scenario}
              />
              <ActivityTimeline entries={timeline} />
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 hover:border-slate-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Start New Analysis
              </button>
            </div>

            {/* Right: analysis panels (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <AnimatePresence>
                {showOcr && (
                  <motion.div key="ocr" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <OcrPanel fields={scenario.ocrFields} visibleCount={visibleOcr} />
                  </motion.div>
                )}
                {showFraud && (
                  <motion.div key="fraud" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <FraudPanel checks={scenario.fraudChecks} visibleCount={visibleFraud} />
                  </motion.div>
                )}
                {showScore && (
                  <motion.div key="score" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <ConfidenceMeter confidence={scenario.confidence} riskScore={scenario.riskScore} />
                  </motion.div>
                )}
                {showDecision && (
                  <motion.div key="decision" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <DecisionBanner decision={scenario.decision} />
                  </motion.div>
                )}
                {showDecision && (
                  <motion.div key="reasoning" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
                    <ReasoningPanel reasoning={scenario.reasoning} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
