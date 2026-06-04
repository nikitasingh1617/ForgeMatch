from __future__ import annotations

import csv
from pathlib import Path


def export_submission(ranked_candidates: list[dict], output_csv: str | Path, top_k: int = 100) -> Path:
    output = Path(output_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for rank, candidate in enumerate(ranked_candidates[:top_k], start=1):
        rows.append({
            "candidate_id": candidate.get("candidate_id", ""),
            "rank": rank,
            "score": candidate.get("overall_score", candidate.get("score", 0)),
            "reasoning": candidate.get("reason", candidate.get("reasoning", "")),
        })
    while len(rows) < top_k:
        rows.append({"candidate_id": "", "rank": len(rows) + 1, "score": 0, "reasoning": "No candidate available."})
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["candidate_id", "rank", "score", "reasoning"])
        writer.writeheader()
        writer.writerows(rows)
    return output

