/**
 * agent_tools.js — Tool registry for the ARaaS agentic chatbot
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Each tool has:
 *   - name         (string, machine id used by the LLM)
 *   - description  (string, prompted to the LLM)
 *   - parameters   (JSON-schema fragment for function-calling)
 *   - run(args, ctx) → object  (returns a JSON-serialisable result;
 *                               the agent loop stringifies it back to the LLM)
 *
 * `ctx` carries app data and user config:
 *   { candidates, jobs, applications, screeningProfile }
 *
 * All tools are pure functions over the in-memory dataset — no network
 * calls — so the chatbot stays consistent with the rest of the GitHub
 * Pages-hosted, serverless ARaaS demo.
 */
import { rankCandidates, rankJobsForCandidate } from './DNN_Sim.js'
import { extractEntities, redactPII } from './nlp_engine.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const truthy = v => v !== undefined && v !== null && v !== ''

function findJob(jobs, query) {
  if (!truthy(query)) return null
  const q = String(query).toLowerCase()
  return jobs.find(j =>
    String(j.job_id) === q ||
    (j.role && j.role.toLowerCase().includes(q)),
  ) || null
}

function findCandidate(candidates, query) {
  if (!truthy(query)) return null
  const q = String(query).toLowerCase()
  return candidates.find(c =>
    String(c.candidate_id) === q ||
    (c.name && c.name.toLowerCase().includes(q)),
  ) || null
}

function slim(c) {
  return {
    candidate_id: c.candidate_id,
    name: c.name,
    location: c.location,
    seniority: c.seniority,
    years_experience: c.years_experience,
    degree: c.degree,
    field_of_study: c.field_of_study,
    skills: c.skills,
    salary_expectation: c.salary_expectation,
    work_preference: c.work_preference,
    timezone: c.timezone,
    notice_period_days: c.notice_period_days,
    availability_band: c.availability_band,
    interview_window: c.interview_window,
    calendar_preference: c.calendar_preference,
  }
}

function slimJob(j) {
  return {
    job_id: j.job_id,
    role: j.role,
    location: j.location,
    department: j.department,
    seniority_required: j.seniority_required,
    required_years: j.required_years,
    degree_required: j.degree_required,
    skills_required: j.skills_required,
    salary_range: j.salary_range,
  }
}

// ── Tool definitions ─────────────────────────────────────────────────────────

