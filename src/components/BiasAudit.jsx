/**
 * BiasAudit.jsx — Diversity Metrics & Bias Detection Panel
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Visualises candidate pool demographics (gender, ethnicity) and
 * pipeline stage representation to surface potential bias.
 * Uses Recharts for all charts.
 */
import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { motion } from 'framer-motion'

const GENDER_COLORS    = ['#6366f1', '#ec4899', '#a855f7', '#64748b']
const ETHNICITY_COLORS = ['#22d3ee', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#64748b']
const SOURCE_COLORS    = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899']

const TOOLTIP_STYLE = {
  background: '#1e2130', border: '1px solid #334155',
  color: '#e2e8f0', fontSize: 12, borderRadius: 8,
}

function countBy(arr, key) {
  const map = {}
  arr.forEach(item => {
    const v = item[key] || 'Unknown'
    map[v] = (map[v] || 0) + 1
  })
  return Object.entries(map).map(([name, value]) => ({ name, value }))
}

function DiversityPie({ data, colors, title }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <h3 className="text-white font-semibold text-sm mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4"
    >
      <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
      <div className="text-slate-300 text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
    </motion.div>
  )
}

export default function BiasAudit({ candidates, applications, jobs }) {
  const genderData    = useMemo(() => countBy(candidates, 'gender'), [candidates])
  const ethnicityData = useMemo(() => countBy(candidates, 'ethnicity'), [candidates])
  const sourceData    = useMemo(() => countBy(applications, 'source'), [applications])

  // Stage representation by gender
  const stageGender = useMemo(() => {
    const stages = ['Applied', 'Screen', 'Interview', 'Offer', 'Hired']
    const genders = [...new Set(candidates.map(c => c.gender))]

    // Build a lookup of candidate_id → gender
    const cidToGender = Object.fromEntries(candidates.map(c => [c.candidate_id, c.gender]))

    return stages.map(stage => {
      const row = { stage }
      const stageApps = applications.filter(a => a.stage === stage)
      genders.forEach(g => {
        row[g] = stageApps.filter(a => cidToGender[a.candidate_id] === g).length
      })
      return row
    })
  }, [candidates, applications])

  const genders = useMemo(() => [...new Set(candidates.map(c => c.gender))], [candidates])

  // Simple bias index: ratio of max:min representation in hired stage
  const hiredGender = stageGender.find(s => s.stage === 'Hired') || {}
  const genderValues = genders.map(g => hiredGender[g] || 0).filter(v => v > 0)
  const biasIndex = genderValues.length > 1
    ? (Math.min(...genderValues) / Math.max(...genderValues)).toFixed(2)
    : '1.00'

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Candidates" value={candidates.length} color="indigo" />
        <StatCard
          label="Gender Balance Index"
          value={biasIndex}
          sub="1.0 = perfectly balanced"
          color={biasIndex >= 0.75 ? 'green' : biasIndex >= 0.5 ? 'amber' : 'red'}
        />
        <StatCard
          label="Unique Ethnicities"
          value={[...new Set(candidates.map(c => c.ethnicity))].length}
          sub="in candidate pool"
          color="violet"
        />
        <StatCard
          label="Sourcing Channels"
          value={[...new Set(applications.map(a => a.source))].length}
          color="sky"
        />
      </div>

      {/* Pie charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DiversityPie data={genderData}    colors={GENDER_COLORS}    title="Gender Distribution" />
        <DiversityPie data={ethnicityData} colors={ETHNICITY_COLORS} title="Ethnicity Distribution" />
        <DiversityPie data={sourceData}    colors={SOURCE_COLORS}    title="Application Source Mix" />
      </div>

      {/* Stage representation by gender */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-1">
          Pipeline Stage Representation by Gender
        </h3>
        <p className="text-slate-500 text-xs mb-4">
          Detect drop-off disparities at each recruitment stage
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stageGender} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
            <XAxis dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {genders.map((g, i) => (
              <Bar key={g} dataKey={g} fill={GENDER_COLORS[i % GENDER_COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4">
        <p className="text-amber-300 text-xs font-medium mb-1">⚠ Bias Audit Disclaimer</p>
        <p className="text-amber-200/70 text-xs leading-5">
          This panel is for informational purposes to support EEOC compliance and DEI initiatives.
          All candidate data is pseudonymised. Demographic signals are <strong>never</strong> used
          as ranking inputs — they are monitored exclusively to detect and remediate systemic bias.
          DaScient, LLC is committed to equitable hiring practices.
        </p>
      </div>
    </div>
  )
}
