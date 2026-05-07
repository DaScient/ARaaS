/**
 * DNN_Sim.js — Deep Neural Network-Inspired Candidate Matching Engine
 * ARaaS | DaScient, LLC — Proprietary
 *
 * Implements the three-layer weighted matching formula:
 *
 *   MatchingScore = f(W_skill * Score_skill
 *                  + W_edu   * Score_edu
 *                  + W_exp   * Score_exp)
 *
 * All computation runs client-side using TF-IDF cosine similarity so
 * the pipeline works on GitHub Pages without any backend server.
 *
 * References
 * ----------
 * - Salton & Buckley (1988) — TF-IDF weighting schemes
 * - Skillate Matching Algorithm white-paper (described in problem statement)
 */

// ── Stop-words ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'need','dare','ought','used','to','of','in','for','on','with','at','by','from',
  'up','about','into','through','during','including','until','against','among',
  'throughout','despite','towards','upon','concerning','of','to','in','for','on',
  'with','at','by','from','and','but','or','nor','yet','so','as','if','when',
  'than','because','while','although','though','after','before','since','unless',
  'until','where','wherever','that','which','who','whom','whose','this','these',
  'those','i','me','my','we','our','you','your','he','she','it','they','their',
  'what','there','here','how','all','both','each','few','more','most','other',
  'some','such','no','only','same','than','too','very','just','not','also',
])

// ── TF-IDF Utilities ─────────────────────────────────────────────────────────

/**
 * Tokenize and clean a string into an array of non-stop lower-case tokens.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9#+./\-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
}

/**
 * Build a term-frequency map for a single document.
 * @param {string[]} tokens
 * @returns {Map<string,number>}
 */
function termFrequency(tokens) {
  const tf = new Map()
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)
  const max = Math.max(...tf.values(), 1)
  tf.forEach((v, k) => tf.set(k, v / max))   // normalise to [0,1]
  return tf
}

/**
 * Build inverse-document-frequency weights over a corpus.
 * @param {string[][]} tokenArrays  Array of per-document token arrays
 * @returns {Map<string,number>}
 */
function inverseDocFrequency(tokenArrays) {
  const df = new Map()
  const N  = tokenArrays.length
  for (const tokens of tokenArrays) {
    const seen = new Set(tokens)
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1)
  }
  const idf = new Map()
  df.forEach((count, term) => {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1)   // smooth IDF
  })
  return idf
}

/**
 * Compute the TF-IDF vector for a single document.
 * @param {Map<string,number>} tf   Term frequency map
 * @param {Map<string,number>} idf  IDF map from corpus
 * @returns {Map<string,number>}
 */
function tfidfVector(tf, idf) {
  const vec = new Map()
  tf.forEach((tfVal, term) => {
    vec.set(term, tfVal * (idf.get(term) || 1))
  })
  return vec
}

/**
 * Cosine similarity between two sparse TF-IDF vectors.
 * @param {Map<string,number>} a
 * @param {Map<string,number>} b
 * @returns {number}  value in [0, 1]
 */
function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0

  a.forEach((va, term) => {
    dot  += va * (b.get(term) || 0)
    normA += va * va
  })
  b.forEach(vb => { normB += vb * vb })

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ── Three-Layer Score Components ─────────────────────────────────────────────

/**
 * Experience score (0-1):
 *   Combines years-of-experience proximity and title/seniority overlap.
 *
 * @param {object} candidate
 * @param {object} job
 * @returns {number}
 */
function experienceScore(candidate, job) {
  const candYears = candidate.years_experience ?? 0
  const reqYears  = job.required_years ?? 3

  // Proximity: penalise under-qualified, cap reward at 1.5× requirement
  const ratio = candYears / Math.max(reqYears, 1)
  let yearsScore
  if (ratio < 1)       yearsScore = ratio * 0.8          // under-qualified
  else if (ratio <= 2) yearsScore = 0.8 + (ratio - 1) * 0.2  // ideal range
  else                 yearsScore = 1.0                   // over-qualified — still 1

  // Seniority alignment
  const seniorityMap = { intern: 0, junior: 1, mid: 2, senior: 3, lead: 4,
                          principal: 5, staff: 5, director: 6, vp: 7, cto: 8 }
  const cSen = seniorityMap[(candidate.seniority || '').toLowerCase()] ?? 2
  const jSen = seniorityMap[(job.seniority_required || '').toLowerCase()] ?? 2
  const seniorityScore = 1 - Math.min(Math.abs(cSen - jSen) / 4, 1)

  return 0.6 * yearsScore + 0.4 * seniorityScore
}

