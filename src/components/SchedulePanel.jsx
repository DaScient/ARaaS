/**
 * SchedulePanel.jsx — Automated Interview Scheduling
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Demonstrates the calendar-sync scheduling UX for ranked candidates.
 * In production this would connect to Google Calendar / Outlook APIs.
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { rankCandidates } from '../engine/DNN_Sim'

const INTERVIEWERS = [
  { id: 1, name: 'Sarah Chen',    role: 'Engineering Lead',    avatar: 'SC' },
  { id: 2, name: 'Marcus Lee',    role: 'Data Science Manager', avatar: 'ML' },
  { id: 3, name: 'Priya Sharma',  role: 'Talent Partner',       avatar: 'PS' },
  { id: 4, name: 'David Kim',     role: 'CTO',                  avatar: 'DK' },
]

const INTERVIEW_TYPES = [
  { id: 'screen',      label: 'Phone Screen',       duration: 30 },
  { id: 'technical',   label: 'Technical Interview', duration: 60 },
  { id: 'culture',     label: 'Culture Fit',         duration: 45 },
  { id: 'final',       label: 'Final Round',         duration: 90 },
]

function timeSlots() {
  const slots = []
  const base = new Date()
  base.setHours(9, 0, 0, 0)
  for (let d = 1; d <= 5; d++) {
    const day = new Date(base)
    day.setDate(day.getDate() + d)
    for (let h = 9; h <= 16; h++) {
      const t = new Date(day)
      t.setHours(h, 0, 0, 0)
      slots.push(t)
    }
  }
  return slots
}

const SLOTS = timeSlots()

function ScheduleCard({ candidate, onSchedule, scheduled, calendarProvider, schedulerTimezone }) {
  const [type, setType]         = useState('technical')
  const [interviewer, setInter] = useState(INTERVIEWERS[0].id)
  const [slotIdx, setSlotIdx]   = useState(0)
  const [mode, setMode]         = useState('virtual')
  const [open, setOpen]         = useState(false)

  const slot = SLOTS[slotIdx]
  const interviewType = INTERVIEW_TYPES.find(t => t.id === type)
  const interviewerObj = INTERVIEWERS.find(i => i.id === interviewer)

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {candidate.name?.split(' ').map(w => w[0]).join('').slice(0,2)}
          </div>
          <div>
            <div className="text-white text-sm font-medium">{candidate.name}</div>
            <div className="text-slate-500 text-xs">{candidate.seniority} · Match: {candidate.matchScore}</div>
          </div>
        </div>

        {scheduled ? (
          <span className="px-2 py-1 rounded-full bg-green-900/40 border border-green-800/50 text-green-400 text-xs flex-shrink-0">
            ✓ Scheduled
          </span>
        ) : (
          <button
            onClick={() => setOpen(!open)}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex-shrink-0"
          >
            {open ? 'Close' : 'Schedule'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && !scheduled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-slate-700 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              {/* Interview type */}
              <div>
                <label className="block text-slate-400 text-xs mb-1 font-medium">Interview Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {INTERVIEW_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} ({t.duration}m)</option>)}
                </select>
              </div>
              {/* Interviewer */}
              <div>
                <label className="block text-slate-400 text-xs mb-1 font-medium">Interviewer</label>
                <select
                  value={interviewer}
                  onChange={e => setInter(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {INTERVIEWERS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1 font-medium">Meeting Mode</label>
                <select
                  value={mode}
                  onChange={e => setMode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="virtual">Virtual</option>
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div className="text-[11px] text-slate-500 rounded-lg bg-slate-800/60 border border-slate-700 px-2 py-1.5">
                <p>Candidate TZ: <span className="text-slate-300">{candidate.timezone || 'UTC'}</span></p>
                <p>Preferred window: <span className="text-slate-300">{candidate.interview_window || 'Flexible'}</span></p>
              </div>
            </div>

            {/* Time slot */}
            <div>
              <label className="block text-slate-400 text-xs mb-1 font-medium">
                Time Slot: {slot.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </label>
              <input
                type="range" min={0} max={SLOTS.length - 1} value={slotIdx}
                onChange={e => setSlotIdx(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Confirm */}
            <button
              onClick={() => onSchedule(candidate.candidate_id, {
                type, interviewerObj, slot, interviewType, mode, calendarProvider, schedulerTimezone,
              })}
              className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
            >
              📅 Send {calendarProvider} Invite to {candidate.name}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {scheduled && (
        <div className="mt-2 text-slate-500 text-xs">
          <span>{scheduled.interviewType.label} ({scheduled.mode})</span>
          {' '}with <span>{scheduled.interviewerObj.name}</span> on{' '}
          <span>
            {scheduled.slot.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {' '}· <span>{scheduled.calendarProvider}</span>
          {' '}· <span>scheduler TZ {scheduled.schedulerTimezone}</span>
        </div>
      )}
    </div>
  )
}

export default function SchedulePanel({ candidates, jobs, recruiterResources = [] }) {
  const [jobId, setJobId]         = useState(jobs[0]?.job_id || null)
  const [scheduled, setScheduled] = useState({})   // candidateId → booking
  const [calendarProvider, setCalendarProvider] = useState('Google Calendar')
  const [schedulerTimezone, setSchedulerTimezone] = useState('UTC')

  const job = useMemo(() => jobs.find(j => j.job_id === jobId), [jobs, jobId])

  const topCandidates = useMemo(() => {
    if (!job) return []
    return rankCandidates(candidates, job).slice(0, 10)
  }, [candidates, job])

  const handleSchedule = (candidateId, booking) => {
    setScheduled(prev => ({ ...prev, [candidateId]: booking }))
  }

  const scheduledCount = Object.keys(scheduled).length

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-wrap gap-4 items-end justify-between">
        <div className="flex-1 min-w-48">
          <label className="block text-slate-400 text-xs mb-1.5 font-medium">Job Role</label>
          <select
            value={jobId}
            onChange={e => { setJobId(Number(e.target.value)); setScheduled({}) }}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.role} — {j.location}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Calendar Provider</label>
            <select
              value={calendarProvider}
              onChange={e => setCalendarProvider(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option>Google Calendar</option>
              <option>Microsoft Outlook</option>
              <option>ICS Export</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Scheduler Timezone</label>
            <select
              value={schedulerTimezone}
              onChange={e => setSchedulerTimezone(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              {['PT', 'MT', 'CT', 'ET', 'UTC'].map(tz => <option key={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{scheduledCount}</div>
            <div className="text-slate-500 text-xs">Interviews Scheduled</div>
          </div>
          <button
            onClick={() => setScheduled({})}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-4 flex items-start gap-3">
        <span className="text-indigo-400 text-lg flex-shrink-0">ℹ</span>
        <div>
          <p className="text-indigo-300 text-xs font-medium">Production Integration Note</p>
          <p className="text-indigo-200/70 text-xs mt-0.5 leading-5">
            In production, clicking "Send Calendar Invite" would call the Google Calendar or
            Microsoft Graph API to create a calendar event and send invitations to the candidate
            and interviewer automatically. This demo simulates that UX and preserves candidate
            availability metadata (timezone, notice period, interview window) in the scheduling payload.
          </p>
        </div>
      </div>

      {recruiterResources.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-slate-300 text-xs font-medium mb-2">Quick Ops Resources</p>
          <div className="flex flex-wrap gap-2">
            {recruiterResources
              .filter(r => r.category === 'Operations' || r.category === 'Interviewing')
              .slice(0, 3)
              .map(r => (
                <span key={r.id} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-400">
                  {r.title}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Candidate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {topCandidates.map(c => (
          <ScheduleCard
            key={c.candidate_id}
            candidate={c}
            onSchedule={handleSchedule}
            scheduled={scheduled[c.candidate_id]}
            calendarProvider={calendarProvider}
            schedulerTimezone={schedulerTimezone}
          />
        ))}
      </div>
    </div>
  )
}
