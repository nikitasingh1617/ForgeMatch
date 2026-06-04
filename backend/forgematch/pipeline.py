from __future__ import annotations

from time import perf_counter

from .analytics import dataset_analytics
from .config import RankingConfig
from .embeddings import LocalHashingEmbedder, build_profile_text
from .explainability import explain, reasoning_text
from .features import generate_features
from .honeypot import detect_honeypot
from .jd_parser import parse_job_description
from .scoring import final_score
from .vector_search import VectorIndex


def rank_candidates(candidates: list[dict], job_description: str, job_domain: str = "", config: RankingConfig | None = None) -> dict:
    started = perf_counter()
    config = config or RankingConfig()
    jd = parse_job_description(job_description, job_domain)
    embedder = LocalHashingEmbedder(config.embedding_dim)
    profile_texts = [build_profile_text(candidate) for candidate in candidates]
    vectors = embedder.encode(profile_texts)
    query = embedder.encode([f"{job_domain}\n{job_description}"])[0]
    index = VectorIndex(vectors)
    indices, semantic_scores = index.search(query, min(config.retrieve_k, len(candidates)))

    ranked = []
    for index_value, semantic_score in zip(indices, semantic_scores):
        candidate = dict(candidates[int(index_value)])
        features = generate_features(candidate, jd, float(semantic_score))
        honeypot = detect_honeypot(candidate)
        score = final_score(features, honeypot["honeypot_score"], config.weights)
        explanation = explain(candidate, jd, features, honeypot)
        candidate.update({
            "overall_score": score,
            "technical_match": round(100 * ((features["semantic_match"] + features["skill_match"] + features["quality_score"]) / 3), 2),
            "behavioral_fit": round(100 * features["behavioral_score"], 2),
            "experience_match": round(100 * features["experience_match"], 2),
            "project_relevance": round(100 * features["quality_score"], 2),
            "engagement_score": round(100 * features["engagement_score"], 2),
            "recruiter_interest": round(100 * features["recruiter_interest"], 2),
            "honeypot": honeypot,
            "explanation": explanation,
            "reason": reasoning_text(explanation),
        })
        ranked.append(candidate)

    ranked.sort(key=lambda item: item["overall_score"], reverse=True)
    final_ranked = [item for item in ranked if not item["honeypot"]["is_honeypot"]] + [item for item in ranked if item["honeypot"]["is_honeypot"]]
    for rank, candidate in enumerate(final_ranked, start=1):
        candidate["rank"] = rank

    runtime = round(perf_counter() - started, 3)
    analytics = dataset_analytics(candidates, final_ranked)
    return {
        "ranking_version": "2.0.0",
        "job_domain": job_domain,
        "job_description": job_description,
        "job_requirements": jd,
        "rankings": final_ranked,
        "top_candidates": final_ranked[:100],
        "analytics": analytics,
        "runtime_seconds": runtime,
        "ranking_time": f"{runtime}s",
        "candidate_count": len(candidates),
        "retrieved_count": len(ranked),
        "vector_count": len(candidates),
        "faiss_status": index.faiss_status,
    }

