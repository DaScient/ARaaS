/**
 * llm_engine.js — Pluggable LLM Provider Layer
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Provider-agnostic client that talks to OpenAI, Google Gemini, or
 * Anthropic from the browser. Supports tool/function calling so the
 * agent loop in `agent.js` can stay provider-independent.
 *
 * ── Configuration ────────────────────────────────────────────────────────────
 *
 * Keys can be supplied two ways:
 *
 *   1. **Bring-Your-Own-Key (recommended for the public demo):**
 *      Stored in `localStorage` under the key `araas.llm.config` via the
 *      ChatbotPanel settings modal. Never leaves the user's browser.
 *
 *   2. **Build-time Vite env vars** (`.env.local` or GitHub Actions secrets
 *      injected at build time):
 *        - `VITE_LLM_PROVIDER`     — 'openai' | 'gemini' | 'anthropic' | 'mock'
 *        - `VITE_LLM_MODEL`        — model id (e.g. 'gpt-4o-mini')
 *        - `VITE_OPENAI_API_KEY`
 *        - `VITE_GEMINI_API_KEY`
 *        - `VITE_ANTHROPIC_API_KEY`
 *
 *      ⚠️  WARNING: Any `VITE_*` variable is **bundled into the client
 *      JavaScript** and visible to anyone who loads the site. Only use
 *      build-time env vars for personal/internal deployments. For the
 *      public demo, prefer BYOK.
 */

// ── Default models ───────────────────────────────────────────────────────────

export const DEFAULT_MODELS = {
  openai:    'gpt-4o-mini',
  gemini:    'gemini-1.5-flash-latest',
  anthropic: 'claude-3-5-haiku-latest',
  mock:      'mock-1',
}

export const PROVIDERS = ['openai', 'gemini', 'anthropic', 'mock']

const LS_KEY = 'araas.llm.config'

function uid(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ── Config persistence (BYOK) ────────────────────────────────────────────────

/**
 * Read the persisted LLM config from localStorage, falling back to
 * Vite-injected build-time env vars and finally to a mock provider.
 * @returns {{provider:string, model:string, apiKey:string}}
 */
export function loadConfig() {
  let stored = {}
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)
    if (raw) stored = JSON.parse(raw)
  } catch { /* ignore corrupt JSON */ }

  const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
  const envProvider = env.VITE_LLM_PROVIDER
  const envModel    = env.VITE_LLM_MODEL
  const envKeyMap   = {
    openai:    env.VITE_OPENAI_API_KEY,
    gemini:    env.VITE_GEMINI_API_KEY,
    anthropic: env.VITE_ANTHROPIC_API_KEY,
  }

  const provider = stored.provider
    || envProvider
    || (envKeyMap.openai ? 'openai'
        : envKeyMap.gemini ? 'gemini'
        : envKeyMap.anthropic ? 'anthropic'
        : 'mock')

  const apiKey = stored.apiKey || envKeyMap[provider] || ''
  const model  = stored.model || envModel || DEFAULT_MODELS[provider] || ''

  return { provider, model, apiKey }
}

/**
 * Persist BYOK config to localStorage. Pass `null` to clear.
 *
 * NOTE on intentional design choice — Bring-Your-Own-Key (BYOK) for a
 * fully client-side app *must* persist somewhere reachable by JavaScript
 * if we want the key to survive a page reload. Both `localStorage` and
 * `sessionStorage` store data in clear text by design — encrypting with a
 * key that also lives in the browser would only obscure, not protect.
 * The user explicitly opts in by pasting their key into the settings
 * modal, the value never leaves their browser except to reach the
 * provider they selected, and clearing the key is one click away. This
 * is the same pattern used by virtually every BYOK web tool (e.g.
 * playgrounds, in-browser IDE assistants).
 *
 * If you fork this for a multi-tenant production deployment, do not
 * embed real keys at build time — instead front the LLM with a small
 * server-side proxy that holds keys and authenticates users.
 *
 * @param {{provider:string, model:string, apiKey:string}|null} cfg
 */
export function saveConfig(cfg) {
  try {
    if (cfg === null) {
      localStorage.removeItem(LS_KEY)
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(cfg))
    }
  } catch { /* storage may be disabled */ }
}

/** True if the active config has a usable API key (or is mock). */
export function isConfigured(cfg = loadConfig()) {
  return cfg.provider === 'mock' || Boolean(cfg.apiKey)
}

// ── Unified message types ────────────────────────────────────────────────────
//
// Internal canonical shape:
//   { role: 'system'|'user'|'assistant'|'tool',
//     content: string,
//     tool_calls?: [{ id, name, arguments(object) }],
//     tool_call_id?: string,    // for role='tool' results
//     name?: string }
//
// Each provider-specific call adapter translates to/from this shape.

// ── OpenAI adapter ───────────────────────────────────────────────────────────

