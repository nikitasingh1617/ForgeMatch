from __future__ import annotations

import re
from typing import Any

SKILLS = {
    "python", "java", "javascript", "typescript", "react", "next.js", "fastapi",
    "django", "sql", "postgres", "sqlite", "aws", "gcp", "azure", "docker",
    "kubernetes", "machine learning", "ml", "nlp", "rag", "llm", "embeddings",
    "vector search", "faiss", "ranking", "recommendation", "search", "retrieval",
    "pytorch", "tensorflow", "spark", "airflow", "pandas", "numpy",
}

TITLES = {
    "ai engineer", "machine learning engineer", "ml engineer", "data scientist",
    "search engineer", "ranking engineer", "backend engineer", "software engineer",
    "full stack engineer", "nlp engineer", "recommendation engineer",
}


def parse_job_description(text: str, job_domain: str = "") -> dict[str, Any]:
    combined = f"{job_domain}\n{text}"
    low = combined.lower()
    years = [int(item) for item in re.findall(r"(\d+)\+?\s*(?:years|yrs)", low)]
    locations = [loc for loc in ["bangalore", "bengaluru", "delhi", "mumbai", "pune", "hyderabad", "remote", "gurgaon", "noida"] if loc in low]
    notice_match = re.search(r"(\d+)\s*(?:day|days)\s*(?:notice|joining)", low)
    return {
        "skills": sorted(skill for skill in SKILLS if skill in low),
        "titles": sorted(title for title in TITLES if title in low),
        "experience": {"min_years": min(years) if years else 0, "preferred_years": max(years) if years else None},
        "industry": "Product/SaaS" if any(term in low for term in ["product", "saas", "b2b"]) else "",
        "location": locations[0].title() if locations else "",
        "notice_period_days": int(notice_match.group(1)) if notice_match else None,
        "work_mode": next((mode for mode in ["remote", "hybrid", "onsite", "on-site"] if mode in low), ""),
        "behavioral_requirements": [term for term in ["active", "responsive", "open to work"] if term in low],
    }

