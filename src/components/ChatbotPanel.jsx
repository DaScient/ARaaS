/**
 * ChatbotPanel.jsx — Agentic AI Chatbot Interface
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Minimal, focused chat UI wired to the agent loop in `engine/agent.js`.
 * Supports OpenAI / Gemini / Anthropic (Bring-Your-Own-Key, stored in
 * localStorage) and falls back to a scripted offline mock so the demo
 * always works on GitHub Pages without keys.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { runAgentTurn } from '../engine/agent.js'
import {
  loadConfig, saveConfig, isConfigured, PROVIDERS, DEFAULT_MODELS,
} from '../engine/llm_engine.js'

// ── Small UI atoms ───────────────────────────────────────────────────────────

function BotMsg({ text }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-3 items-start"
    >
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
        ARA
      </div>
      <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] text-slate-200 text-sm leading-6 whitespace-pre-wrap">
        {text}
      </div>
    </motion.div>
  )
}

function UserMsg({ text }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex justify-end"
    >
      <div className="bg-indigo-600/80 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] text-white text-sm leading-6 whitespace-pre-wrap">
        {text}
      </div>
    </motion.div>
  )
}

function ToolEvent({ ev }) {
  const label = ev.type === 'tool_call' ? `🔧 ${ev.name}(${shortArgs(ev.arguments)})`
              : ev.type === 'tool_result' ? `↪ ${ev.name} → ${shortResult(ev.result)}`
              : null
  if (!label) return null
  return (
    <div className="text-[11px] text-slate-500 ml-11 font-mono leading-5 truncate">
      {label}
    </div>
  )
}

function shortArgs(a = {}) {
  const s = JSON.stringify(a)
  return s.length > 80 ? s.slice(0, 77) + '…' : s
}
function shortResult(r) {
  if (r?.error) return `error: ${r.error}`
  const keys = Object.keys(r || {}).slice(0, 3).join(', ')
  return keys ? `{ ${keys} }` : 'ok'
}

// ── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ open, initial, onClose, onSave }) {
  const [provider, setProvider] = useState(initial.provider)
  const [model, setModel]       = useState(initial.model)
  const [apiKey, setApiKey]     = useState(initial.apiKey)

  if (!open) return null

  const onProviderChange = (p) => {
    setProvider(p)
    setModel(DEFAULT_MODELS[p] || '')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md p-6 space-y-4"
      >
        <div>
          <h3 className="text-white font-semibold text-base">Chatbot Settings</h3>
          <p className="text-slate-400 text-xs mt-1">
            Keys are stored only in your browser&rsquo;s localStorage and sent directly
            to the provider you select. Use <span className="text-slate-300">mock</span> for
            an offline demo.
          </p>
        </div>

        <div>
          <label className="block text-slate-400 text-xs mb-1">Provider</label>
          <select
            value={provider}
            onChange={e => onProviderChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 text-xs mb-1">Model</label>
          <input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder={DEFAULT_MODELS[provider]}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 text-xs mb-1">
            API Key {provider === 'mock' && <span className="text-slate-600">(not required)</span>}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={provider === 'mock'}
            placeholder={provider === 'mock' ? '—' : `${provider} API key`}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm font-mono disabled:opacity-40"
          />
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <button
            onClick={() => { saveConfig(null); onSave({ provider: 'mock', model: DEFAULT_MODELS.mock, apiKey: '' }) }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Clear stored key
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ provider, model, apiKey })}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Who are the top 5 candidates for the Senior Data Scientist role?',
  'Show me pipeline stats and the strongest source of hires.',
  "I'd like to apply — what roles are open?",
  'Find candidates with PyTorch and MLOps experience.',
]

export default function ChatbotPanel({ candidates = [], jobs = [], applications = [] }) {
  const [config, setConfig]     = useState(() => loadConfig())
  const [history, setHistory]   = useState(() => {
    const cfg = loadConfig()
    return [{
      role: 'assistant',
      content:
        "Hi! I'm ARA — your agentic recruiting assistant. 👋\n\n"
        + (isConfigured(cfg)
            ? `Connected to **${cfg.provider}** (${cfg.model || DEFAULT_MODELS[cfg.provider]}). Ask me anything about candidates, jobs, or the pipeline — or paste a resume snippet for me to parse.`
            : "I'm in offline demo mode. Click the ⚙️ icon to add an OpenAI / Gemini / Anthropic key for full agentic capabilities."),
    }]
  })
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [events, setEvents]     = useState([])     // tool events for current turn
  const [settingsOpen, setSet]  = useState(false)
  const endRef = useRef(null)

  // Persistent screening profile carried across tool calls in one session.
  const ctxRef = useRef({ candidates, jobs, applications, screeningProfile: {} })
  useEffect(() => {
    ctxRef.current = { ...ctxRef.current, candidates, jobs, applications }
  }, [candidates, jobs, applications])

  // Visible message stream (assistant + user only, ignoring tool/system).
  const visible = useMemo(() => history.filter(m => m.role === 'user' || (m.role === 'assistant' && m.content)), [history])

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visible.length, busy, events.length])

  const send = async (text) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || busy) return
    setInput('')
    setBusy(true)
    setEvents([])

    // Optimistically render the user message.
    const optimisticHistory = [...history, { role: 'user', content: trimmed }]
    setHistory(optimisticHistory)

    const turnEvents = []
    try {
      const { messages: nextMessages } = await runAgentTurn({
        history,
        userText: trimmed,
        config,
        context: ctxRef.current,
        onEvent: ev => {
          turnEvents.push(ev)
          setEvents([...turnEvents])
        },
      })
      setHistory(nextMessages)
    } catch (err) {
      setHistory([
        ...optimisticHistory,
        { role: 'assistant', content: `⚠️ ${err.message || 'Something went wrong'}` },
      ])
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setEvents([])
    ctxRef.current.screeningProfile = {}
    setHistory([{
      role: 'assistant',
      content: "Conversation reset. How can I help? 👋",
    }])
  }

  const onSaveSettings = (cfg) => {
    saveConfig(cfg)
    setConfig(cfg)
    setSet(false)
  }

  const status = isConfigured(config)
    ? { color: 'bg-green-400', text: 'text-green-400', label: `${config.provider} · ${config.model}` }
    : { color: 'bg-amber-400', text: 'text-amber-400', label: 'offline demo (no key)' }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Chat window */}
      <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-[600px]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              ARA
            </div>
            <div>
              <p className="text-white text-sm font-medium">ARA · Agentic Recruiting Assistant</p>
              <p className={`text-xs flex items-center gap-1 ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${status.color}`} />
                {status.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSet(true)}
              title="Configure LLM provider & API key"
              className="text-slate-500 hover:text-slate-300 text-base"
              aria-label="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={reset}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <AnimatePresence>
            {visible.map((msg, i) =>
              msg.role === 'assistant'
                ? <BotMsg key={i} text={msg.content} />
                : <UserMsg key={i} text={msg.content} />,
            )}
          </AnimatePresence>

          {busy && events.length > 0 && (
            <div className="space-y-1">
              {events.filter(e => e.type === 'tool_call' || e.type === 'tool_result').map((e, i) => (
                <ToolEvent key={i} ev={e} />
              ))}
            </div>
          )}

          {busy && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">ARA</div>
              <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 flex flex-col gap-2 flex-shrink-0">
          {visible.length <= 1 && !busy && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] text-slate-400 hover:text-indigo-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-full px-2.5 py-1"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={busy ? 'ARA is thinking…' : 'Ask ARA anything…'}
              disabled={busy}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || busy}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Side panel: capabilities & live tool trace */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-5">
        <div>
          <h3 className="text-white font-semibold text-sm mb-1">Agentic Capabilities</h3>
          <p className="text-slate-500 text-xs">ARA can call any of these tools to answer factually.</p>
        </div>

        <ul className="space-y-1.5 text-xs text-slate-400">
          <li>🔍 <span className="text-slate-300">search_candidates</span> — keyword search the talent pool</li>
          <li>🎯 <span className="text-slate-300">rank_candidates_for_job</span> — DNN_Sim TF-IDF matching</li>
          <li>📋 <span className="text-slate-300">list_jobs / get_job</span> — open requisitions</li>
          <li>📈 <span className="text-slate-300">get_pipeline_stats</span> — funnel & source analytics</li>
          <li>🧠 <span className="text-slate-300">extract_entities_from_text</span> — resume NER</li>
          <li>📝 <span className="text-slate-300">record_screening_answer</span> — structured screening</li>
          <li>📅 <span className="text-slate-300">suggest_interview_slots</span> — calendar suggestions</li>
        </ul>

        <div className="pt-3 border-t border-slate-800">
          <p className="text-slate-500 text-xs font-medium mb-2">Last turn · tool trace</p>
          {events.length === 0 ? (
            <p className="text-slate-600 text-xs">Tool calls will stream here in real time.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {events.map((e, i) => (
                <div key={i} className="text-[11px] font-mono">
                  {e.type === 'thinking' && <span className="text-slate-500">… thinking</span>}
                  {e.type === 'tool_call' && (
                    <span className="text-indigo-300">→ {e.name}({shortArgs(e.arguments)})</span>
                  )}
                  {e.type === 'tool_result' && (
                    <span className={e.result?.error ? 'text-red-400' : 'text-emerald-400'}>
                      ← {e.name}: {shortResult(e.result)}
                    </span>
                  )}
                  {e.type === 'message' && (
                    <span className="text-slate-500">✓ reply ({(e.text || '').length} chars)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-600 leading-5">
          Keys live only in your browser&rsquo;s localStorage. Click&nbsp;⚙️ to configure.
        </div>
      </div>

      <SettingsModal
        key={settingsOpen ? 'open' : 'closed'}
        open={settingsOpen}
        initial={config}
        onClose={() => setSet(false)}
        onSave={onSaveSettings}
      />
    </div>
  )
}
