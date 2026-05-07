/**
 * JobMatchView.jsx — Job Description vs. Resume Comparison
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Side-by-side view highlighting overlapping tokens between the JD and
 * the selected candidate's resume, enabling quick gap analysis.
 */
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { rankCandidates } from '../engine/DNN_Sim'
import { extractEntities } from '../engine/nlp_engine'

function HighlightedText({ text, highlights }) {
  if (!highlights.size) return <span className="text-slate-300 text-sm leading-6">{text}</span>
  const words = text.split(/(\s+)/)
  return (
    <span className="text-sm leading-6">
      {words.map((word, i) => {
        const clean = word.toLowerCase().replace(/[^a-z0-9#+./\-]/g, '')
        const hit = highlights.has(clean)
        return (
          <span key={i} className={hit ? 'bg-indigo-500/30 text-indigo-200 rounded px-0.5' : 'text-slate-300'}>
            {word}
          </span>
        )
      })}
    </span>
  )
}

export default function JobMatchView({ candidates, jobs }) {
  const [jobId, setJobId]       = useState(jobs[0]?.job_id || null)
  const [candId, setCandId]     = useState(null)

  const job = useMemo(() => jobs.find(j => j.job_id === jobId), [jobs, jobId])

  // Rank candidates and pick default
  const ranked = useMemo(() => {
    if (!job) return []
    return rankCandidates(candidates, job).slice(0, 20)
  }, [candidates, job])

  const effectiveCandId = candId ?? ranked[0]?.candidate_id
  const candidate = useMemo(
    () => ranked.find(c => c.candidate_id === effectiveCandId) || ranked[0],
    [ranked, effectiveCandId]
  )

  // NLP entity extraction
  const jobEntities  = useMemo(() => job ? extractEntities(`${job.description} ${job.skills_required}`) : null, [job])
  const candEntities = useMemo(() => candidate ? extractEntities(`${candidate.skills} ${candidate.resume_text}`) : null, [candidate])

  // Token overlap for highlighting
  const jobTokens  = useMemo(() => new Set([
    ...(jobEntities?.technicalSkills || []),
    ...(jobEntities?.behavioralSkills || []),
  ]), [jobEntities])

  const candTokens = useMemo(() => new Set([
    ...(candEntities?.technicalSkills || []),
    ...(candEntities?.behavioralSkills || []),
  ]), [candEntities])

  const overlapSkills = useMemo(
    () => [...jobTokens].filter(s => candTokens.has(s)),
    [jobTokens, candTokens]
  )
  const gapSkills = useMemo(
    () => [...jobTokens].filter(s => !candTokens.has(s)),
    [jobTokens, candTokens]
  )

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-slate-400 text-xs mb-1.5 font-medium">Job</label>
          <select
            value={jobId}
            onChange={e => { setJobId(Number(e.target.value)); setCandId(null) }}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.role} — {j.location}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-slate-400 text-xs mb-1.5 font-medium">Candidate</label>
          <select
            value={effectiveCandId}
            onChange={e => setCandId(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {ranked.map(c => (
              <option key={c.candidate_id} value={c.candidate_id}>
                {c.name} — Match: {c.matchScore}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Score summary */}
      {candidate && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Overall Match', value: candidate.matchScore, color: 'indigo' },
            { label: 'Skills',        value: candidate.skillScore,      color: 'violet' },
            { label: 'Education',     value: candidate.educationScore,  color: 'sky' },
            { label: 'Experience',    value: candidate.experienceScore, color: 'amber' },
          ].map(({ label, value, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-${color}-900/30 border border-${color}-800/50 rounded-xl p-4 text-center`}
            >
              <div className={`text-3xl font-bold text-${color}-400`}>{value}</div>
              <div className="text-slate-500 text-xs mt-1">{label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Side-by-side text view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* JD Panel */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Job Description</h3>
            <span className="text-xs text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded-full">
              {job?.role}
            </span>
          </div>
          {job && (
            <div className="space-y-3">
              <HighlightedText
                text={job.description}
                highlights={candTokens}
              />
              <div>
                <p className="text-slate-500 text-xs font-medium mb-1.5">Required Skills</p>
                <p className="text-slate-300 text-sm">{job.skills_required}</p>
              </div>
            </div>
          )}
        </div>

        {/* Resume Panel */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Candidate Resume</h3>
            <span className="text-xs text-violet-400 bg-violet-900/40 px-2 py-0.5 rounded-full">
              {candidate?.name}
            </span>
          </div>
          {candidate && (
            <div className="space-y-3">
              <HighlightedText
                text={candidate.resume_text}
                highlights={jobTokens}
              />
              <div>
                <p className="text-slate-500 text-xs font-medium mb-1.5">Skills</p>
                <p className="text-slate-300 text-sm">{candidate.skills}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gap Analysis */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Skill Gap Analysis</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-green-400 text-xs font-medium mb-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Matching Skills ({overlapSkills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {overlapSkills.length === 0
                ? <span className="text-slate-600 text-xs">None detected</span>
                : overlapSkills.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-green-900/30 border border-green-800/50 text-green-300 text-xs">
                      {s}
                    </span>
                  ))
              }
            </div>
          </div>
          <div>
            <p className="text-red-400 text-xs font-medium mb-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              Skill Gaps ({gapSkills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gapSkills.length === 0
                ? <span className="text-slate-600 text-xs">No gaps detected</span>
                : gapSkills.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-red-900/30 border border-red-800/50 text-red-300 text-xs">
                      {s}
                    </span>
                  ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
