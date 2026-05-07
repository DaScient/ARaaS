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
│   │   └── nlp_engine.js    # Client-side NER & intent detection
│   ├── components/
│   │   ├── Header.jsx             # Top navigation
│   │   ├── AnalyticsDashboard.jsx # KPIs, time-series, bar charts
│   │   ├── FunnelChart.jsx        # Recruitment pipeline funnel
│   │   ├── CandidateTable.jsx     # AI-ranked candidate table
│   │   ├── JobMatchView.jsx       # JD vs Resume comparison + gap analysis
│   │   ├── ChatbotPanel.jsx       # Conversational AI screening chatbot
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
| **Chatbot** | Conversational AI screening chatbot with real-time NER extraction |
| **Bias Audit** | Gender/ethnicity pie charts, stage representation bars, bias index |
| **Schedule** | Automated interview scheduling with type/interviewer/time-slot selection |

### 🔒 Privacy & Security
- All candidate PII is hashed in the data schema (`email_hash`)
- Demographic signals are monitored for bias but **never** used as ranking inputs
- `redactPII()` utility strips emails, phones, and URLs from chatbot inputs

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
