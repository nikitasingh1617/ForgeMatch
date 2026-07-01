import argparse
import json
import os
import pickle
import time

import faiss
import numpy as np

from core.ranking import load_candidates, create_candidate_text, model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", required=True)
    parser.add_argument("--out-dir", default="./artifacts")
    parser.add_argument("--batch-size", type=int, default=256)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    start = time.time()

    print("Loading candidates...")
    candidates = load_candidates(args.candidates)
    print(f"Loaded {len(candidates)} candidates")

    print("Creating candidate texts...")
    candidate_texts = [create_candidate_text(c) for c in candidates]

    candidate_ids = [
        c.get("candidate_id", f"UNKNOWN_{i}")
        for i, c in enumerate(candidates)
    ]

    print("Generating embeddings...")
    embeddings = model.encode(
        candidate_texts,
        batch_size=args.batch_size,
        show_progress_bar=True
    )

    embeddings = np.array(embeddings, dtype=np.float32)
    faiss.normalize_L2(embeddings)

    print("Building FAISS index...")
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    print("Saving artifacts...")

    faiss.write_index(
        index,
        os.path.join(args.out_dir, "candidate.index")
    )

    np.save(
        os.path.join(args.out_dir, "embeddings.npy"),
        embeddings
    )

    with open(os.path.join(args.out_dir, "candidate_ids.json"), "w", encoding="utf-8") as f:
        json.dump(candidate_ids, f)

    with open(os.path.join(args.out_dir, "candidate_texts.pkl"), "wb") as f:
        pickle.dump(candidate_texts, f)

    print(f"Done in {round(time.time() - start, 2)} seconds")


if __name__ == "__main__":
    main()