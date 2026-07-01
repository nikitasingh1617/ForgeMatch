---
title: ForgeMatch
emoji: 🔥
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

## ForgeMatch — AI-Powered Candidate Ranking System

> Intelligent Resume Ranking • Semantic Search • Explainable AI • Recruiter Assistant

ForgeMatch is an AI-powered candidate ranking platform built for the Redrob AI Hiring Challenge. It combines semantic search, hybrid scoring, evidence-based evaluation, and recruiter-focused explainability to identify the most relevant candidates from massive talent pools.

The system is capable of ranking over **100,000 candidates**, generating the **Top 100 submission CSV**, and providing recruiters with an interactive AI assistant for follow-up questions.

---

# ✨ Features

| Feature | Description |
| :--- | :--- |
|🔍 Semantic Retrieval|Uses all-MiniLM-L6-v2 Sentence Transformers to encode candidate profiles and job descriptions into dense vectors.|
|⚡ High‑Speed Search|FAISS indexes all candidate embeddings for fast approximate nearest‑neighbour retrieval.|
|🧠 Hybrid Ranking Engine|Combines semantic similarity, skill overlap, career relevance, role alignment, evidence validation, project quality, and credibility signals into a single score.|
|📊 Explainable Scoring|Every candidate receives a detailed reasoning field explaining strengths and concerns, mirroring how a human recruiter would evaluate.|
|📈 Evidence‑Based Skill Validation|Skills are only considered “validated” if they appear in project descriptions or work history — not just in the skill list.|
|🎯 Role Alignment Detection|Analyzes candidate career trajectory and specialisation (e.g., AI, Backend, Data) to penalise mismatched profiles.|
|💼 Career Trajectory Analysis|Evaluates progression, consistency, and seniority against the job’s requirements.|
|⭐ Project Quality Assessment|Scores projects on sophistication (use of production‑grade technologies, impact metrics, scale) and adds to the final score.|
|🛡️ Honeypot & Suspicious Profile Detection|Flags profiles with impossible experience claims (e.g., 8 years at a 3‑year‑old company) or inflated skill counts, lowering their rank.|
|📉 Confidence & Credibility Scoring|Assigns a confidence level (High / Moderate / Low) based on evidence and credibility flags.|
|🤖 AI Recruiter Chat Assistant|After ranking, recruiters can ask natural‑language questions (e.g., “Why is #1 ranked higher?”) via an OpenRouter‑powered chat interface.|
|📄 Official Competition CSV Generation|Produces exactly the 100‑row CSV required by the challenge, with candidate_id, rank, score, and reasoning.|
|📚 Ranking History|All rankings are stored with a unique ID, allowing recruiters to revisit past runs and download CSVs.|


---

# 🏗 System Architecture

```text
                        ┌─────────────────────────────┐
                        │  Candidates Dataset (JSONL) │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │   build_index.py (one-time) │
                        │   - Generate embeddings     │
                        │   - Build FAISS index       │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │     Artifacts (./artifacts) │
                        │   - embeddings.npy          │
                        │   - candidate.index         │
                        │   - candidate_ids.json      │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                     run_submission.py                           │
        │                                                                 │
        │  1. Load JD text & candidate pool                               │
        │  2. FAISS search → top‑k candidates (e.g., 2000)                │
        │  3. Hybrid scoring on subset → final Top‑100                    │
        │  4. Generate CSV with reasoning                                 │
        └─────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │   EliteForge.csv (Top‑100)  │
                        └─────────────────────────────┘
```

---

## 🧠 Ranking Pipeline

The ranking engine combines multiple independent signals; no single factor dominates. The final score for each candidate is:
hybrid_score
  skill_alignment × w_skill
  + semantic_similarity × w_sem
  + project_relevance × w_proj_rel
  + evidence_score × w_evidence
  + project_quality × w_proj_qual
  + credibility × w_cred
  + role_alignment × w_role
  + experience_fit × w_exp
  + career_relevance × w_career
  + title_fit × w_title
  + behavioral_signals × w_signal
  + company_context × w_company

Then: apply specialization_penalty, credibility damping, honeypot discount, and dynamic JD‑specific negative signals.


---
---
# Key Scoring Components
|Component|What it measures|
|:--- | :--- |
|Skill Alignment|Fraction of required JD skills present in the candidate’s skill list (normalised).|
|Semantic Similarity|FAISS vector search between candidate and JD embeddings (dense retrieval).|
|Evidence Score|How many of the matched skills appear in project descriptions or work history (validated).|
|Project Quality|Weighted score based on technologies used, scale indicators, and quantified outcomes.|
|Credibility|Penalises inflated skill lists, duplicate entries, impossible salary ranges, etc.|
|Role Alignment|	JD‑driven title‑signal matches (e.g., “AI Engineer”) and domain consistency.|
|Specialisation| Penalty	Penalises candidates whose primary specialisation does not match the JD’s domain.|
|Experience Fit|	Measures years of experience against the JD’s preferred range (band scoring).|
|Career Relevance|	Keyword‑based relevance from career history (fallback for low alignment).|
|Company Context|	Small bonus for product‑company experience, penalty for pure‑consulting background.|
|Behavioral Signals|	Open‑to‑work, notice period, last active, salary expectations, GitHub activity, etc.|
|Dynamic JD Negatives|	Activates when the JD contains disqualifiers (e.g., “no job hoppers”) and checks candidate profile.|
---

# 🤖 AI Recruiter Assistant

After a ranking is generated, recruiters can ask up to 5 free questions via the /chat-ranking endpoint. The chat uses the same ranking data as context and an OpenRouter‑powered LLM to provide recruiter‑friendly answers.

Example questions:

“Why is Candidate A ranked higher than Candidate B?”

“What are the strongest skills of candidate #3?”

“Which projects contributed to the score of the top candidate?”

“Does this candidate fit a Backend Engineer role?”

>⚠️ Important: The LLM is only used for the post‑ranking chat assistant — it never influences the ranking scores. The entire ranking pipeline (embedding, retrieval, scoring) is deterministic, offline, and LLM‑free.

# ⚙️ Tech Stack

## Backend

* Python 3.10+
* FastAPI – REST API for ranking and chat
* Uvicorn – ASGI server

## AI / Machine Learning

* Sentence Transformers (all-MiniLM-L6-v2)
* FAISS (CPU) – approximate nearest neighbour search
* NumPy – vector operations
* OpenRouter API (optional) – for AI chat only (LLM‑free ranking)

## Frontend

* Next.js
* React

---

# 📂 Project Structure

```text
backend/
├── main.py                 # FastAPI entry point
├── build_index.py          # One‑time embedding & FAISS index builder
├── run_submission.py       # Official CSV generator for competition
├── file_parser.py          # Resume parsing (PDF/DOCX/JSON/JSONL)
├── core/
│   ├── ranking.py          # Main ranking logic
│   ├── ranking_dynamic.py  # JD‑driven dynamic scoring
│   ├── ai_chat.py          # AI chat assistant (OpenRouter)
│   └── prompts.py          # Prompt templates for chat
├── artifacts/              # Pre‑computed FAISS index & embeddings
│   ├── candidate.index
│   ├── embeddings.npy
│   ├── candidate_ids.json
│   └── candidate_texts.pkl
├── data/                   # Input data (candidates & JD)
│   ├── candidates.jsonl
│   └── job_description.docx
├── rankings/               # Stored ranking history (JSON)
├── .env                    # API keys (OpenRouter) – not committed
└── requirements.txt
```

---

# 🚀 Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd EliteForge

# 2. Create a virtual environment (optional)
python -m venv venv
source venv/bin/activate   # or `venv\Scripts\activate` on Windows

# 3. Install dependencies
pip install -r requirements.txt
```

---

# ▶️ Run Demo Backend

```bash
uvicorn backend.main:app --reload
```
The server will be available at http://localhost:8000.

---
---
## API ENDPOINTS
|Endpoint|	Method|	Description|
|:---:|:---:|:---|
|/	|GET|	Health check|
|/rank|	POST	|Rank uploaded candidates against a JD (upload JSON/PDF/DOCX)|
|/rankings|	GET|	List all saved rankings|
|/rankings/{ranking_id}|	GET|	Retrieve a specific ranking|
|/rankings/{ranking_id}/export-csv	|GET	|Download Top‑100 CSV for a ranking|
|/chat-ranking|	POST|	Ask the AI assistant about a ranking|
|/dashboard-stats|	GET|	Aggregated stats for the frontend dashboard|


---

## 🏆 Official Competition Submission Pipeline

# Step 1 — Build FAISS Index (One-Time)
This step encodes all candidates and builds the FAISS index. It takes about 1 hour on a typical CPU (e.g., MacBook M1) and should be run only once.

```bash
python backend/build_index.py \
--candidates backend/data/candidates.jsonl
```

This produces:
*embeddings.npy – all candidate embeddings
*candidate.index – FAISS index for fast retrieval
*candidate_ids.json – mapping from index position to candidate_id
*candidate_texts.pkl – raw texts (for debugging)
*Pre-computation may take longer depending on hardware but only needs to be performed once.

---

## Step 2 — Generate Official Submission
This step loads the pre‑built index, performs FAISS search, applies the hybrid ranking, and outputs the exact CSV required by the competition.

```bash
python backend/run_submission.py \
--candidates backend/data/candidates.jsonl \
--jd backend/data/job_description.docx \
--out EliteForge.csv
```

Performance: On a 16 GB RAM CPU machine, ranking 100,000 candidates completes in 70–100 seconds, well within the 5‑minute limit.

---

# 📊 Output Format

The generated CSV contains:

```text
candidate_id
rank
score
reasoning
```

The submission is validated using the official validation script provided by the competition.

---
## 📦 Pre‑computed Artifacts for Reproducibility

Because the 1‑hour build is not repeated, the artifacts/ folder must be provided. We include it in the repository via Git LFS (or as a downloadable asset). The evaluator only needs to run Step 2 to reproduce the submission.

---
## 🧪 Validation & Honeypot Defence
Our ranking naturally filters out honeypot profiles through:

* Credibility scoring – flags impossible experience claims and expert‑skills with <3 months duration.
* Evidence‑based validation – skills that don’t appear in project/work descriptions carry low weight.
* Specialisation mismatch penalty – candidates with irrelevant career histories are penalised.

In our tests, honeypot candidates consistently rank below genuine profiles, keeping the honeypot rate well under the 10% threshold.

## 🌐 Sandbox / Demo Link
We provide a hosted environment where the ranking can be tested on a small sample.
<<<<<<< HEAD
<<<<<<< HEAD
Link: https://forgematch-demo.vercel.app
=======
Link: https://forgematch.vercel.app
>>>>>>> 4c044878e933ba81d5a8ea2080cfa2afaced3542
=======
Link: https://forgematch.vercel.app
>>>>>>> fceb95ad3334fb20af7403614281d734b1e69ab9
The sandbox accepts a sample JSONL file (≤100 candidates) and returns a ranked CSV, demonstrating the system’s end‑to‑end functionality within the compute limits.


---
# 🌟 Key Highlights

* Supports ranking over **100,000 candidates**
* Optimized retrieval using FAISS
* Explainable AI scoring
* Recruiter-focused insights
* Official competition submission pipeline
* Interactive AI assistant for hiring teams


# 📝 Team & Submission Metadata
Team Name : Elite Forge

|Member|Role|
|:---:|:---:|
|Nikita Singh	|Team Lead, Frontend, Backend, AI assistant & Ranking Engine|
|Yashank Sogra|	Frontend, Backend, AI Assistant & Ranking engine|


# 🧾 License
_This project is submitted for the Redrob AI Hiring Challenge. All rights reserved by the team members._

---
