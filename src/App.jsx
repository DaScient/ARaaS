/**
 * App.jsx — Root Application Shell
 * ARaaS — Recruiter Command Center
 * DaScient, LLC | Proprietary
 *
 * Fetches synthetic JSON data, wires together all dashboard panels,
 * and provides top-level navigation state.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import Header             from './components/Header.jsx'
import AnalyticsDashboard from './components/AnalyticsDashboard.jsx'
import FunnelChartPanel   from './components/FunnelChart.jsx'
import CandidateTable     from './components/CandidateTable.jsx'
import JobMatchView       from './components/JobMatchView.jsx'
import ChatbotPanel       from './components/ChatbotPanel.jsx'
import BiasAudit          from './components/BiasAudit.jsx'
import SchedulePanel      from './components/SchedulePanel.jsx'

const BASE = import.meta.env.BASE_URL   // '/ARaaS/' on GitHub Pages, '/' locally

async function fetchJSON(path) {
  const res = await fetch(`${BASE}data/${path}`)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json()
}

export default function App() {
  const [tab, setTab]           = useState('analytics')
  const [candidates, setCands]  = useState([])
  const [jobs, setJobs]         = useState([])
  const [applications, setApps] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    Promise.all([
      fetchJSON('candidates.json'),
      fetchJSON('jobs.json'),
      fetchJSON('applications.json'),
    ])
      .then(([cands, jobsData, apps]) => {
        setCands(cands)
        setJobs(jobsData)
        setApps(apps)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0d14] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
          AR
        </div>
        <div className="text-slate-300 text-sm animate-pulse">Loading ARaaS Recruiter Command Center…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0d14] flex items-center justify-center">
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-xl p-6 max-w-md text-center">
          <p className="font-semibold mb-2">Data load error</p>
          <p className="text-red-300/70 text-xs">{error}</p>
        </div>
      </div>
    )
  }

  const panels = {
    analytics: (
      <>
        <AnalyticsDashboard candidates={candidates} applications={applications} jobs={jobs} />
        <div className="mt-4">
          <FunnelChartPanel applications={applications} />
        </div>
      </>
    ),
    ranking:  <CandidateTable candidates={candidates} jobs={jobs} />,
    matching: <JobMatchView   candidates={candidates} jobs={jobs} />,
    chatbot:  <ChatbotPanel candidates={candidates} jobs={jobs} applications={applications} />,
    bias:     <BiasAudit candidates={candidates} applications={applications} jobs={jobs} />,
    schedule: <SchedulePanel candidates={candidates} jobs={jobs} />,
  }

  return (
    <div className="min-h-screen bg-[#0b0d14]">
      <Header activeTab={tab} onTabChange={setTab} />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {panels[tab]}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6 px-6 text-center">
        <p className="text-slate-600 text-xs">
          ARaaS · Recruiter Command Center ·{' '}
          <span className="text-slate-500">DaScient, LLC — Proprietary</span>
          {' '}· {candidates.length} candidates · {jobs.length} jobs · {applications.length} applications
        </p>
      </footer>
    </div>
  )
}

