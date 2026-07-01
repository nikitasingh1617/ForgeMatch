import argparse
import csv
import json
import os
import time

import faiss
import numpy as np

from core.ranking import (
    load_candidates,
    model,
    rank_candidates,
)


def write_submission_csv(rankings, output_path):
    rankings.sort(
        key=lambda item: (
            -float(item.get("score", 0)),
            item.get("candidate_id", "")
        )
    )

    top_100 = rankings[:100]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow([
            "candidate_id",
            "rank",
            "score",
            "reasoning"
        ])

        for rank, item in enumerate(top_100, start=1):
            writer.writerow([
                item.get("candidate_id"),
                rank,
                item.get("score"),
                item.get("reasoning") or item.get("reason") or ""
            ])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", required=True)
    parser.add_argument("--jd", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--artifacts", default="./artifacts")
    parser.add_argument("--top-k", type=int, default=2000)
    args = parser.parse_args()

    start = time.time()

    print("Loading candidates...")
    candidates = load_candidates(args.candidates)

    print("Loading JD...")
    from docx import Document

    if args.jd.endswith(".docx"):
        doc = Document(args.jd)
        jd_text = "\n".join(
            paragraph.text
            for paragraph in doc.paragraphs
        )
    else:
        with open(args.jd, "r", encoding="utf-8") as f:
            jd_text = f.read()

    print("Loading FAISS index...")
    index = faiss.read_index(
        os.path.join(args.artifacts, "candidate.index")
    )

    print("Embedding JD...")
    jd_embedding = model.encode([jd_text])
    jd_embedding = np.array(jd_embedding, dtype=np.float32)
    faiss.normalize_L2(jd_embedding)

    top_k = min(args.top_k, len(candidates))

    print(f"Searching top {top_k} candidates...")
    _, indices = index.search(jd_embedding, top_k)

    candidate_subset = [
        candidates[i]
        for i in indices[0]
    ]

    jd_params = {
        "salary_max": 25.0,
        "work_mode": "hybrid",
        "min_experience": 5,   # JD: "5–9 years"
        "max_experience": 9,   # band upper bound — enables band scoring in ranking engine
    }

    print("Deep ranking retrieved candidates...")
    rankings = rank_candidates(
        candidates=candidate_subset,
        jd_text=jd_text,
        jd_params=jd_params,
        top_n=100,
        job_domain="AI Engineer"
    )

    print("Writing CSV...")
    write_submission_csv(rankings, args.out)

    print(f"Done in {round(time.time() - start, 2)} seconds")
    print(f"Output: {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()