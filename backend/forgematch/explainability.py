from __future__ import annotations

from .utils import as_list


def explain(candidate: dict, jd: dict, features: dict[str, float], honeypot: dict) -> dict:
    strengths = []
    risks = []
    if features.get("skill_match", 0) >= 0.70:
        strengths.append("strong required-skill coverage")
    if features.get("quality_score", 0) >= 0.60:
        strengths.append("evidence of search, ranking, retrieval, embeddings, or production ML work")
    if features.get("behavioral_score", 0) >= 0.65:
        strengths.append("strong behavioral readiness signals")
    if features.get("recruiter_interest", 0) >= 0.65:
        strengths.append("high recruiter interest and response indicators")
    if features.get("notice_period", 0) >= 0.75:
        strengths.append("favorable notice period")
    if features.get("skill_match", 0) < 0.40:
        risks.append("limited explicit match to required JD skills")
    if features.get("behavioral_score", 0) < 0.35:
        risks.append("weak or missing activity, response, or verification signals")
    risks.extend(honeypot.get("honeypot_reasons", []))

    matched_skills = sorted(set(skill.lower() for skill in as_list(candidate.get("skills"))) & set(jd.get("skills", [])))
    why = []
    if matched_skills:
        why.append(f"matches key skills: {', '.join(matched_skills[:8])}")
    if candidate.get("experience_years") is not None:
        why.append(f"{candidate.get('experience_years')} years experience")
    if candidate.get("location"):
        why.append(f"based in {candidate.get('location')}")
    return {
        "why_ranked": "; ".join(why) if why else "ranked from available profile and behavioral data",
        "strengths": strengths[:5],
        "weaknesses": risks[:5],
        "jd_alignment": {
            "matched_skills": matched_skills,
            "skill_match": round(features.get("skill_match", 0), 3),
            "experience_match": round(features.get("experience_match", 0), 3),
            "title_match": round(features.get("title_match", 0), 3),
        },
        "behavioral_insights": {
            "behavioral_score": round(features.get("behavioral_score", 0), 3),
            "engagement_score": round(features.get("engagement_score", 0), 3),
            "recruiter_interest": round(features.get("recruiter_interest", 0), 3),
        },
        "recruiter_readiness": round((features.get("behavioral_score", 0) + features.get("notice_period", 0) + features.get("recruiter_interest", 0)) / 3, 3),
    }


def reasoning_text(explanation: dict) -> str:
    text = explanation.get("why_ranked", "Ranked from profile data.")
    if explanation.get("strengths"):
        text += ". Strengths: " + ", ".join(explanation["strengths"])
    if explanation.get("weaknesses"):
        text += ". Risks: " + ", ".join(explanation["weaknesses"])
    return text[:900]

