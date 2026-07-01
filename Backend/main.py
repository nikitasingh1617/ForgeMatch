from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import json
import re
import os
import uuid
import csv
from datetime import datetime
import fitz
from pydantic import BaseModel
from core.ai_chat import ask_recruiter_ai
from docx import Document
from io import BytesIO
from file_parser import parse_resume_file

from dotenv import load_dotenv

# Load .env from the same directory as main.py
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from core.ranking import rank_candidates, model

app = FastAPI(title="ForgeMatch Ranking API")

# ─── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://forgematch.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RANKINGS_DIR = os.path.join(BASE_DIR, "rankings")
os.makedirs(RANKINGS_DIR, exist_ok=True)

FREE_CHAT_LIMIT = 5
chat_usage = {}

# ─── In-memory job tracking for async ranking ───────────────────────
# ranking_id -> {"status": "processing"|"done"|"error", "result": ..., "error": ...}
ranking_jobs = {}


class ChatRequest(BaseModel):
    ranking_id: str
    question: str


def _parse_candidate_files(files_data):
    """Shared parsing logic used by both /rank and /rank-start."""
    candidates = []
    for filename, contents in files_data:
        file_extension = os.path.splitext(filename)[1].lower()

        if file_extension == '.json':
            try:
                data = json.loads(contents.decode('utf-8'))
                file_candidates = data if isinstance(data, list) else [data]
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON format in {filename}: {str(e)}")

        elif file_extension == '.jsonl':
            try:
                decoded = contents.decode('utf-8')
                file_candidates = [json.loads(line) for line in decoded.splitlines() if line.strip()]
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSONL format in {filename}: {str(e)}")

        else:
            # PDF, DOCX, etc. - parser returns a single candidate per file
            parsed_data = parse_resume_file(contents, filename)
            file_candidates = [parsed_data] if not isinstance(parsed_data, list) else parsed_data

        candidates.extend(file_candidates)

    return candidates


