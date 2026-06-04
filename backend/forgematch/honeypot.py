from __future__ import annotations

from .utils import as_list, clamp01, safe_float, tokens


def detect_honeypot(candidate: dict) -> dict:
    reasons = []
    years = safe_float(candidate.get("experience_years"))
    skills = as_list(candidate.get("skills"))
    text = " ".join(tokens(str(candidate)))
    if years > 45:
        reasons.append("experience exceeds plausible working career length")
    if years < 2 and len(skills) > 45:
        reasons.append("very low experience with unusually large skill inventory")
    if len(skills) > 80:
        reasons.append("keyword stuffing in skills")
    if text.count("expert") > 12:
        reasons.append("repeated expert claims")
    if "founding engineer" in text and "intern" in text and years < 1:
        reasons.append("contradicting seniority history")
    score = clamp01(len(reasons) / 3.0)
    return {"is_honeypot": score >= 0.50, "honeypot_score": score, "honeypot_reasons": reasons}

