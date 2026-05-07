/**
 * FunnelChart.jsx — Recruitment Pipeline Funnel Visualisation
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Uses Recharts FunnelChart to render stage-by-stage conversion metrics
 * with animated bars and a conversion-rate overlay.
 */
import { useMemo } from 'react'
import {
  FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { motion } from 'framer-motion'

const STAGE_ORDER  = ['Applied', 'Screen', 'Interview', 'Offer', 'Hired']
const STAGE_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#22c55e']

export default function FunnelChartPanel({ applications }) {
  const stageData = useMemo(() => {
    const counts = Object.fromEntries(STAGE_ORDER.map(s => [s, 0]))
    applications.forEach(a => {
      if (counts[a.stage] !== undefined) counts[a.stage]++
    })
    return STAGE_ORDER.map((stage, i) => ({
      name:  stage,
      value: counts[stage],
      fill:  STAGE_COLORS[i],
    }))
  }, [applications])

  // Conversion rates relative to Applied
  const total = stageData[0]?.value || 1

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <h2 className="text-white font-semibold text-lg mb-1">Recruitment Pipeline Funnel</h2>
      <p className="text-slate-500 text-xs mb-6">
        Stage-by-stage conversion from application to hire
      </p>

      <div className="flex flex-col md:flex-row gap-8 items-center">
        {/* Funnel chart */}
        <div className="w-full md:w-1/2 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                formatter={(v, n) => [v, n]}
                contentStyle={{ background: '#1e2130', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }}
              />
              <Funnel dataKey="value" data={stageData} isAnimationActive>
                {stageData.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
                <LabelList position="center" fill="#fff" fontSize={12} dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        {/* Stage KPI cards */}
        <div className="w-full md:w-1/2 space-y-3">
          {stageData.map((s, i) => {
            const pct = Math.round((s.value / total) * 100)
            const conv = i === 0 ? 100
              : stageData[i - 1].value === 0 ? 0
              : Math.round((s.value / stageData[i - 1].value) * 100)
            return (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4 bg-slate-800/60 rounded-lg px-4 py-3"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: s.fill }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-300 text-sm font-medium">{s.name}</span>
                    <span className="text-white text-sm font-semibold">{s.value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ background: s.fill }}
                    />
                  </div>
                </div>
                <div className="text-slate-500 text-xs w-16 text-right flex-shrink-0">
                  {i === 0 ? '100%' : `${conv}% conv.`}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
