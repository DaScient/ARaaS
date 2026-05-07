/**
 * ChatbotPanel.jsx — Conversational AI Chatbot Screening Interface
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Mock NER-based chatbot that demonstrates the candidate screening flow.
 * Uses nlp_engine.detectIntent() to route conversation context and
 * simulate how an LLM-backed chatbot would conduct structured interviews.
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { detectIntent, extractEntities, redactPII } from '../engine/nlp_engine'

// ── Bot conversation script ───────────────────────────────────────────────────

const BOT_SCRIPTS = {
  welcome: [
    "Hi! I'm ARA — your AI screening assistant. 👋",
    "I'll ask a few quick questions to help match you with the right role at DaScient.",
    "Let's start: Can you share your current location or preferred work arrangement (remote / hybrid / onsite)?",
  ],
  ask_location: [
    "Got it! Now, could you tell me about your total years of professional experience?",
  ],
  ask_experience: [
    "Great! What are your key technical skills and technologies you're most proficient in?",
  ],
  ask_skills: [
    "Thanks for sharing. What's your highest degree and field of study?",
  ],
  ask_education: [
    "Understood. What are your salary expectations (annual, in USD)?",
  ],
  ask_ctc: [
    "Perfect. Finally, what is your current notice period / earliest available start date?",
  ],
  ask_notice: [
    "Excellent! I have all the information I need. 🎉",
    "Based on your profile, you look like a strong match for our Senior Data Scientist and ML Engineer roles.",
    "A recruiter from DaScient will be in touch within 2 business days. Best of luck!",
  ],
  confirm_yes: ["Great, let me note that down! Could you provide more details?"],
  confirm_no:  ["No worries. Let's move on to the next question."],
  general: [
    "Thank you for sharing that! Let me extract the key information from your response.",
  ],
  fallback: [
    "I didn't quite catch that. Could you rephrase? For example, mention your location, experience, or skills.",
  ],
}

const FLOW = [
  'ask_location', 'ask_experience', 'ask_skills', 'ask_education',
  'ask_ctc', 'ask_notice',
]

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
      <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-sm text-slate-200 text-sm leading-6">
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
      <div className="bg-indigo-600/80 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-sm text-white text-sm leading-6">
        {text}
      </div>
    </motion.div>
  )
}

function NerTag({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-900/40 border border-violet-700/50 text-violet-300 text-xs mr-1 mb-1">
      <span className="text-violet-500">{label}:</span> {value}
    </span>
  )
}

export default function ChatbotPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [flowIdx, setFlowIdx]   = useState(-1)     // -1 = welcome
  const [entities, setEntities] = useState({})
  const [done, setDone]         = useState(false)
  const [typing, setTyping]     = useState(false)
  const endRef = useRef(null)

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  // Initialise with welcome messages
  useEffect(() => {
    const welcome = BOT_SCRIPTS.welcome.map((text, i) => ({ id: i, from: 'bot', text }))
    setMessages(welcome)
    setFlowIdx(0)
  }, [])

  const pushBot = (texts) => {
    setTyping(true)
    let delay = 600
    texts.forEach(text => {
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'bot', text }])
      }, delay)
      delay += 900
    })
    setTimeout(() => setTyping(false), delay)
  }

  const handleSend = () => {
    if (!input.trim() || done) return

    const userText = input.trim()
    setInput('')

    // Add user message
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text: userText }])

    // Detect intent + extract entities
    const intent     = detectIntent(userText)
    const extracted  = extractEntities(redactPII(userText))

    setEntities(prev => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(extracted)
          .filter(([, v]) => Array.isArray(v) ? v.length > 0 : v !== null)
      ),
    }))

    // Advance conversation flow
    const currentStep = FLOW[flowIdx]
    const nextIdx     = flowIdx + 1

    const replies = BOT_SCRIPTS[currentStep] || BOT_SCRIPTS.general

    if (nextIdx < FLOW.length) {
      const nextStep   = FLOW[nextIdx]
      const nextPrompt = BOT_SCRIPTS[nextStep] || []
      pushBot([...replies, ...nextPrompt])
      setFlowIdx(nextIdx)
    } else {
      pushBot(BOT_SCRIPTS.ask_notice)
      setDone(true)
    }
  }

  const resetChat = () => {
    setMessages([])
    setInput('')
    setFlowIdx(-1)
    setEntities({})
    setDone(false)
    setTyping(false)
    setTimeout(() => {
      const welcome = BOT_SCRIPTS.welcome.map((text, i) => ({ id: i, from: 'bot', text }))
      setMessages(welcome)
      setFlowIdx(0)
    }, 100)
  }

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
              <p className="text-white text-sm font-medium">ARA · Screening Assistant</p>
              <p className="text-green-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Online
              </p>
            </div>
          </div>
          <button
            onClick={resetChat}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <AnimatePresence>
            {messages.map(msg =>
              msg.from === 'bot'
                ? <BotMsg key={msg.id} text={msg.text} />
                : <UserMsg key={msg.id} text={msg.text} />
            )}
          </AnimatePresence>
          {typing && (
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
        <div className="px-4 py-3 border-t border-slate-800 flex gap-2 flex-shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={done ? 'Screening complete' : 'Type your response…'}
            disabled={done || typing}
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || done || typing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Extracted NER Panel */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-5">
        <div>
          <h3 className="text-white font-semibold text-sm mb-1">Extracted Entities (NER)</h3>
          <p className="text-slate-500 text-xs">Real-time information extracted from candidate responses</p>
        </div>

        {Object.keys(entities).length === 0 ? (
          <p className="text-slate-600 text-sm">Entities will appear here as the candidate responds…</p>
        ) : (
          <div className="space-y-3">
            {entities.technicalSkills?.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs font-medium mb-1.5">Technical Skills</p>
                <div className="flex flex-wrap">{entities.technicalSkills.map(s => <NerTag key={s} label="SKILL" value={s} />)}</div>
              </div>
            )}
            {entities.behavioralSkills?.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs font-medium mb-1.5">Behavioral Skills</p>
                <div className="flex flex-wrap">{entities.behavioralSkills.map(s => <NerTag key={s} label="SOFT" value={s} />)}</div>
              </div>
            )}
            {entities.degrees?.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs font-medium mb-1.5">Education</p>
                <div className="flex flex-wrap">{entities.degrees.map(d => <NerTag key={d} label="DEG" value={d} />)}</div>
              </div>
            )}
            {entities.yearsExperience && (
              <div>
                <p className="text-slate-500 text-xs font-medium mb-1.5">Experience</p>
                <NerTag label="YOE" value={`${entities.yearsExperience} years`} />
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-slate-800">
          <p className="text-slate-500 text-xs font-medium mb-2">Conversation Progress</p>
          <div className="space-y-1.5">
            {FLOW.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  i < flowIdx ? 'bg-green-400' : i === flowIdx ? 'bg-indigo-400' : 'bg-slate-700'
                }`} />
                <span className={`text-xs capitalize ${
                  i < flowIdx ? 'text-green-400' : i === flowIdx ? 'text-indigo-400' : 'text-slate-600'
                }`}>
                  {step.replace('ask_', '').replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
