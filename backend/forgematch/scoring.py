from __future__ import annotations

from .config import RankingWeights
from .utils import clamp01


def final_score(features: dict[str, float], honeypot_score: float, weights: RankingWeights) -> float:
    score = (
        weights.semantic_match * features.get("semantic_match", 0)
        + weights.skill_match * features.get("skill_match", 0)
        + weights.experience_match * features.get("experience_match", 0)
        + weights.title_match * features.get("title_match", 0)
        + weights.behavioral_score * features.get("behavioral_score", 0)
        + weights.engagement_score * features.get("engagement_score", 0)
        + weights.recruiter_interest * features.get("recruiter_interest", 0)
        + weights.location_match * features.get("location_match", 0)
        + weights.notice_period * features.get("notice_period", 0)
        + weights.quality_score * features.get("quality_score", 0)
    )
    return round(100 * clamp01(score - 0.45 * honeypot_score), 2)

