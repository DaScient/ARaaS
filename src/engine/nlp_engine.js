/**
 * nlp_engine.js — Client-Side NLP & NER Utilities
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Provides lightweight Named Entity Recognition (NER) and keyword extraction
 * running entirely in the browser — no server required.  Uses regex-based
 * pattern matching and curated domain lexicons so the pipeline works on
 * GitHub Pages without any backend.
 */

// ── Lexicons ──────────────────────────────────────────────────────────────────

/** Functional / technical skills vocabulary */
const TECHNICAL_SKILLS = new Set([
  'python','java','javascript','typescript','sql','r','scala','go','rust','c++',
  'c#','html','css','bash','shell','spark','hadoop','kafka','airflow','dbt',
  'tensorflow','pytorch','keras','scikit-learn','pandas','numpy','scipy',
  'matplotlib','seaborn','plotly','sklearn','xgboost','lightgbm','catboost',
  'mlops','docker','kubernetes','terraform','aws','gcp','azure','bigquery',
  'snowflake','databricks','fastapi','flask','django','react','vue','node',
  'graphql','rest','git','ci/cd','jenkins','github actions','tableau','powerbi',
  'looker','excel','nlp','transformers','bert','gpt','llm','embeddings','rag',
  'vector search','retrieval','computer vision','opencv','object detection',
  'segmentation','pytorch lightning','hugging face','langchain','openai',
  'recommender systems','feature engineering','feature store','experimentation',
  'a/b testing','causal inference','time series','forecasting','statistics',
  'linear algebra','probability','bayesian','optimization','deep learning',
  'reinforcement learning','multimodal','text mining','sentiment analysis',
])

/** Behavioral / soft skills vocabulary */
const BEHAVIORAL_SKILLS = new Set([
  'communication','leadership','collaboration','problem solving','critical thinking',
  'creativity','adaptability','time management','project management','mentoring',
  'stakeholder management','presentation','analytical','detail-oriented',
  'self-motivated','teamwork','ownership','strategic thinking','execution',
  'cross-functional','agile','scrum','kanban','product sense',
])

/** Job title tokens */
const TITLE_TOKENS = new Set([
  'scientist','engineer','analyst','developer','architect','manager','director',
  'vp','cto','ceo','coo','lead','senior','junior','staff','principal','head',
  'associate','intern','consultant','specialist','researcher','strategist',
])

/** Education degree tokens */
const DEGREE_TOKENS = new Set([
  'bachelor','master','phd','doctorate','bs','ms','ba','ma','mba','bsc','msc',
  'beng','meng','b.s.','m.s.','b.a.','m.a.','ph.d','associate',
])

/** Field-of-study tokens */
const FIELD_TOKENS = new Set([
  'computer science','data science','statistics','mathematics','engineering',
  'information systems','machine learning','artificial intelligence','physics',
  'economics','business','finance','operations research','bioinformatics',
  'computational linguistics','cognitive science',
])

// ── Patterns ─────────────────────────────────────────────────────────────────

const RX_YEARS_EXP = /(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)/gi
const RX_EMAIL     = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi
const RX_PHONE     = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g
const RX_URL       = /https?:\/\/\S+/gi

// ── Main Extract Function ─────────────────────────────────────────────────────

/**
 * Extract NER entities from a raw text string.
 *
 * @param {string} text  Raw resume / job description text
 * @returns {{
 *   technicalSkills: string[],
 *   behavioralSkills: string[],
 *   titles: string[],
 *   degrees: string[],
 *   fields: string[],
 *   yearsExperience: number|null,
 *   emails: string[],
 *   phones: string[],
 *   urls: string[],
 * }}
 */
export function extractEntities(text = '') {
  const lower = text.toLowerCase()
  const words = lower.match(/\b[\w./-]+\b/g) || []
  const wordSet = new Set(words)

  // Bigram tokens for multi-word skills
  const bigrams = []
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`)
  }
  const bigramSet = new Set(bigrams)

  const technicalSkills = [
    ...TECHNICAL_SKILLS,
  ].filter(s => s.includes(' ') ? bigramSet.has(s) : wordSet.has(s))

  const behavioralSkills = [
    ...BEHAVIORAL_SKILLS,
  ].filter(s => s.includes(' ') ? bigramSet.has(s) : wordSet.has(s))

  const titles = [...TITLE_TOKENS].filter(t => wordSet.has(t))
  const degrees = [...DEGREE_TOKENS].filter(d => wordSet.has(d))
  const fields = [...FIELD_TOKENS].filter(f => bigramSet.has(f) || wordSet.has(f))

  const yearsMatch = RX_YEARS_EXP.exec(text)
  const yearsExperience = yearsMatch ? parseInt(yearsMatch[1], 10) : null

  return {
    technicalSkills,
    behavioralSkills,
    titles,
    degrees,
    fields,
    yearsExperience,
    emails:  text.match(RX_EMAIL) || [],
    phones:  text.match(RX_PHONE) || [],
    urls:    text.match(RX_URL)   || [],
  }
}

// ── Intent Detection (Chatbot NER) ────────────────────────────────────────────

const INTENT_PATTERNS = [
  { intent: 'ask_ctc',         rx: /\b(ctc|salary|compensation|package|pay)\b/i },
  { intent: 'ask_notice',      rx: /\b(notice|period|joining|available)\b/i },
  { intent: 'ask_location',    rx: /\b(locat|remote|hybrid|onsite|relocat|city|country)\b/i },
  { intent: 'ask_experience',  rx: /\b(experienc|years|worked)\b/i },
  { intent: 'ask_skills',      rx: /\b(skill|tech|stack|know|expert|proficient)\b/i },
  { intent: 'ask_education',   rx: /\b(degree|college|university|school|study|major)\b/i },
  { intent: 'ask_visa',        rx: /\b(visa|authoriz|citizen|work permit|sponsorship)\b/i },
  { intent: 'confirm_yes',     rx: /\b(yes|yep|sure|absolutely|correct|right|ok)\b/i },
  { intent: 'confirm_no',      rx: /\b(no|nope|not|never|none)\b/i },
]

/**
 * Detect the dominant intent in a user utterance.
 *
 * @param {string} utterance
 * @returns {string}  intent label, or 'general' if nothing matches
 */
export function detectIntent(utterance = '') {
  for (const { intent, rx } of INTENT_PATTERNS) {
    if (rx.test(utterance)) return intent
  }
  return 'general'
}

/**
 * Anonymise PII from text for audit/logging.
 * Replaces emails, phones and URLs with placeholder tokens.
 *
 * @param {string} text
 * @returns {string}
 */
export function redactPII(text = '') {
  return text
    .replace(RX_EMAIL, '[EMAIL]')
    .replace(RX_PHONE, '[PHONE]')
    .replace(RX_URL,   '[URL]')
}