/**
 * Education score (0-1):
 *   Compares degree level and field relevance to job requirements.
 *
 * @param {object} candidate
 * @param {object} job
 * @returns {number}
 */
function educationScore(candidate, job) {
  const degreeRank = { none: 0, associate: 1, bachelor: 2, master: 3,
                        mba: 3, phd: 4, doctorate: 4 }

  const cDeg = degreeRank[(candidate.degree || '').toLowerCase()] ?? 0
  const jDeg = degreeRank[(job.degree_required || '').toLowerCase()] ?? 2

  // Has at least the required level?
  const levelScore = cDeg >= jDeg ? 1 : cDeg / jDeg

  // Field match: tokenise and intersect
  const cField = tokenize(candidate.field_of_study || '')
  const jField = tokenize(job.preferred_field || '')
  const intersection = cField.filter(t => jField.includes(t)).length
  const fieldScore = jField.length === 0 ? 1
    : intersection / Math.max(jField.length, 1)

  return 0.5 * levelScore + 0.5 * fieldScore
}

/**
 * Skills score (0-1):
 *   TF-IDF cosine similarity between candidate skills/resume text and job
 *   description, blended across functional + behavioral dimensions.
 *
 * @param {object}           candidate
 * @param {object}           job
 * @param {Map<string,number>} idf   Pre-computed corpus IDF
 * @returns {number}
 */
function skillsScore(candidate, job, idf) {
  const candText = `${candidate.skills || ''} ${candidate.resume_text || ''}`
  const jobText  = `${job.description || ''} ${job.skills_required || ''}`

  const candTokens = tokenize(candText)
  const jobTokens  = tokenize(jobText)

  const candTF = tfidfVector(termFrequency(candTokens), idf)
  const jobTF  = tfidfVector(termFrequency(jobTokens),  idf)

  return cosineSimilarity(candTF, jobTF)
}

// ── Main Matching API ─────────────────────────────────────────────────────────

/**
 * Default score weights (sum = 1.0).
 * Organisations can override these via the `weights` parameter.
 */
export const DEFAULT_WEIGHTS = {
  skill:      0.50,   // 50% — most discriminating signal
  education:  0.20,   // 20% — degree / field relevance
  experience: 0.30,   // 30% — years + seniority
}

/**
 * Compute the composite matching score for every candidate against a job.
 *
 * Scoring formula:
 *   MatchingScore = W_skill * Score_skill
 *                + W_edu   * Score_edu
 *                + W_exp   * Score_exp
 *
 * @param {object[]} candidates  Array of candidate records
 * @param {object}   job         Single job record
 * @param {object}   [weights]   Optional weight overrides
 * @returns {object[]}  Candidates sorted by matchScore desc, with added fields:
 *                      matchScore, skillScore, educationScore, experienceScore
 */
export function rankCandidates(candidates, job, weights = DEFAULT_WEIGHTS) {
  const w = { ...DEFAULT_WEIGHTS, ...weights }

  // Build corpus for IDF (all candidates + job)
  const corpus = candidates.map(c =>
    tokenize(`${c.skills || ''} ${c.resume_text || ''}`)
  )
  corpus.push(tokenize(`${job.description || ''} ${job.skills_required || ''}`))
  const idf = inverseDocFrequency(corpus)

  return candidates
    .map(c => {
      const sSk  = skillsScore(c, job, idf)
      const sEdu = educationScore(c, job)
      const sExp = experienceScore(c, job)
      const match = w.skill * sSk + w.education * sEdu + w.experience * sExp

      return {
        ...c,
        skillScore:       Math.round(sSk  * 100),
        educationScore:   Math.round(sEdu * 100),
        experienceScore:  Math.round(sExp * 100),
        matchScore:       Math.round(match * 100),
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
}

/**
 * Rank a single candidate against multiple jobs.
 * Useful for the "candidate card" view.
 *
 * @param {object}   candidate
 * @param {object[]} jobs
 * @param {object}   [weights]
 * @returns {object[]}  Jobs sorted by matchScore desc
 */
export function rankJobsForCandidate(candidate, jobs, weights = DEFAULT_WEIGHTS) {
  return jobs
    .map(job => {
      const corpus = [
        tokenize(`${candidate.skills || ''} ${candidate.resume_text || ''}`),
        tokenize(`${job.description || ''} ${job.skills_required || ''}`),
      ]
      const idf  = inverseDocFrequency(corpus)
      const sSk  = skillsScore(candidate, job, idf)
      const sEdu = educationScore(candidate, job)
      const sExp = experienceScore(candidate, job)
      const match = weights.skill * sSk + weights.education * sEdu + weights.experience * sExp
      return { ...job, matchScore: Math.round(match * 100) }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
}
