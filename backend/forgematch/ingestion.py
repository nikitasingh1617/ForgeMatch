from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from .utils import as_list, safe_float, tokens


def load_candidates(path: str | Path) -> list[dict[str, Any]]:
    source = Path(path)
    suffix = source.suffix.lower()
    if suffix == ".jsonl":
        return [json.loads(line) for line in source.read_text(encoding="utf-8").splitlines() if line.strip()]
    if suffix == ".json":
        payload = json.loads(source.read_text(encoding="utf-8"))
        return payload if isinstance(payload, list) else payload.get("candidates", [])
    if suffix == ".csv":
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))
    return [candidate_from_text(source.stem, source.read_text(encoding="utf-8", errors="ignore"))]


def candidate_from_text(name: str, text: str) -> dict[str, Any]:
    low = text.lower()
    skill_bank = ["python", "fastapi", "react", "next.js", "sql", "aws", "docker", "machine learning", "nlp", "rag", "embeddings", "vector search", "faiss", "ranking", "recommendation", "retrieval", "pandas", "numpy"]
    years_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)", low)
    title = next((item for item in ["AI Engineer", "Machine Learning Engineer", "Data Scientist", "Backend Engineer", "Software Engineer", "Search Engineer"] if item.lower() in low), "Candidate")
    return {
        "candidate_id": re.sub(r"[^a-zA-Z0-9_-]+", "_", name).strip("_") or "candidate",
        "name": name.replace("_", " ").replace("-", " ").title(),
        "title": title,
        "location": next((loc.title() for loc in ["bangalore", "bengaluru", "delhi", "mumbai", "pune", "hyderabad", "remote"] if loc in low), ""),
        "skills": [skill for skill in skill_bank if skill in low],
        "experience_years": safe_float(years_match.group(1)) if years_match else 0,
        "companies": [],
        "projects": [],
        "raw_text": " ".join(tokens(text)[:2000]),
        "recruiter_response_rate": 0.55,
        "interview_completion_rate": 0.55,
        "open_to_work_flag": False,
    }


def validate_data(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clean = []
    for index, raw in enumerate(candidates):
        candidate = dict(raw)
        candidate.setdefault("candidate_id", f"candidate_{index + 1}")
        candidate.setdefault("name", candidate["candidate_id"])
        candidate.setdefault("title", "")
        candidate["candidate_id"] = str(candidate["candidate_id"])
        candidate["skills"] = as_list(candidate.get("skills"))
        candidate["companies"] = as_list(candidate.get("companies"))
        candidate["experience_years"] = safe_float(candidate.get("experience_years"))
        clean.append(candidate)
    return clean

