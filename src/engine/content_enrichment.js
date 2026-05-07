/**
 * content_enrichment.js — In-memory dataset enrichment helpers
 * ARaaS | DaScient, LLC — Proprietary
 */

const TIMEZONES = ['PT', 'MT', 'CT', 'ET', 'UTC']
const WORK_PREFS = ['Remote', 'Hybrid', 'On-site']
const LANG_PROFILES = [
  ['English'],
  ['English', 'Spanish'],
  ['English', 'French'],
  ['English', 'Hindi'],
  ['English', 'Mandarin'],
]
const CERT_PROFILES = [
  ['AWS ML Specialty'],
  ['Google Professional ML Engineer'],
  ['Azure AI Engineer Associate'],
  ['Databricks ML Associate'],
  ['TensorFlow Developer Certificate'],
]
const INTERVIEW_WINDOWS = [
  'Weekday mornings (local time)',
  'Weekday afternoons (local time)',
  'Weekday evenings (local time)',
  'Flexible across business hours',
  'Tue/Thu preferred',
]
const CALENDAR_PREFS = ['Google Calendar', 'Microsoft Outlook', 'Either']
const NOTICE_DAYS = [14, 21, 30, 45, 60]
const FAST_NOTICE_THRESHOLD = NOTICE_DAYS[1]
const MEDIUM_NOTICE_THRESHOLD = NOTICE_DAYS[2]

function stableKey(candidate, idx) {
  if (Number.isFinite(Number(candidate?.candidate_id))) return Number(candidate.candidate_id)
  const text = `${candidate?.name || ''}|${candidate?.email_hash || ''}|${candidate?.college || ''}|${idx}`
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash
}

export function enrichCandidates(candidates = []) {
  return candidates.map((c, idx) => {
    const key = stableKey(c, idx)
    const notice = NOTICE_DAYS[key % NOTICE_DAYS.length]
    return {
      ...c,
      work_preference: WORK_PREFS[key % WORK_PREFS.length],
      timezone: TIMEZONES[key % TIMEZONES.length],
      languages: LANG_PROFILES[key % LANG_PROFILES.length],
      certifications: CERT_PROFILES[key % CERT_PROFILES.length],
      notice_period_days: notice,
      interview_window: INTERVIEW_WINDOWS[key % INTERVIEW_WINDOWS.length],
      calendar_preference: CALENDAR_PREFS[key % CALENDAR_PREFS.length],
      portfolio_focus: ['ML Platform', 'Applied NLP', 'Computer Vision', 'Analytics', 'Recommenders'][key % 5],
      availability_band: notice <= FAST_NOTICE_THRESHOLD ? '0-3 weeks'
        : notice <= MEDIUM_NOTICE_THRESHOLD ? '3-4 weeks'
        : '4+ weeks',
    }
  })
}
