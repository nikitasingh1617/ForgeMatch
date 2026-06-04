from __future__ import annotations

import json
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from forgematch.exporter import export_submission
from forgematch.ingestion import candidate_from_text, load_candidates, validate_data
from forgematch.pipeline import rank_candidates
from forgematch.storage import delete_ranking, get_ranking, list_rankings, save_ranking

app = FastAPI(title="ForgeMatch API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LAST_SUBMISSION = Path(__file__).resolve().parent / "data" / "submission.csv"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "ranking_version": "2.0.0",
        "faiss_status": "optional",
        "external_api_calls_during_ranking": False,
        "submission_csv": str(LAST_SUBMISSION),
    }


@app.post("/rank-resumes")
async def rank_resumes(
    resumes: list[UploadFile] = File(...),
    job_domain: str = Form(""),
    job_description: str = Form(""),
):
    if not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required")
    candidates = []
    for upload in resumes:
        raw = await upload.read()
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix in {".json", ".jsonl", ".csv", ".txt"}:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
                handle.write(raw)
                temp_path = Path(handle.name)
            loaded = load_candidates(temp_path)
            candidates.extend(loaded)
        else:
            text = raw.decode("utf-8", errors="ignore")
            candidates.append(candidate_from_text(Path(upload.filename or "candidate").stem, text))
    candidates = validate_data(candidates)
    payload = rank_candidates(candidates, job_description, job_domain)
    ranking_id = save_ranking(payload, job_domain, job_description)
    payload["id"] = ranking_id
    export_submission(payload["rankings"], LAST_SUBMISSION)
    return payload


@app.post("/rank-json")
async def rank_json(payload: dict):
    candidates = validate_data(payload.get("candidates", []))
    result = rank_candidates(candidates, payload.get("job_description", payload.get("jd_text", "")), payload.get("job_domain", ""))
    ranking_id = save_ranking(result, result.get("job_domain", ""), result.get("job_description", ""))
    result["id"] = ranking_id
    export_submission(result["rankings"], LAST_SUBMISSION)
    return json.loads(json.dumps(result, default=str))


@app.get("/rankings")
def rankings():
    return list_rankings()


@app.get("/rankings/{ranking_id}")
def ranking_detail(ranking_id: int):
    payload = get_ranking(ranking_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Ranking not found")
    return payload


@app.delete("/rankings/{ranking_id}")
def ranking_delete(ranking_id: int):
    return {"deleted": delete_ranking(ranking_id)}


@app.get("/export/submission.csv")
def submission_csv():
    if not LAST_SUBMISSION.exists():
        raise HTTPException(status_code=404, detail="No submission generated yet")
    return FileResponse(LAST_SUBMISSION, media_type="text/csv", filename="submission.csv")

