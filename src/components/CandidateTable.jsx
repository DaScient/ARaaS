/**
 * CandidateTable.jsx — AI-Ranked Candidate Table with Match Score Bars
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Displays top-ranked candidates for a selected job, using the DNN_Sim
 * matching engine.  Match score sub-dimensions (skill/edu/exp) are shown
 * as progress bars so recruiters can quickly understand each score.
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { rankCandidates } from '../engine/DNN_Sim'

const SCORE_COLOR = score =>
  score >= 75 ? '#22c55e'
  : score >= 50 ? '#f59e0b'
  : '#ef4444'

function ScoreBar({ value, color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 text-slate-500 text-xs text-right">{label}</div>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6 }}
          className="h-full rounded-full"
          style={{ background: color || SCORE_COLOR(value) }}
        />
      </div>
      <div className="w-8 text-xs text-slate-400 text-right">{value}</div>
    </div>
  )
}

export default function CandidateTable({ candidates, jobs }) {
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.job_id || null)
  const [expandedId, setExpandedId] = useState(null)
  const [weights, setWeights] = useState({ skill: 0.5, education: 0.2, experience: 0.3 })
  const [topK, setTopK] = useState(15)

  const selectedJob = useMemo(
    () => jobs.find(j => j.job_id === selectedJobId),
    [jobs, selectedJobId]
  )

  const ranked = useMemo(() => {
    if (!selectedJob) return []
    return rankCandidates(candidates, selectedJob, weights).slice(0, topK)
  }, [candidates, selectedJob, weights, topK])

  const rebalance = (key, val) => {
    const others = Object.keys(weights).filter(k => k !== key)
    const remaining = 1 - val
    const each = remaining / others.length
    setWeights(prev => ({
      ...prev,
      [key]: val,
      ...Object.fromEntries(others.map(k => [k, +each.toFixed(2)])),
    }))
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-wrap gap-6 items-end">
        {/* Job selector */}
        <div className="flex-1 min-w-48">
          <label className="block text-slate-400 text-xs mb-1.5 font-medium">Job Role</label>
          <select
            value={selectedJobId}
            onChange={e => setSelectedJobId(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {jobs.map(j => (
              <option key={j.job_id} value={j.job_id}>{j.role} — {j.location}</option>
            ))}
          </select>
        </div>

        {/* Weight sliders */}
        {['skill', 'education', 'experience'].map(key => (
          <div key={key} className="flex-1 min-w-36">
            <label className="block text-slate-400 text-xs mb-1.5 font-medium capitalize">
              {key} weight: <span className="text-indigo-400">{Math.round(weights[key] * 100)}%</span>
            </label>
            <input
              type="range" min={0.05} max={0.9} step={0.05}
              value={weights[key]}
              onChange={e => rebalance(key, +e.target.value)}
              className="w-full accent-indigo-500"
            />
          </div>
        ))}

        {/* Top-K */}
        <div className="min-w-28">
          <label className="block text-slate-400 text-xs mb-1.5 font-medium">
            Show top {topK}
          </label>
          <input
            type="range" min={5} max={50} step={5}
            value={topK}
            onChange={e => setTopK(+e.target.value)}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">
            Top {ranked.length} Candidates
            <span className="text-slate-500 font-normal text-sm ml-2">for {selectedJob?.role}</span>
          </h2>
          <span className="text-slate-500 text-xs">{candidates.length} in pool</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-800">
                <th className="px-4 py-3 text-slate-500 font-medium text-xs">#</th>
                <th className="px-4 py-3 text-slate-500 font-medium text-xs">Candidate</th>
                <th className="px-4 py-3 text-slate-500 font-medium text-xs">Location</th>
                <th className="px-4 py-3 text-slate-500 font-medium text-xs">Exp</th>
                <th className="px-4 py-3 text-slate-500 font-medium text-xs">Match Score</th>
                <th className="px-4 py-3 text-slate-500 font-medium text-xs">Source</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {ranked.map((c, i) => (
                  <>
                    <motion.tr
                      key={c.candidate_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setExpandedId(expandedId === c.candidate_id ? null : c.candidate_id)}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200 font-medium">{c.name}</div>
                        <div className="text-slate-500 text-xs">{c.seniority} · {c.degree}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{c.location}</td>
                      <td className="px-4 py-3 text-slate-300">{c.years_experience}y</td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${c.matchScore}%` }}
                              transition={{ duration: 0.7, delay: i * 0.04 }}
                              className="h-full rounded-full"
                              style={{ background: SCORE_COLOR(c.matchScore) }}
                            />
                          </div>
                          <span
                            className="text-xs font-semibold w-8 text-right"
                            style={{ color: SCORE_COLOR(c.matchScore) }}
                          >
                            {c.matchScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400">
                          {c.source}
                        </span>
                      </td>
                    </motion.tr>

                    {/* Expanded score breakdown */}
                    <AnimatePresence>
                      {expandedId === c.candidate_id && (
                        <motion.tr
                          key={`expand-${c.candidate_id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={6} className="px-6 py-4 bg-slate-800/30 border-b border-slate-800/60">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                              <div className="space-y-2">
                                <p className="text-slate-500 text-xs font-medium mb-2">Score Breakdown</p>
                                <ScoreBar value={c.skillScore}      label="Skills" />
                                <ScoreBar value={c.educationScore}  label="Edu" />
                                <ScoreBar value={c.experienceScore} label="Exp" />
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs font-medium mb-2">Skills</p>
                                <p className="text-slate-300 text-xs leading-5">{c.skills}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs font-medium mb-2">Resume Snippet</p>
                                <p className="text-slate-400 text-xs leading-5 line-clamp-4">{c.resume_text}</p>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