async function callOpenAI({ apiKey, model, messages, tools, temperature }) {
  const oaiTools = tools?.length
    ? tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))
    : undefined

  const oaiMessages = messages.map(m => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content }
    }
    if (m.tool_calls?.length) {
      return {
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) },
        })),
      }
    }
    return { role: m.role, content: m.content }
  })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: oaiMessages,
      tools: oaiTools,
      temperature: temperature ?? 0.4,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 240)}`)
  }
  const data = await res.json()
  const choice = data.choices?.[0]?.message || {}
  const tool_calls = (choice.tool_calls || []).map(tc => ({
    id: tc.id,
    name: tc.function?.name,
    arguments: safeJSON(tc.function?.arguments),
  }))
  return {
    role: 'assistant',
    content: choice.content || '',
    tool_calls: tool_calls.length ? tool_calls : undefined,
  }
}

// ── Anthropic adapter ────────────────────────────────────────────────────────

async function callAnthropic({ apiKey, model, messages, tools, temperature }) {
  // Anthropic separates system from messages and uses content blocks.
  const system = messages.find(m => m.role === 'system')?.content || ''
  const conv   = messages.filter(m => m.role !== 'system')

  const aMsgs = conv.map(m => {
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: m.tool_call_id,
          content: m.content,
        }],
      }
    }
    if (m.tool_calls?.length) {
      const blocks = []
      if (m.content) blocks.push({ type: 'text', text: m.content })
      m.tool_calls.forEach(tc => blocks.push({
        type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments ?? {},
      }))
      return { role: 'assistant', content: blocks }
    }
    return { role: m.role, content: m.content }
  })

  const aTools = tools?.length
    ? tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }))
    : undefined

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      system,
      messages: aMsgs,
      tools: aTools,
      temperature: temperature ?? 0.4,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 240)}`)
  }
  const data = await res.json()
  let text = ''
  const tool_calls = []
  for (const block of data.content || []) {
    if (block.type === 'text') text += block.text
    else if (block.type === 'tool_use') {
      tool_calls.push({ id: block.id, name: block.name, arguments: block.input || {} })
    }
  }
  return {
    role: 'assistant',
    content: text,
    tool_calls: tool_calls.length ? tool_calls : undefined,
  }
}

// ── Gemini adapter ───────────────────────────────────────────────────────────

async function callGemini({ apiKey, model, messages, tools, temperature }) {
  const systemText = messages.find(m => m.role === 'system')?.content || ''
  const conv       = messages.filter(m => m.role !== 'system')

  const contents = conv.map(m => {
    if (m.role === 'tool') {
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            name: m.name || 'tool',
            response: { content: m.content },
          },
        }],
      }
    }
    if (m.tool_calls?.length) {
      const parts = []
      if (m.content) parts.push({ text: m.content })
      m.tool_calls.forEach(tc => parts.push({
        functionCall: { name: tc.name, args: tc.arguments ?? {} },
      }))
      return { role: 'model', parts }
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }
  })

  const gTools = tools?.length
    ? [{
        functionDeclarations: tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }]
    : undefined

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
      contents,
      tools: gTools,
      generationConfig: { temperature: temperature ?? 0.4 },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 240)}`)
  }
  const data = await res.json()
  const cand = data.candidates?.[0]
  const parts = cand?.content?.parts || []
  let text = ''
  const tool_calls = []
  parts.forEach(p => {
    if (p.text) text += p.text
    if (p.functionCall) {
      tool_calls.push({
        id: uid('gemini'),
        name: p.functionCall.name,
        arguments: p.functionCall.args || {},
      })
    }
  })
  return {
    role: 'assistant',
    content: text,
    tool_calls: tool_calls.length ? tool_calls : undefined,
  }
}

// ── Mock adapter (offline / no-key fallback) ─────────────────────────────────

async function callMock({ messages, tools }) {
  // Echoes the last user message and, when tools are available, makes a
  // single naive tool call so the demo flow still exercises the agent loop.
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const text = lastUser?.content?.toLowerCase() || ''

  if (tools?.length) {
    if (/match|rank|score|fit/.test(text)) {
      return mockAssistant('', [{ name: 'rank_candidates_for_job', arguments: { topK: 5 } }])
    }
    if (/candidate|search|find/.test(text)) {
      return mockAssistant('', [{ name: 'search_candidates', arguments: { query: text.slice(0, 80), topK: 5 } }])
    }
    if (/analytic|stats|pipeline|funnel/.test(text)) {
      return mockAssistant('', [{ name: 'get_pipeline_stats', arguments: {} }])
    }
    if (/job/.test(text)) {
      return mockAssistant('', [{ name: 'list_jobs', arguments: {} }])
    }
  }
  return mockAssistant(
    "I'm running in offline demo mode without an LLM key. Open the ⚙️ settings to add an OpenAI / Gemini / Anthropic key for full agentic capabilities. Meanwhile I can still demo tool calls — try asking me to *rank candidates* or *show pipeline stats*."
  )
}

function mockAssistant(content, tool_calls) {
  return {
    role: 'assistant',
    content,
    tool_calls: tool_calls?.length
      ? tool_calls.map(t => ({ id: uid('mock'), ...t }))
      : undefined,
  }
}

// ── Public dispatch ──────────────────────────────────────────────────────────

/**
 * Send a chat completion request to the configured provider.
 *
 * @param {object}   params
 * @param {object}   params.config      { provider, model, apiKey }
 * @param {Array}    params.messages    canonical messages
 * @param {Array=}   params.tools       tool defs ({ name, description, parameters })
 * @param {number=}  params.temperature
 * @returns {Promise<{role:'assistant', content:string, tool_calls?:Array}>}
 */
export async function chatComplete({ config, messages, tools, temperature }) {
  const cfg = config || loadConfig()
  const provider = cfg.provider || 'mock'
  const model    = cfg.model    || DEFAULT_MODELS[provider]
  const apiKey   = cfg.apiKey   || ''

  if (provider !== 'mock' && !apiKey) {
    throw new Error(`No API key configured for provider "${provider}". Open chatbot ⚙️ settings to add one.`)
  }

  switch (provider) {
    case 'openai':    return callOpenAI({ apiKey, model, messages, tools, temperature })
    case 'gemini':    return callGemini({ apiKey, model, messages, tools, temperature })
    case 'anthropic': return callAnthropic({ apiKey, model, messages, tools, temperature })
    case 'mock':      return callMock({ messages, tools })
    default:          throw new Error(`Unknown LLM provider: ${provider}`)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeJSON(s) {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}