export const TOOLS = [
  {
    name: 'get_recruiter_resources',
    description: 'List recruiter playbooks/checklists/templates available inside ARaaS for interviews, compliance, compensation, or scheduling.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter like Interviewing, Compliance, Compensation, Operations' },
      },
    },
    run({ category }, { recruiterResources = [] }) {
      let resources = recruiterResources
      if (truthy(category)) {
        resources = resources.filter(r => (r.category || '').toLowerCase().includes(category.toLowerCase()))
      }
      return { count: resources.length, resources }
    },
  },

  {
    name: 'list_jobs',
    description: 'List open jobs. Use this when the user asks what roles are available, or before referring to a specific job.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Optional substring filter on job location' },
        department: { type: 'string', description: 'Optional substring filter on department' },
      },
    },
    run({ location, department }, { jobs }) {
      let out = jobs
      if (truthy(location))   out = out.filter(j => (j.location   || '').toLowerCase().includes(location.toLowerCase()))
      if (truthy(department)) out = out.filter(j => (j.department || '').toLowerCase().includes(department.toLowerCase()))
      return { count: out.length, jobs: out.map(slimJob) }
    },
  },

  {
    name: 'get_job',
    description: 'Retrieve full details (including description) of a single job by id or role substring.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Job id or role substring' } },
      required: ['query'],
    },
    run({ query }, { jobs }) {
      const job = findJob(jobs, query)
      if (!job) return { error: `No job matching "${query}"` }
      return { job }
    },
  },

  {
    name: 'find_quick_start_candidates',
    description: 'Find candidates who can start soon based on notice period and optional timezone/work-preference filters.',
    parameters: {
      type: 'object',
      properties: {
        maxNoticeDays: { type: 'integer', description: 'Maximum notice period in days (default 30)' },
        timezone: { type: 'string', description: 'Optional timezone token filter, e.g. PT or ET' },
        workPreference: { type: 'string', description: 'Optional filter: Remote, Hybrid, or On-site' },
        topK: { type: 'integer', description: 'How many candidates to return (default 8, max 25)' },
      },
    },
    run({ maxNoticeDays = 30, timezone, workPreference, topK = 8 }, { candidates }) {
      const cap = Math.max(1, Math.min(25, Math.floor(topK) || 8))
      const maxNotice = Math.max(0, Math.floor(maxNoticeDays) || 30)
      let out = candidates.filter(c => Number(c.notice_period_days || 999) <= maxNotice)
      if (truthy(timezone)) {
        out = out.filter(c => String(c.timezone || '').toLowerCase().includes(String(timezone).toLowerCase()))
      }
      if (truthy(workPreference)) {
        out = out.filter(c => String(c.work_preference || '').toLowerCase().includes(String(workPreference).toLowerCase()))
      }
      out = out
        .sort((a, b) => Number(a.notice_period_days || 999) - Number(b.notice_period_days || 999))
        .slice(0, cap)
        .map(slim)
      return { count: out.length, maxNoticeDays: maxNotice, candidates: out }
    },
  },

  {
    name: 'search_candidates',
    description: 'Search candidates by free-text query (matched against skills, resume text, location, field). Returns up to topK results.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query, e.g. "senior pytorch nlp remote"' },
        topK:  { type: 'integer', description: 'Max candidates to return (default 5, max 25)' },
      },
      required: ['query'],
    },
    run({ query, topK = 5 }, { candidates }) {
      const k = Math.max(1, Math.min(25, Math.floor(topK) || 5))
      const q = (query || '').toLowerCase()
      const terms = q.split(/\s+/).filter(Boolean)
      const scored = candidates
        .map(c => {
          const hay = `${c.name} ${c.location} ${c.skills} ${c.resume_text} ${c.field_of_study} ${c.degree} ${c.seniority}`.toLowerCase()
          const hits = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
          return { c, hits }
        })
        .filter(x => x.hits > 0)
        .sort((a, b) => b.hits - a.hits)
        .slice(0, k)
        .map(x => slim(x.c))
      return { count: scored.length, query, candidates: scored }
    },
  },

  {
    name: 'get_candidate',
    description: 'Retrieve full profile of a single candidate by id or name substring (PII redacted).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    run({ query }, { candidates }) {
      const c = findCandidate(candidates, query)
      if (!c) return { error: `No candidate matching "${query}"` }
      return {
        candidate: {
          ...slim(c),
          resume_text: redactPII(c.resume_text || ''),
        },
      }
    },
  },

  {
    name: 'rank_candidates_for_job',
    description: 'Run the ARaaS DNN matching engine to rank candidates for a specific job. Returns top matches with skill / education / experience subscores. Use this when the user asks who fits a role, who to interview, or for shortlists.',
    parameters: {
      type: 'object',
      properties: {
        job:  { type: 'string',  description: 'Job id or role substring (omit to use first job)' },
        topK: { type: 'integer', description: 'How many candidates to return (default 5, max 20)' },
      },
    },
    run({ job, topK = 5 }, { candidates, jobs }) {
      const k = Math.max(1, Math.min(20, Math.floor(topK) || 5))
      const target = findJob(jobs, job) || jobs[0]
      if (!target) return { error: 'No jobs available' }
      const ranked = rankCandidates(candidates, target).slice(0, k).map(c => ({
        candidate_id:    c.candidate_id,
        name:            c.name,
        location:        c.location,
        seniority:       c.seniority,
        years:           c.years_experience,
        matchScore:      c.matchScore,
        skillScore:      c.skillScore,
        educationScore:  c.educationScore,
        experienceScore: c.experienceScore,
      }))
      return { job: slimJob(target), topMatches: ranked }
    },
  },

  {
    name: 'rank_jobs_for_candidate',
    description: 'Reverse match: given a candidate, rank all open jobs by fit. Useful for career-coaching style questions.',
    parameters: {
      type: 'object',
      properties: {
        candidate: { type: 'string', description: 'Candidate id or name substring' },
        topK:      { type: 'integer' },
      },
      required: ['candidate'],
    },
    run({ candidate, topK = 5 }, { candidates, jobs }) {
      const c = findCandidate(candidates, candidate)
      if (!c) return { error: `No candidate matching "${candidate}"` }
      const k = Math.max(1, Math.min(20, Math.floor(topK) || 5))
      const ranked = rankJobsForCandidate(c, jobs).slice(0, k).map(j => ({
        job_id: j.job_id, role: j.role, location: j.location, matchScore: j.matchScore,
      }))
      return { candidate: slim(c), topJobs: ranked }
    },
  },

  {
    name: 'get_pipeline_stats',
    description: 'Return aggregate analytics: candidates by stage, applications by source, average salary offered, recent activity. Use whenever the user asks about pipeline / funnel / metrics / KPIs.',
    parameters: { type: 'object', properties: {} },
    run(_args, { candidates, jobs, applications }) {
      const byStage = {}
      const bySource = {}
      let salarySum = 0
      let salaryCount = 0
      for (const a of applications) {
        byStage[a.stage]   = (byStage[a.stage]   || 0) + 1
        bySource[a.source] = (bySource[a.source] || 0) + 1
        if (typeof a.salary_offered === 'number') {
          salarySum += a.salary_offered
          salaryCount++
        }
      }
      return {
        totals: {
          candidates: candidates.length,
          jobs: jobs.length,
          applications: applications.length,
        },
        applicationsByStage: byStage,
        applicationsBySource: bySource,
        avgSalaryOffered: salaryCount ? Math.round(salarySum / salaryCount) : null,
      }
    },
  },

  {
    name: 'extract_entities_from_text',
    description: 'Run client-side NER over arbitrary text (e.g. a pasted resume snippet) and return structured entities. PII (emails, phones, URLs) is automatically redacted before extraction.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Raw text to analyse' } },
      required: ['text'],
    },
    run({ text }) {
      return { entities: extractEntities(redactPII(text || '')) }
    },
  },

  {
    name: 'record_screening_answer',
    description: 'Record a candidate-provided screening answer (location / experience / skills / education / salary / notice). Returns the running profile so the agent can decide what to ask next.',
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          enum: ['location','experience','skills','education','salary','notice'],
        },
        value: { type: 'string' },
      },
      required: ['field', 'value'],
    },
    run({ field, value }, ctx) {
      ctx.screeningProfile = ctx.screeningProfile || {}
      ctx.screeningProfile[field] = value
      const required = ['location','experience','skills','education','salary','notice']
      const missing  = required.filter(f => !truthy(ctx.screeningProfile[f]))
      return { profile: ctx.screeningProfile, missing, complete: missing.length === 0 }
    },
  },

  {
    name: 'suggest_interview_slots',
    description: 'Suggest a few interview slots over the next business week. Demo-only — no calendar is actually written.',
    parameters: {
      type: 'object',
      properties: { count: { type: 'integer', description: 'How many slots (default 3)' } },
    },
    run({ count = 3 }) {
      const slots = []
      const now = new Date()
      let d = new Date(now)
      d.setHours(10, 0, 0, 0)
      while (slots.length < Math.min(8, Math.floor(count) || 3)) {
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
        const dow = d.getDay()
        if (dow === 0 || dow === 6) continue
        slots.push(d.toISOString().slice(0, 16) + ' UTC')
      }
      return { suggested: slots }
    },
  },

  {
    name: 'build_calendar_payload',
    description: 'Create a calendar-event payload preview for interview scheduling (Google/Outlook compatible fields, demo only).',
    parameters: {
      type: 'object',
      properties: {
        candidate: { type: 'string', description: 'Candidate id or name substring' },
        job: { type: 'string', description: 'Job id or role substring' },
        slotIso: { type: 'string', description: 'Interview start datetime in ISO format (optional)' },
        provider: { type: 'string', description: 'Calendar provider, e.g. google or outlook' },
        interviewType: { type: 'string', description: 'Interview type label' },
      },
      required: ['candidate'],
    },
    run({ candidate, job, slotIso, provider = 'google', interviewType = 'Technical Interview' }, { candidates, jobs }) {
      const c = findCandidate(candidates, candidate)
      if (!c) return { error: `No candidate matching "${candidate}"` }
      const targetJob = findJob(jobs, job) || jobs[0]
      if (!targetJob) return { error: 'No jobs available' }
      const start = slotIso ? new Date(slotIso) : new Date(Date.now() + 48 * 60 * 60 * 1000)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      return {
        provider: String(provider).toLowerCase(),
        event: {
          title: `${interviewType} · ${targetJob.role}`,
          start: start.toISOString(),
          end: end.toISOString(),
          attendees: [`candidate-${c.candidate_id}@redacted.local`, 'hiring-panel@company.local'],
          location: c.work_preference === 'On-site' ? targetJob.location : 'Video conference link',
          timezone: c.timezone || 'UTC',
          metadata: {
            candidate_id: c.candidate_id,
            job_id: targetJob.job_id,
            calendar_preference: c.calendar_preference || 'Either',
            interview_window: c.interview_window || 'Flexible',
          },
        },
      }
    },
  },
]

/** Fast lookup by name. */
export const TOOL_INDEX = Object.fromEntries(TOOLS.map(t => [t.name, t]))
