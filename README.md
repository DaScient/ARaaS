# ARaaS — Recruiter Command Center
> **Auto-Recruitment as a Service** · AI-Powered Talent Sourcing Platform  
> DaScient, LLC — Proprietary

[![Deploy to GitHub Pages](https://github.com/DaScient/ARaaS/actions/workflows/deploy.yml/badge.svg)](https://github.com/DaScient/ARaaS/actions/workflows/deploy.yml)

**Live Demo:** [https://DaScient.github.io/ARaaS/](https://DaScient.github.io/ARaaS/)

---

## Overview

ARaaS is a production-ready, client-side Recruitment as a Service platform. It features an AI-powered candidate matching engine, NLP resume parsing, bias-detection analytics, and a conversational chatbot — all running entirely in the browser via GitHub Pages (no backend required).

---

## Architecture

```
ARaaS/
├── public/data/
│   ├── candidates.json      # 250 synthetic candidate profiles
│   ├── jobs.json            # 8 job postings with three-layer schema
│   └── applications.json   # 600 application records
├── src/
│   ├── engine/
│   │   ├── DNN_Sim.js       # TF-IDF cosine similarity matching engine
│   │   ├── nlp_engine.js    # Client-side NER & intent detection
│   │   ├── llm_engine.js    # Pluggable LLM provider layer (OpenAI/Gemini/Anthropic/mock)
│   │   ├── agent_tools.js   # Tool registry exposed to the agent
│   │   └── agent.js         # Agentic ReAct-style orchestration loop
│   ├── components/
│   │   ├── Header.jsx             # Top navigation
│   │   ├── AnalyticsDashboard.jsx # KPIs, time-series, bar charts
│   │   ├── FunnelChart.jsx        # Recruitment pipeline funnel
│   │   ├── CandidateTable.jsx     # AI-ranked candidate table
│   │   ├── JobMatchView.jsx       # JD vs Resume comparison + gap analysis
│   │   ├── ChatbotPanel.jsx       # Agentic ARA chatbot (multi-LLM, tool-calling)
│   │   ├── BiasAudit.jsx          # Diversity metrics & bias detection
│   │   └── SchedulePanel.jsx      # Automated interview scheduling
│   ├── App.jsx              # Root shell with data fetching
│   └── main.jsx             # React entry point
├── .github/workflows/
│   └── deploy.yml           # CI/CD: build + deploy to GitHub Pages
├── deploy.sh                # Manual deployment script
└── vite.config.js           # Vite + Tailwind CSS configuration
```

---

## Features

### 🤖 AI Matching Engine (`DNN_Sim.js`)
Implements the three-layer weighted scoring formula:

```
MatchingScore = W_skill * Score_skill
              + W_edu   * Score_edu
              + W_exp   * Score_exp
```

- **Skills Score** — TF-IDF cosine similarity between resume text and job description
- **Education Score** — Degree level proximity + field-of-study overlap
- **Experience Score** — Years-of-experience proximity + seniority alignment
- Configurable weight sliders in the UI (default: 50% skill / 20% edu / 30% exp)

### 🔍 NLP Engine (`nlp_engine.js`)
Client-side Named Entity Recognition using curated domain lexicons:
- Technical skills extraction (200+ tokens)
- Behavioral skills detection
- Degree & field-of-study parsing
- PII redaction (`redactPII()`)
- Intent detection for the screening chatbot

### 📊 Recruiter Command Center Tabs
| Tab | Description |
|-----|-------------|
| **Analytics** | KPI cards, monthly application time-series, grouped bar charts, salary distribution |
| **Candidates** | AI-ranked table with match score bars and score breakdown drill-down |
| **Job Match** | Side-by-side JD vs Resume with highlighted token overlaps and gap analysis |
| **Chatbot** | Agentic AI assistant with multi-LLM support (OpenAI / Gemini / Anthropic) and live tool-call tracing |
| **Bias Audit** | Gender/ethnicity pie charts, stage representation bars, bias index |
| **Schedule** | Automated interview scheduling with type/interviewer/time-slot selection |

### 🔒 Privacy & Security
- All candidate PII is hashed in the data schema (`email_hash`)
- Demographic signals are monitored for bias but **never** used as ranking inputs
- `redactPII()` utility strips emails, phones, and URLs from chatbot inputs

---

## 🤖 Agentic Chatbot — ARA

The **Chatbot** tab hosts **ARA**, an agentic recruiting assistant powered by
your choice of LLM. It can autonomously decide when to call tools to answer
factually:

| Tool | What it does |
|------|--------------|
| `list_jobs` / `get_job` | Browse open requisitions |
| `search_candidates` / `get_candidate` | Free-text candidate search (PII-redacted) |
| `rank_candidates_for_job` | Run the DNN_Sim TF-IDF matcher and return top-K matches with subscores |
| `rank_jobs_for_candidate` | Reverse-match a candidate against all open roles |
| `get_pipeline_stats` | Funnel, source breakdown, average salary offered |
| `extract_entities_from_text` | NER over arbitrary text (e.g. pasted resumes) |
| `record_screening_answer` | Multi-turn structured candidate screening |
| `suggest_interview_slots` | Calendar suggestions for the next business week |

The agent loop, tool registry, and provider adapters live in
[`src/engine/`](./src/engine/) (`agent.js`, `agent_tools.js`, `llm_engine.js`).

### Configuring API keys

ARaaS is a fully **client-side** app deployed to GitHub Pages, so any key the
browser uses is, by definition, visible at runtime. Two configuration paths
are supported, in order of preference:

#### 1. Bring-Your-Own-Key (recommended) — `localStorage`

Click the **⚙️** icon in the chatbot header and paste a key. The configuration
is stored only in your browser's `localStorage` (under `araas.llm.config`),
never sent anywhere except the provider you selected, and never committed to
git. This is the right path for the public demo.

Pick one of:

| Provider | Where to get a key | Default model |
|----------|--------------------|---------------|
| **OpenAI** | <https://platform.openai.com/api-keys> | `gpt-4o-mini` |
| **Google Gemini** | <https://aistudio.google.com/app/apikey> | `gemini-1.5-flash-latest` |
| **Anthropic** | <https://console.anthropic.com/settings/keys> | `claude-3-5-haiku-latest` |
| **Mock** | _(no key — offline scripted demo)_ | — |

When no key is configured, ARA runs in **offline demo mode** and exercises a
subset of the tool calls so the experience still works.

#### 2. Build-time env vars (for personal / private deployments)

Copy `.env.example` to `.env.local` and fill in:

```bash
VITE_LLM_PROVIDER=openai           # openai | gemini | anthropic | mock
VITE_LLM_MODEL=gpt-4o-mini         # optional override
VITE_OPENAI_API_KEY=sk-...
VITE_GEMINI_API_KEY=
VITE_ANTHROPIC_API_KEY=
```

> ⚠️ **Vite inlines every `VITE_*` variable into the production bundle.**
> Anyone who loads your site can read these keys. Only use this path for
> personal / internal deployments where the bundle is not publicly hosted —
> for the public GitHub Pages site, leave them blank and rely on BYOK.

##### Wiring keys into GitHub Actions

If you do operate a private fork and want CI builds to embed a key, add it
under **Settings → Secrets and variables → Actions**:

- **Secrets** (encrypted, recommended for keys):
  `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- **Variables** (plain-text, fine for non-secret defaults):
  `LLM_PROVIDER`, `LLM_MODEL`

Then expose them to the build step in `.github/workflows/deploy.yml`:

```yaml
- name: Build
  run: npm run build
  env:
    VITE_LLM_PROVIDER:      ${{ vars.LLM_PROVIDER }}
    VITE_LLM_MODEL:         ${{ vars.LLM_MODEL }}
    VITE_OPENAI_API_KEY:    ${{ secrets.OPENAI_API_KEY }}
    VITE_GEMINI_API_KEY:    ${{ secrets.GEMINI_API_KEY }}
    VITE_ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Again — these end up in the public JS bundle, so do **not** wire production
keys into the upstream public repo's deploy workflow.

---

## Data Schema

### `candidates.json`
```json
{
  "candidate_id": 5001,
  "name": "Alex Chen",
  "email_hash": "sha256_first_16_chars",
  "gender": "Male",
  "ethnicity": "Asian",
  "location": "San Francisco, CA",
  "seniority": "senior",
  "years_experience": 7,
  "degree": "master",
  "field_of_study": "Computer Science",
  "college": "Stanford",
  "skills": "Python PyTorch MLOps Docker Kubernetes",
  "resume_text": "Built end-to-end NLP pipelines using transformers…",
  "source": "LinkedIn",
  "salary_expectation": 175000
}
```

### `jobs.json`
Three-layer matching signals per posting:
```json
{
  "job_id": 1001,
  "role": "Senior Data Scientist",
  "seniority_required": "senior",
  "required_years": 5,
  "degree_required": "master",
  "preferred_field": "Data Science Statistics Computer Science",
  "skills_required": "Python pandas scikit-learn SQL statistics",
  "description": "Full job description text…"
}
```

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## Deployment

### Automatic (GitHub Actions)
Push to `main` — the workflow in `.github/workflows/deploy.yml` automatically
builds and deploys to GitHub Pages.

### Manual
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Animations | Framer Motion |
| AI Engine | Custom TF-IDF / Cosine Similarity (pure JS) |
| NLP | Regex + domain lexicons (no external model) |
| Deployment | GitHub Pages via Actions |

---

*DaScient, LLC — Proprietary. All rights reserved.*
