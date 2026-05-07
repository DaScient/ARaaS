/**
 * Header.jsx — Top Navigation Bar
 * ARaaS | DaScient, LLC — Proprietary
 */
import { motion } from 'framer-motion'

const NAV_ITEMS = [
  { id: 'analytics',  label: 'Analytics' },
  { id: 'ranking',    label: 'Candidates' },
  { id: 'matching',   label: 'Job Match' },
  { id: 'chatbot',    label: 'Chatbot' },
  { id: 'bias',       label: 'Bias Audit' },
  { id: 'schedule',   label: 'Schedule' },
]

export default function Header({ activeTab, onTabChange }) {
  return (
    <header className="sticky top-0 z-50 bg-[#0b0d14]/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm select-none">
            AR
          </div>
          <div>
            <span className="text-white font-semibold text-sm tracking-wide">ARaaS</span>
            <span className="hidden sm:inline text-slate-500 text-xs ml-2">
              Recruiter Command Center
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onTabChange(item.id)}
              className={`
                px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors
                ${activeTab === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}
              `}
            >
              {item.label}
            </motion.button>
          ))}
        </nav>

        {/* Right: branding caption */}
        <div className="hidden md:block text-slate-600 text-xs">
          DaScient, LLC · Proprietary
        </div>
      </div>
    </header>
  )
}
