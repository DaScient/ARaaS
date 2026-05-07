/**
 * agent.js — Agentic chat orchestrator
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Runs the canonical "ReAct"-style loop:
 *
 *   user → LLM → (optional tool calls → tool runs → LLM) → final text
 *
 * Provider-agnostic: uses the unified `chatComplete` from llm_engine.js so
 * the same loop works for OpenAI, Gemini, Anthropic, or the offline mock.
 */
import { chatComplete } from './llm_engine.js'
import { TOOLS, TOOL_INDEX } from './agent_tools.js'
import { redactPII } from './nlp_engine.js'

export const SYSTEM_PROMPT = `
You are **ARA**, the agentic recruiting assistant inside ARaaS — DaScient's
Auto-Recruitment-as-a-Service platform.

Your responsibilities:
  • Help recruiters explore the candidate pool, run AI matching, surface
    pipeline analytics, audit bias, and schedule interviews.
  • Help recruiters understand which open roles fit candidates more appropriately and run a friendly
    structured screening (location, experience, skills, education, salary,
    notice period). Use the record_screening_answer tool as you collect
    each field.
  • Be concise (≤ 4 short paragraphs), warm, and specific. Cite candidate
    ids and job ids when relevant. Never invent data — if you do not know,
    call a tool or say so.

Tooling:
  • Prefer calling a tool over guessing. Most factual answers about
    candidates / jobs / applications must come from tools.
  • Chain tools when needed (e.g. list_jobs → rank_candidates_for_job).
  • Never expose raw email addresses, phone numbers or URLs from candidate
    data — they are redacted upstream; do not try to reverse the redaction.

Tone:
  • Professional, friendly, lightly enthusiastic. No emojis
    Intelligent, informative, resourceful. No use of asterisks in text outputs.
    Use markdown lists and proper formatting, when needed. Straight to the point. 
`.trim()

/**
 * Run one user turn through the agent loop, including any tool-call rounds.
 *
 * @param {object} params
 * @param {Array}  params.history       Prior canonical messages (no system).
 * @param {string} params.userText      Raw user input for this turn.
 * @param {object} params.config        LLM config { provider, model, apiKey }.
 * @param {object} params.context       App data { candidates, jobs, applications, screeningProfile }.
 * @param {function=} params.onEvent    Optional progress callback for UI:
 *                                      { type:'thinking'|'tool_call'|'tool_result'|'message', ... }
 * @param {number=} params.maxToolRounds  Safety cap on tool-call iterations.
 * @returns {Promise<{ messages: Array, finalText: string, toolEvents: Array }>}
 *          messages = updated history (excluding the system prompt) to persist.
 */
export async function runAgentTurn({
  history = [],
  userText,
  config,
  context,
  onEvent,
  maxToolRounds = 4,
}) {
  const safeUser = redactPII(userText || '')
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: safeUser },
  ]

  const toolEvents = []
  const emit = ev => { toolEvents.push(ev); onEvent?.(ev) }

  emit({ type: 'thinking' })

  for (let round = 0; round <= maxToolRounds; round++) {
    let assistant
    try {
      assistant = await chatComplete({
        config,
        messages,
        tools: TOOLS,
      })
    } catch (err) {
      const errMsg = `⚠️ ${err.message || 'LLM request failed'}`
      messages.push({ role: 'assistant', content: errMsg })
      emit({ type: 'message', text: errMsg, error: true })
      return finalize(messages, errMsg, toolEvents)
    }

    messages.push(assistant)

    // Done if no further tool calls.
    if (!assistant.tool_calls?.length) {
      emit({ type: 'message', text: assistant.content || '' })
      return finalize(messages, assistant.content || '', toolEvents)
    }

    // Execute each tool call sequentially (deterministic, small dataset).
    for (const call of assistant.tool_calls) {
      emit({ type: 'tool_call', name: call.name, arguments: call.arguments })
      const tool = TOOL_INDEX[call.name]
      let result
      if (!tool) {
        result = { error: `Unknown tool: ${call.name}` }
      } else {
        try {
          result = await tool.run(call.arguments || {}, context)
        } catch (err) {
          result = { error: err.message || 'Tool execution failed' }
        }
      }
      emit({ type: 'tool_result', name: call.name, result })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.name,
        content: JSON.stringify(result),
      })
    }
    // Loop and let the LLM continue with the tool results.
  }

  // Safety: too many tool rounds — synthesise a fallback reply.
  const fallback = "I gathered some data but couldn't compose a final answer. Please rephrase your question."
  messages.push({ role: 'assistant', content: fallback })
  emit({ type: 'message', text: fallback, error: true })
  return finalize(messages, fallback, toolEvents)
}

function finalize(messages, finalText, toolEvents) {
  // Strip the system prompt before returning — caller persists the rest.
  return {
    messages: messages.filter(m => m.role !== 'system'),
    finalText,
    toolEvents,
  }
}
