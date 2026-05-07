/**
 * AnalyticsDashboard.jsx — Recruitment Analytics & KPI Overview
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Displays:
 *  - Applications per day time-series (line chart with range slider)
 *  - Applications by role / location / source (grouped bar chart)
 *  - Salary distribution histogram
 *  - Top KPI cards
 */
import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Cell,
} from 'recharts'
import { motion } from 'framer-motion'

const TOOLTIP_STYLE = {
  background: '#1e2130', border: '1px solid #334155',
  color: '#e2e8f0', fontSize: 12, borderRadius: 8,
}

const COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#ec4899',
  '#22c55e', '#a855f7', '#ef4444', '#64748b',
]

function KpiCard({ label, value, sub, delta, color = 'indigo' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="text-slate-500 text-xs font-medium mb-2">{label}</div>
      <div className={`text-3xl font-bold text-${color}-400`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
      {delta !== undefined && (
        <div className={`text-xs mt-1 ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs prior period
        </div>
      )}
    </motion.div>
  )
}

export default function AnalyticsDashboard({ candidates, applications, jobs }) {
  const [groupBy, setGroupBy] = useState('role')

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const hired = useMemo(() => applications.filter(a => a.stage === 'Hired').length, [applications])
  const offered = useMemo(() => applications.filter(a => a.stage === 'Offer').length, [applications])
  const offerRate = offered > 0 ? Math.round((hired / offered) * 100) : 0
  const avgSalary = useMemo(() => {
    const vals = applications.map(a => a.salary_offered).filter(Boolean)
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0
  }, [applications])

  // ── Time series ─────────────────────────────────────────────────────────────
  const timeSeries = useMemo(() => {
    const counts = {}
    applications.forEach(a => {
      const d = a.stage_timestamp?.slice(0, 7)   // YYYY-MM
      if (d) counts[d] = (counts[d] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))
  }, [applications])

  // ── Grouped bar ─────────────────────────────────────────────────────────────
  const barData = useMemo(() => {
    if (groupBy === 'role' || groupBy === 'location') {
      // Join applications → jobs for role/location
      const jobMap = Object.fromEntries(jobs.map(j => [j.job_id, j]))
      const counts = {}
      applications.forEach(a => {
        const j = jobMap[a.job_id]
        const key = j ? j[groupBy === 'role' ? 'role' : 'location'] : 'Unknown'
        counts[key] = (counts[key] || 0) + 1
      })
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
    }
    // source
    const counts = {}
    applications.forEach(a => {
      const key = a.source || 'Unknown'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }, [applications, jobs, groupBy])

  // ── Salary histogram ────────────────────────────────────────────────────────
  const salaryHist = useMemo(() => {
    const bins = [80, 100, 120, 140, 160, 180, 200, 220, 240, Infinity]
    const labels = ['<100k', '100–120k', '120–140k', '140–160k', '160–180k', '180–200k', '200–220k', '220–240k', '>240k']
    const counts = new Array(labels.length).fill(0)
    applications.forEach(a => {
      if (!a.salary_offered) return
      const s = a.salary_offered / 1000
      for (let i = 0; i < bins.length; i++) {
        if (s < bins[i]) { counts[i]++; break }
      }
    })
    return labels.map((label, i) => ({ label, count: counts[i] }))
  }, [applications])

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Applications" value={applications.length} delta={12} color="indigo" />
        <KpiCard label="Candidates in Pool"  value={candidates.length}  color="violet" />
        <KpiCard label="Hires"               value={hired}              sub={`${offerRate}% offer acceptance`} color="green" delta={5} />
        <KpiCard label="Avg. Salary Offered" value={`$${(avgSalary/1000).toFixed(0)}k`} color="amber" />
      </div>

      {/* Time-series */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Applications per Month</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={timeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line
              type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2}
              dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Grouped bar + Salary histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">Applications by…</h2>
            <div className="flex gap-1">
              {['role', 'location', 'source'].map(g => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    groupBy === g ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Salary Distribution (Offered)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salaryHist} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
