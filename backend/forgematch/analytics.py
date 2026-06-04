from __future__ import annotations

from collections import Counter

from .utils import as_list, ratio, safe_float


def dataset_analytics(candidates: list[dict], ranked: list[dict] | None = None) -> dict:
    if not candidates:
        return {"total_candidates": 0}
    skills = Counter()
    titles = Counter()
    companies = Counter()
    locations = Counter()
    for candidate in candidates:
        skills.update(skill.lower() for skill in as_list(candidate.get("skills")))
        titles.update([str(candidate.get("title", "")).strip().lower() or "unknown"])
        companies.update(company.lower() for company in as_list(candidate.get("companies")))
        locations.update([str(candidate.get("location", "")).strip().lower() or "unknown"])
    experience = [safe_float(candidate.get("experience_years")) for candidate in candidates]
    scores = [safe_float(candidate.get("overall_score")) for candidate in ranked or []]
    return {
        "total_candidates": len(candidates),
        "top_skills": skills.most_common(12),
        "top_roles": titles.most_common(8),
        "top_companies": companies.most_common(8),
        "top_locations": locations.most_common(8),
        "top_location": locations.most_common(1)[0][0] if locations else "N/A",
        "average_experience": round(sum(experience) / len(experience), 2),
        "open_to_work_pct": round(100 * sum(1 for c in candidates if c.get("open_to_work_flag") in (True, "true", "True", 1, "1")) / len(candidates), 2),
        "response_rate_avg": round(100 * sum(ratio(c.get("recruiter_response_rate")) for c in candidates) / len(candidates), 2),
        "interview_completion_avg": round(100 * sum(ratio(c.get("interview_completion_rate")) for c in candidates) / len(candidates), 2),
        "average_match_score": round(sum(scores) / len(scores), 2) if scores else 0,
    }

