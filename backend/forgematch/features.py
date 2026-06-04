from __future__ import annotations

from .utils import as_list, clamp01, days_since, overlap_score, ratio, safe_float, tokens

QUALITY_TERMS = {"retrieval", "ranking", "recommendation", "vector", "faiss", "embedding", "search", "production", "evaluation", "rag"}
PRODUCT_COMPANIES = {"google", "meta", "amazon", "microsoft", "netflix", "uber", "stripe", "razorpay", "freshworks", "swiggy", "zomato"}


def generate_features(candidate: dict, jd: dict, semantic_score: float) -> dict[str, float]:
    skills = as_list(candidate.get("skills"))
    title = str(candidate.get("title", "")).lower()
    location = str(candidate.get("location", "")).lower()
    jd_location = str(jd.get("location", "")).lower()
    years = safe_float(candidate.get("experience_years"))
    min_years = safe_float(jd.get("experience", {}).get("min_years"))
    return {
        "semantic_match": clamp01((semantic_score + 1.0) / 2.0),
        "skill_match": overlap_score(jd.get("skills", []), skills),
        "experience_match": _experience_match(years, min_years),
        "title_match": _title_match(title, jd.get("titles", [])),
        "behavioral_score": behavioral_score(candidate),
        "engagement_score": engagement_score(candidate),
        "recruiter_interest": recruiter_interest(candidate),
        "location_match": 1.0 if jd_location and jd_location in location else (0.5 if not jd_location else 0.0),
        "notice_period": _notice_score(candidate.get("notice_period_days"), jd.get("notice_period_days")),
        "quality_score": quality_score(candidate),
    }


def behavioral_score(candidate: dict) -> float:
    active_days = days_since(candidate.get("last_active_date"))
    active = 0.5 if active_days is None else clamp01(1.0 - active_days / 90.0)
    verified = sum(1 for key in ("verified_email", "verified_phone", "linkedin_connected") if candidate.get(key) in (True, "true", "True", 1, "1")) / 3
    return clamp01(0.35 * ratio(candidate.get("recruiter_response_rate")) + 0.25 * ratio(candidate.get("interview_completion_rate")) + 0.25 * active + 0.15 * verified)


def engagement_score(candidate: dict) -> float:
    views = min(safe_float(candidate.get("profile_views_received_30d")), 100) / 100
    searches = min(safe_float(candidate.get("search_appearance_30d")), 200) / 200
    github = ratio(candidate.get("github_activity_score"))
    return clamp01(0.35 * views + 0.35 * searches + 0.30 * github)


def recruiter_interest(candidate: dict) -> float:
    saves = min(safe_float(candidate.get("saved_by_recruiters_30d")), 20) / 20
    return clamp01(0.40 * saves + 0.35 * ratio(candidate.get("recruiter_response_rate")) + 0.25 * ratio(candidate.get("interview_completion_rate")))


def quality_score(candidate: dict) -> float:
    text = " ".join(tokens(str(candidate)))
    hits = sum(1 for term in QUALITY_TERMS if term in text)
    companies = " ".join(as_list(candidate.get("companies"))).lower()
    product = 1.0 if any(company in companies for company in PRODUCT_COMPANIES) else (0.75 if "product" in companies or "saas" in companies else 0.35)
    return clamp01(0.12 * hits + 0.35 * product)


def _experience_match(years: float, min_years: float) -> float:
    if not min_years:
        return clamp01(years / 8.0)
    if years >= min_years:
        return clamp01(0.75 + min((years - min_years) / 10.0, 0.25))
    return clamp01((years / max(min_years, 1.0)) * 0.70)


def _title_match(title: str, titles: list[str]) -> float:
    if not titles:
        return 0.5
    title_tokens = set(tokens(title))
    return max((len(title_tokens & set(tokens(item))) / max(len(set(tokens(item))), 1) for item in titles), default=0.0)


def _notice_score(days, required_days) -> float:
    days = safe_float(days, 999)
    if required_days:
        return 1.0 if days <= safe_float(required_days) else clamp01(safe_float(required_days) / days)
    return clamp01(1.0 - days / 120.0)