def process_ranking_job(ranking_id, job_domain, job_description, files_data):
    """
    Runs in the background via FastAPI's BackgroundTasks — this executes
    AFTER the HTTP response has already been sent back to the client, so
    it is never subject to the gateway/proxy request timeout (e.g. Hugging
    Face Spaces' ~60s limit). The frontend polls /rank-status/{id} instead
    of waiting on one long-lived request.
    """
    try:
        try:
            candidates = _parse_candidate_files(files_data)
        except ValueError as e:
            ranking_jobs[ranking_id] = {"status": "error", "error": str(e)}
            return
        except Exception as e:
            ranking_jobs[ranking_id] = {"status": "error", "error": f"Error processing files: {str(e)}"}
            return

        if not candidates:
            ranking_jobs[ranking_id] = {"status": "error", "error": "No candidate data could be extracted from the file"}
            return

        jd_params = {
            "salary_max": 25.0,
            "work_mode": "hybrid"
        }

        try:
            rankings = rank_candidates(
                candidates=candidates,
                jd_text=job_description,
                jd_params=jd_params,
                top_n=len(candidates),
                job_domain=job_domain
            )
        except Exception as e:
            ranking_jobs[ranking_id] = {"status": "error", "error": f"Ranking failed: {str(e)}"}
            return

        result = {
            "id": ranking_id,
            "job_domain": job_domain,
            "job_description": job_description,
            "created_at": datetime.utcnow().isoformat(),
            "total_candidates": len(rankings),
            "rankings": rankings
        }

        file_path = os.path.join(RANKINGS_DIR, f"{ranking_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        ranking_jobs[ranking_id] = {"status": "done", "result": result}

    except Exception as e:
        # Catch-all so a stray exception never leaves the job stuck at "processing" forever
        ranking_jobs[ranking_id] = {"status": "error", "error": str(e)}


@app.get("/")
def root():
    return {
        "message": "ForgeMatch Ranking API is running",
        "model_loaded": model is not None
    }


# ─── NEW: Async ranking flow (recommended) ──────────────────────────
@app.post("/rank-start")
async def start_ranking(
    background_tasks: BackgroundTasks,
    job_domain: str = Form(...),
    job_description: str = Form(...),
    candidate_files: list[UploadFile] = File(...)
):
    """
    Kicks off ranking in the background and returns immediately with a
    ranking_id. Files must be read here (while the request is still open)
    since UploadFile streams close once the request ends.
    """
    ranking_id = str(uuid.uuid4())
    ranking_jobs[ranking_id] = {"status": "processing"}

    files_data = []
    for f in candidate_files:
        contents = await f.read()
        files_data.append((f.filename or "", contents))

    background_tasks.add_task(
        process_ranking_job, ranking_id, job_domain, job_description, files_data
    )

    return {"ranking_id": ranking_id, "status": "processing"}


@app.get("/rank-status/{ranking_id}")
def get_rank_status(ranking_id: str):
    """
    Frontend polls this every few seconds until status is "done" or "error".
    Falls back to checking disk in case the server restarted and the
    in-memory ranking_jobs dict was cleared but the file was already written.
    """
    job = ranking_jobs.get(ranking_id)
    if job:
        return job

    file_path = os.path.join(RANKINGS_DIR, f"{ranking_id}.json")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return {"status": "done", "result": json.load(f)}

    raise HTTPException(status_code=404, detail="Ranking job not found")


# ─── LEGACY: Synchronous ranking (kept as fallback, may time out on large batches) ──
@app.post("/rank")
async def rank_candidates_endpoint(
    job_domain: str = Form(...),
    job_description: str = Form(...),
    candidate_files: list[UploadFile] = File(...)
):
    files_data = []
    for candidate_file in candidate_files:
        contents = await candidate_file.read()
        files_data.append((candidate_file.filename or "", contents))

    try:
        candidates = _parse_candidate_files(files_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing files: {str(e)}")

    if not candidates or len(candidates) == 0:
        raise HTTPException(status_code=400, detail="No candidate data could be extracted from the file")

    jd_params = {
        "salary_max": 25.0,
        "work_mode": "hybrid"
    }

    try:
        rankings = rank_candidates(
            candidates=candidates,
            jd_text=job_description,
            jd_params=jd_params,
            top_n=len(candidates),
            job_domain=job_domain
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ranking failed: {str(e)}")

    ranking_id = str(uuid.uuid4())
    result = {
        "id": ranking_id,
        "job_domain": job_domain,
        "job_description": job_description,
        "created_at": datetime.utcnow().isoformat(),
        "total_candidates": len(rankings),
        "rankings": rankings
    }

    file_path = os.path.join(RANKINGS_DIR, f"{ranking_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    return result


@app.get("/rankings")
def get_rankings():
    history = []
    for file in os.listdir(RANKINGS_DIR):
        if not file.endswith(".json"):
            continue
        file_path = os.path.join(RANKINGS_DIR, file)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            history.append({
                "id": data.get("id"),
                "job_domain": data.get("job_domain"),
                "created_at": data.get("created_at"),
                "total_candidates": data.get("total_candidates", 0),
                "rankings": data.get("rankings", [])
            })
        except Exception:
            continue
    history.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return history


def _to_100_scale(score: float) -> float:
    """
    Auto-detect whether the ranking engine returned a 0-1 score or a 0-100 score
    and normalise to 0-100.

    Heuristic: if every score we've seen so far is <= 1.0 the engine is using the
    0-1 range.  We detect this per-score so the function is safe to call one
    candidate at a time; the caller must pass the raw float straight from the JSON.
    """
    if score <= 1.0:
        return score * 100
    return score          # already 0-100


@app.get("/dashboard-stats")
def get_dashboard_stats():
    history = []

    # Load all saved rankings
    for file in os.listdir(RANKINGS_DIR):
        if not file.endswith(".json"):
            continue

        try:
            with open(
                os.path.join(RANKINGS_DIR, file),
                "r",
                encoding="utf-8"
            ) as f:
                history.append(json.load(f))
        except Exception:
            continue

    # Newest first
    history.sort(
        key=lambda x: x.get("created_at", ""),
        reverse=True
    )

    history_count = len(history)

    total_candidates = 0
    score_sum = 0.0
    score_count = 0

    top_candidate = "-"
    top_score = 0.0
    top_skill = "N/A"

    experience_sum = 0.0
    experience_count = 0

    total_shortlisted = 0

    chart_data = []
    avg_scores = []          # per-ranking average, already on 0-100 scale

    score_distribution = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}

    recent_activity = []

    # Top Candidate = the single best-scoring candidate across EVERY
    # ranking ever saved (all-time max, not scoped to the latest ranking).
    # top_candidate_ranking_id tracks which specific ranking that candidate
    # came from, so the card can link straight to it.
    top_candidate_ranking_id = None

    for ranking in history:

        candidates = ranking.get("rankings", [])

        # ── Recent activity (latest 5 rankings) ──────────────────────
        if len(recent_activity) < 5:
            recent_activity.append({
                "id": ranking.get("id"),
                "job_domain": ranking.get("job_domain", "Unknown"),
                "created_at": ranking.get("created_at"),
                "candidate_count": len(candidates)
            })

        # ── Chart: one point per ranking ─────────────────────────────
        chart_data.append({
            "ranking": ranking.get("job_domain", "Unknown"),
            "candidates": len(candidates)
        })

        if not candidates:
            continue

        ranking_score_sum = 0.0

        for candidate in candidates:

            # ── overall_score is ALREADY on a 0-100 scale ──
            # (= hybrid_score * 100, computed in ranking.py). It must NOT be
            # passed through _to_100_scale: a genuinely poor match can have
            # overall_score <= 1.0 (e.g. 0.8 for a near-zero hybrid_score of
            # 0.008), and _to_100_scale's "<=1.0 means raw 0-1 input" heuristic
            # would then wrongly re-multiply it by 100, turning a near-worthless
            # candidate into a fake ~80-100% match and hijacking Top Candidate /
            # skewing the average. Only the legacy raw "score" field (which IS
            # always 0-1) needs that scaling.
            if "overall_score" in candidate:
                score = float(candidate["overall_score"])
            else:
                raw_score = float(candidate.get("score", 0))
                score = _to_100_scale(raw_score)

            total_candidates += 1
            score_sum += score
            score_count += 1
            ranking_score_sum += score

            # Top candidate (all-time max)
            if score > top_score:
                top_score = score
                top_candidate = candidate.get("name") or candidate.get("candidate_id") or "-"
                top_candidate_ranking_id = ranking.get("id")

            # Top skill — first skill of first candidate encountered with any skills
            skills = candidate.get("skills")
            if isinstance(skills, list) and skills:
                top_skill = skills[0]

            # Experience — check common key variants used across the pipeline
            exp = (
                candidate.get("experience")
                or candidate.get("experience_years")
                or candidate.get("years_experience")
                or candidate.get("total_experience")
                or candidate.get("years_of_experience")
            )
            if isinstance(exp, (int, float)):
                experience_sum += float(exp)
                experience_count += 1
            elif isinstance(exp, str):
                m = re.search(r"\d+(\.\d+)?", exp)
                if m:
                    experience_sum += float(m.group())
                    experience_count += 1

            # Shortlisted (score already on 0-100 scale)
            if score >= 75:
                total_shortlisted += 1

            # Distribution (score already on 0-100 scale)
            if score <= 20:
                score_distribution["0-20"] += 1
            elif score <= 40:
                score_distribution["21-40"] += 1
            elif score <= 60:
                score_distribution["41-60"] += 1
            elif score <= 80:
                score_distribution["61-80"] += 1
            else:
                score_distribution["81-100"] += 1

        avg_scores.append(ranking_score_sum / len(candidates))

    # ── Headline "Avg Match Score" = latest ranking's average (Option A) ──
    # The gauge/KPI is labeled "Now" and compares against "Previous", so this
    # must reflect the most recent ranking only, not a cumulative all-time pool
    # (a cumulative average barely moves once many rankings exist, which is
    # why the KPI used to appear "stuck").
    avg_score = round(avg_scores[0]) if avg_scores else 0

    previous_avg_score = round(avg_scores[1]) if len(avg_scores) >= 2 else avg_score

    # Optional: all-time average across every candidate ever ranked.
    # Kept separate so it never silently overrides the "Now" KPI again.
    avg_score_all_time = (
        round(score_sum / score_count)
        if score_count
        else 0
    )

    avg_experience = (
        round(experience_sum / experience_count, 1)
        if experience_count
        else 0
    )

    # Score-change % between the two most-recent rankings
    if len(avg_scores) >= 2:
        previous = avg_scores[1]
        latest = avg_scores[0]
        score_change = (
            round(((latest - previous) / previous) * 100)
            if previous
            else 0
        )
    else:
        score_change = 0

    return {
        "history_count": history_count,
        "candidates_processed": total_candidates,
        "avg_score": avg_score,                     # latest ranking avg (Option A)
        "previous_avg_score": previous_avg_score,    # NEW — explicit, no reverse-math needed
        "avg_score_all_time": avg_score_all_time,    # NEW — optional, for future use
        "score_change": score_change,
        "top_candidate": top_candidate,
        "top_candidate_ranking_id": top_candidate_ranking_id,  # NEW — lets the frontend link directly to the ranking this candidate came from
        "top_score": round(top_score, 1),   # BUG FIX 1: real percentage now
        "top_skill": top_skill,
        "avg_experience": avg_experience,
        "total_shortlisted": total_shortlisted,
        "chart_data": chart_data,
        "score_distribution": [
            {"range": "0-20",   "count": score_distribution["0-20"]},
            {"range": "21-40",  "count": score_distribution["21-40"]},
            {"range": "41-60",  "count": score_distribution["41-60"]},
            {"range": "61-80",  "count": score_distribution["61-80"]},
            {"range": "81-100", "count": score_distribution["81-100"]},
        ],
        "recent_activity": recent_activity   # BUG FIX 3: correct field names
    }


@app.get("/rankings/{ranking_id}")
def get_ranking(ranking_id: str):
    file_path = os.path.join(RANKINGS_DIR, f"{ranking_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Ranking not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.post("/chat-ranking")
def chat_ranking(request: ChatRequest):
    used = chat_usage.get(request.ranking_id, 0)
    if used >= FREE_CHAT_LIMIT:
        return {
            "premium_required": True,
            "message": "You have reached your free AI question limit. Upgrade to Premium to ask more questions."
        }

    file_path = os.path.join(RANKINGS_DIR, f"{request.ranking_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Ranking not found")

    with open(file_path, "r", encoding="utf-8") as f:
        ranking_data = json.load(f)

    try:
        answer = ask_recruiter_ai(ranking_data=ranking_data, question=request.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat failed: {str(e)}")

    chat_usage[request.ranking_id] = used + 1
    return {
        "answer": answer,
        "questions_used": chat_usage[request.ranking_id],
        "questions_left": FREE_CHAT_LIMIT - chat_usage[request.ranking_id],
        "premium_required": False
    }


# ─── Export CSV (top 100) ─────────────────────────────────────────
@app.get("/rankings/{ranking_id}/export-csv")
def export_submission_csv(ranking_id: str, team_name: str, team_id: str):
    json_path = os.path.join(RANKINGS_DIR, f"{ranking_id}.json")
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="Ranking not found.")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Export only the top 100
    rankings = data.get("rankings", [])[:100]
    filename = f"{team_name}_{team_id}.csv"
    csv_path = os.path.join(RANKINGS_DIR, filename)

    with open(csv_path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["candidate_id", "rank", "score", "reasoning"])
        for candidate in rankings:
            writer.writerow([
                candidate.get("candidate_id"),
                candidate.get("rank"),
                candidate.get("overall_score", candidate.get("score")),
                candidate.get("reasoning") or candidate.get("reason") or ""
            ])

    return FileResponse(
        path=csv_path,
        filename=filename,
        media_type="text/csv"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)



  




  
  



  
  

  
  
  
  

  
  



  




  
  



  
  

  
  
  
  

  
  




  




  
  



  
  

  
  
  
  

  
  



  




  
  



  
  

  
  
  
  

  
  