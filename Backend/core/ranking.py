import gzip
import json
import csv
import re
import numpy as np
import faiss

from collections import Counter
from sentence_transformers import SentenceTransformer


print("Loading Embedding Model...")
model = SentenceTransformer("all-MiniLM-L6-v2")


# ── Dynamic JD understanding layer ────────────────────────────────────────────
from core.ranking_dynamic import (
    parse_jd_profile,
    detect_job_type_multi,
    pick_primary_job_type,
    build_dynamic_weights,
    extract_jd_skills_v2,
    compute_role_alignment_dynamic,
    compute_title_fit_dynamic,
    career_keywords_dynamic,
    apply_dynamic_negative_signals,
    parse_experience_requirements,
    build_debug_bundle,
)
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# FILE LOADING
# ─────────────────────────────────────────────────────────────────────────────

def load_candidates(filepath):
    if filepath.endswith(".gz"):
        with gzip.open(filepath, "rt", encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
    if filepath.endswith(".jsonl"):
        with open(filepath, "r", encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def safe_lower(value):
    return str(value or "").lower().strip()


def normalize_skill(s):
    return s.strip().lower()

def format_term(term):
    if not term:
        return term

    mapping = {
        # AI / ML
        "ai": "AI",
        "ml": "ML",
        "llm": "LLM",
        "llms": "LLMs",
        "rag": "RAG",
        "nlp": "NLP",
        "cv": "CV",
        "computer vision": "Computer Vision",

        # Retrieval / Search
        "bm25": "BM25",
        "faiss": "FAISS",
        "qdrant": "Qdrant",
        "pinecone": "Pinecone",
        "weaviate": "Weaviate",
        "elasticsearch": "Elasticsearch",
        "opensearch": "OpenSearch",
        "langchain": "LangChain",
        "llamaindex": "LlamaIndex",

        # Fine-tuning / Models
        "qlora": "QLoRA",
        "lora": "LoRA",
        "peft": "PEFT",
        "transformer": "Transformer",
        "transformers": "Transformers",

        # Languages
        "python": "Python",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "java": "Java",
        "go": "Go",
        "rust": "Rust",
        "c++": "C++",
        "c#": "C#",

        # Frameworks / Libraries
        "tensorflow": "TensorFlow",
        "pytorch": "PyTorch",
        "scikit-learn": "Scikit-Learn",
        "fastapi": "FastAPI",
        "flask": "Flask",
        "django": "Django",
        "react": "React",
        "next.js": "Next.js",
        "node.js": "Node.js",

        # Databases
        "postgresql": "PostgreSQL",
        "mysql": "MySQL",
        "mongodb": "MongoDB",
        "redis": "Redis",

        # Cloud / DevOps
        "aws": "AWS",
        "gcp": "GCP",
        "azure": "Azure",
        "devops": "DevOps",
        "ci/cd": "CI/CD",
        "docker": "Docker",
        "kubernetes": "Kubernetes",

        # APIs
        "api": "API",
        "apis": "APIs",
        "rest api": "REST API",
        "graphql": "GraphQL",

        # Data Engineering
        "sql": "SQL",
        "etl": "ETL",
        "spark": "Spark",
        "pyspark": "PySpark",
        "airflow": "Airflow",
        "dbt": "dbt",
        "databricks": "Databricks",

        # Misc
        "opencv": "OpenCV",
    }

    key = term.strip().lower()
    return mapping.get(key, term.title())

def article(term):
    if not term:
        return "a"

    word = format_term(term)
    return "an" if word[0].lower() in "aeiou" else "a"


def dedupe_skills(skill_list):
    seen, out = set(), []
    for s in skill_list:
        n = normalize_skill(s)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# SPECIALIZATION DETECTION (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

_SPECIALIZATION_SIGNALS = {
    "frontend": {
        "title_keywords": [
            "frontend", "front-end", "react developer", "react engineer",
            "javascript developer", "ui engineer", "web developer", "ui developer"
        ],
        "heavy_skills": ["react", "next.js", "nextjs", "typescript", "redux", "tailwind", "vite", "webpack"],
        "domain_keywords": ["frontend", "front-end", "react", "ui component", "spa", "responsive design"],
    },
    "devops": {
        "title_keywords": [
            "devops", "sre", "site reliability", "infrastructure engineer",
            "platform engineer", "cloud engineer", "systems engineer"
        ],
        "heavy_skills": ["kubernetes", "terraform", "ansible", "jenkins", "ci/cd", "helm", "prometheus", "grafana"],
        "domain_keywords": ["devops", "infrastructure", "ci/cd", "deployment pipeline", "kubernetes", "terraform"],
    },
    "backend": {
        "title_keywords": [
            "backend engineer", "backend developer", "software engineer",
            "api developer", "server-side engineer"
        ],
        "heavy_skills": ["fastapi", "django", "flask", "spring boot", "microservices", "postgresql", "node.js"],
        "domain_keywords": ["backend", "api", "microservices", "server-side", "database design"],
    },
    "data": {
        "title_keywords": [
            "data engineer", "analytics engineer", "etl developer",
            "big data engineer", "data platform engineer"
        ],
        "heavy_skills": ["spark", "airflow", "kafka", "dbt", "bigquery", "snowflake", "pyspark", "hadoop"],
        "domain_keywords": ["data pipeline", "etl", "warehouse", "data engineering", "streaming"],
    },
    "ai": {
        "title_keywords": [
            "ml engineer", "ai engineer", "machine learning engineer",
            "data scientist", "nlp engineer", "search engineer",
            "applied scientist", "research scientist",
            "recommendation engineer", "retrieval engineer",
        ],
        "heavy_skills": ["tensorflow", "pytorch", "scikit-learn", "llm", "rag", "langchain", "faiss", "embeddings"],
        "domain_keywords": ["machine learning", "deep learning", "model training", "llm", "recommendation system"],
    },
    "uiux": {
        "title_keywords": [
            "ux designer", "ui designer", "product designer",
            "visual designer", "interaction designer"
        ],
        "heavy_skills": ["figma", "adobe xd", "sketch", "wireframing", "prototyping", "user research"],
        "domain_keywords": ["ux", "ui design", "wireframe", "design system", "user research", "figma"],
    },
    "fullstack": {
        "title_keywords": ["full stack", "fullstack", "full-stack"],
        "heavy_skills": [],
        "domain_keywords": ["full stack", "fullstack"],
    },
}


# ── Unrelated career titles that should penalise AI/ML specialisation claims ──
_UNRELATED_CAREER_TITLES = {
    "hr manager", "human resources", "talent acquisition", "recruiter",
    "accountant", "accounts manager", "finance manager", "financial analyst",
    "marketing manager", "marketing executive", "digital marketing", "content writer",
    "seo analyst", "seo specialist", "social media manager", "brand manager",
    "operations manager", "project coordinator", "business analyst",
    "sales executive", "sales manager", "business development",
    "mechanical engineer", "civil engineer", "electrical engineer",
    "procurement manager", "supply chain", "logistics manager",
    "customer support", "customer success", "customer service",
    "teacher", "lecturer", "professor",
}


def _count_unrelated_titles(career_history, current_title):
    """Return how many job titles (including current) are clearly unrelated to tech/AI."""
    all_titles = []
    if current_title:
        all_titles.append(safe_lower(current_title))
    for job in career_history:
        all_titles.append(safe_lower(job.get("title", "")))
    count = 0
    for t in all_titles:
        for unrelated in _UNRELATED_CAREER_TITLES:
            if unrelated in t:
                count += 1
                break
    return count, len(all_titles)


def detect_candidate_specialization(candidate):
    profile = candidate.get("profile", {})
    career_history = candidate.get("career_history", [])
    skills_raw = [normalize_skill(s.get("name", "")) for s in candidate.get("skills", []) if s.get("name")]

    domain_scores = {d: 0 for d in _SPECIALIZATION_SIGNALS}

    domain_has_title_signal = {d: False for d in _SPECIALIZATION_SIGNALS}

    title_weights = []
    current_title = safe_lower(profile.get("current_title", ""))
    if current_title:
        title_weights.append((current_title, 3.0))
    for i, job in enumerate(career_history[:4]):
        decay = max(0.5, 1.5 - i * 0.25)
        title_weights.append((safe_lower(job.get("title", "")), decay))

    ai_work_evidence_text = safe_lower(
        " ".join(j.get("description", "") for j in career_history[:4])
    )

    for domain, signals in _SPECIALIZATION_SIGNALS.items():
        score = 0.0

        for title_text, weight in title_weights:
            if any(kw in title_text for kw in signals["title_keywords"]):
                score += 2.0 * weight
                domain_has_title_signal[domain] = True

        skill_hits = sum(1 for hs in signals["heavy_skills"] if hs in skills_raw)
        score += min(skill_hits * 1.5, 3.0)

        desc_kw_hits = sum(1 for kw in signals["domain_keywords"] if kw in ai_work_evidence_text)
        if desc_kw_hits >= 3:
            score += desc_kw_hits * 0.4
        elif desc_kw_hits >= 2:
            score += desc_kw_hits * 0.3
        elif desc_kw_hits == 1:
            score += 0.1

        head_sum_text = safe_lower(profile.get("summary", "") + " " + profile.get("headline", ""))
        head_hits = sum(1 for kw in signals["domain_keywords"] if kw in head_sum_text)
        if head_hits >= 2:
            score += head_hits * 0.15

        domain_scores[domain] = score

    sorted_domains = sorted(domain_scores.items(), key=lambda x: x[1], reverse=True)
    primary_domain, primary_score = sorted_domains[0]
    secondary_domain = sorted_domains[1][0] if len(sorted_domains) > 1 else None
    secondary_score  = sorted_domains[1][1] if len(sorted_domains) > 1 else 0

    MIN_SPEC_SCORE = 3.0

    if primary_score < MIN_SPEC_SCORE or not domain_has_title_signal[primary_domain]:
        if primary_score >= 2.0 and skill_hits > 0:
            return "general", None, "Broad Software Engineering background with AI tool exposure"
        return "general", None, "General Software Engineering background"

    primary = primary_domain

    if (secondary_score >= MIN_SPEC_SCORE and
            secondary_domain and
            domain_has_title_signal.get(secondary_domain, False)):
        secondary = secondary_domain
    else:
        secondary = None

    if secondary_score == 0 or (primary_score / max(secondary_score, 0.01)) > 4:
        trajectory = f"{format_term(primary)} Specialist"
    elif (primary_score / max(secondary_score, 0.01)) > 2:
        trajectory = (
        f"Primarily {format_term(primary)} with "
        f"{format_term(secondary).lower() if secondary else 'general'} experience"
    )
    else:
        trajectory = (
        f"{format_term(primary)} and "
        f"{format_term(secondary).title() if secondary else 'General'} Engineer"
    )

    return primary, secondary, trajectory


def compute_specialization_penalty(
    primary_specialization,
    job_type,
    specialization_scores_ratio,
    unrelated_title_count=0,
    total_title_count=0,
    has_career_title_match=True,
):
    if not has_career_title_match:
        if total_title_count > 0:
            unrelated_ratio = unrelated_title_count / total_title_count
        else:
            unrelated_ratio = 0.0

        if unrelated_ratio >= 0.75:
            return 0.30
        elif unrelated_ratio >= 0.50:
            return 0.42
        elif unrelated_ratio >= 0.25:
            return 0.55
        else:
            return 0.65

    if primary_specialization == job_type:
        if total_title_count > 0:
            unrelated_ratio = unrelated_title_count / total_title_count
        else:
            unrelated_ratio = 0.0

        if unrelated_ratio >= 0.75:
            return 0.60
        elif unrelated_ratio >= 0.50:
            return 0.75
        else:
            return 1.0

    if primary_specialization == "fullstack" and job_type in ("frontend", "backend"):
        return 0.85
    if job_type == "fullstack" and primary_specialization in ("frontend", "backend"):
        return 0.85
    adjacent_pairs = {("backend", "data"), ("data", "backend"), ("frontend", "uiux"), ("uiux", "frontend")}
    if (primary_specialization, job_type) in adjacent_pairs:
        return 0.90
    if specialization_scores_ratio < 0.35:
        return 0.45
    if specialization_scores_ratio < 0.60:
        return 0.58
    return 0.70


# ─────────────────────────────────────────────────────────────────────────────
# CANDIDATE TEXT
# ─────────────────────────────────────────────────────────────────────────────

def create_candidate_text(candidate):
    profile = candidate.get("profile", {})
    parts = []

    if profile.get("headline"):
        parts.append(profile["headline"])
    if profile.get("current_title"):
        parts.append(profile["current_title"])
    if profile.get("summary"):
        parts.append(profile["summary"])

    skills = [
        skill.get("name", "")
        for skill in candidate.get("skills", [])
        if skill.get("name")
    ]
    if skills:
        parts.append("Skills: " + ", ".join(skills))

    for i, job in enumerate(candidate.get("career_history", [])):
        title_str = job.get("title", "")
        company_str = job.get("company", "")
        desc_str = job.get("description", "")
        industry_str = job.get("industry", "")
        if i == 0:
            parts.append(
                f"Current role: {title_str} at {company_str}. "
                f"Industry: {industry_str}. {desc_str}"
            )
        elif i <= 2:
            parts.append(f"{title_str} at {company_str}. {industry_str}. {desc_str}")
        elif i <= 4:
            parts.append(f"Previous role: {title_str} at {company_str}")

    for i, proj in enumerate(candidate.get("projects", [])):
        name = proj.get("name", "")
        desc = proj.get("description", "")
        tech = proj.get("tech_stack", "")
        if isinstance(tech, list):
            tech = ", ".join(tech)
        if i < 3:
            parts.append(f"Project: {name}. {desc} Tech: {tech}")
        else:
            parts.append(f"Project: {name}")

    for edu in candidate.get("education", []):
        field = edu.get("field_of_study", "")
        degree = edu.get("degree", "")
        if field:
            parts.append(f"{degree} in {field}")

    for cert in candidate.get("certifications", []):
        parts.append(f"Certification: {cert.get('name', '')} by {cert.get('issuer', '')}")

    return " ".join(p for p in parts if p).strip()


# ─────────────────────────────────────────────────────────────────────────────
# JOB TYPE DETECTION (legacy fallback)
# ─────────────────────────────────────────────────────────────────────────────

def detect_job_type(job_domain, jd_text):
    text = f"{job_domain} {jd_text}".lower()
    if any(w in text for w in [
        "ui/ux", "ui ux", "ux designer", "ui designer", "figma",
        "wireframe", "wireframing", "prototype", "prototyping",
        "design system", "user research", "product design", "visual design"
    ]):
        return "uiux"
    if any(w in text for w in [
        "data engineer", "etl", "airflow", "spark", "kafka",
        "snowflake", "bigquery", "data pipeline", "data pipelines",
        "warehouse", "dbt"
    ]):
        return "data"
    if any(w in text for w in [
        "ai engineer", "ml engineer", "machine learning", "llm", "rag",
        "retrieval", "ranking", "recommendation", "embeddings",
        "vector database", "faiss", "pinecone", "weaviate", "milvus", "qdrant"
    ]):
        return "ai"
    if any(w in text for w in [
        "frontend", "front-end", "react", "next.js", "nextjs",
        "javascript", "typescript", "tailwind", "css", "html",
        "redux", "vite", "ui", "responsive design"
    ]):
        return "frontend"
    if any(w in text for w in [
        "backend", "fastapi", "django", "flask", "microservices",
        "postgresql", "spring boot"
    ]):
        return "backend"
    return "general"


# ─────────────────────────────────────────────────────────────────────────────
# SKILL VOCABULARY & JD SKILLS
# ─────────────────────────────────────────────────────────────────────────────

def fallback_skills_for_job(job_type):
    common = [
        "python", "sql", "java", "javascript", "typescript",
        "aws", "gcp", "azure", "docker", "kubernetes",
        "postgresql", "mongodb", "redis", "git", "linux"
    ]
    skills_by_type = {
        "uiux": [
            "figma", "adobe xd", "sketch", "wireframing", "prototyping",
            "user research", "design systems", "responsive design",
            "product design", "ui design", "ux design", "visual design",
            "interaction design", "usability testing", "photoshop",
            "illustrator", "css", "html"
        ],
        "frontend": [
            "react", "next.js", "typescript", "javascript", "tailwind",
            "html", "css", "redux", "vite", "webpack", "graphql",
            "rest api", "responsive design", "jest", "cypress"
        ],
        "backend": [
            "python", "fastapi", "django", "flask", "java", "spring boot",
            "node.js", "express", "sql", "postgresql", "mysql", "mongodb",
            "redis", "rest api", "microservices", "docker", "kafka",
            "aws", "gcp", "azure", "system design", "data pipelines", "etl"
        ],
        "data": [
            "python", "sql", "spark", "pyspark", "airflow", "kafka",
            "hadoop", "etl", "data pipelines", "snowflake", "bigquery",
            "dbt", "databricks", "aws", "gcp", "azure", "postgresql"
        ],
        "ai": [
            "python", "machine learning", "deep learning", "tensorflow",
            "pytorch", "scikit-learn", "nlp", "llm", "rag", "langchain",
            "llamaindex", "embeddings", "semantic search", "vector database",
            "faiss", "milvus", "weaviate", "pinecone", "qdrant",
            "opensearch", "elasticsearch", "recommendation systems", "ranking",
            "retrieval", "fine-tuning", "lora", "qlora", "peft", "mlflow"
        ],
        "general": common
    }
    return list(set(common + skills_by_type.get(job_type, [])))


def build_skill_vocabulary(candidates):
    skills = set()
    for candidate in candidates:
        for skill in candidate.get("skills", []):
            name = safe_lower(skill.get("name"))
            if name:
                skills.add(name)
    return skills


_SKILL_SYNONYMS = {
    "python": ["py", "python3", "python 3"],
    "pytorch": ["torch"],
    "tensorflow": ["tf", "tensorflow2", "tensorflow 2"],
    "scikit-learn": ["sklearn", "scikit learn"],
    "llm": ["large language model", "large language models", "llms"],
    "rag": ["retrieval augmented generation", "retrieval-augmented generation"],
    "langchain": ["lang chain"],
    "llamaindex": ["llama index", "llama-index"],
    "embeddings": ["embedding", "text embeddings", "dense vectors", "vector embeddings"],
    "semantic search": ["dense retrieval", "neural search", "embedding search"],
    "faiss": ["facebook ai similarity search"],
    "vector database": ["vector db", "vector store", "vectordb"],
    "mlflow": ["ml flow"],
    "fine-tuning": ["finetuning", "fine tuning", "lora", "qlora", "peft"],
    "lora": ["low-rank adaptation", "low rank adaptation"],
    "elasticsearch": ["elastic search", "elastic"],
    "opensearch": ["open search"],
    "recommendation systems": ["recommendation system", "recommender system", "recommender systems", "recsys"],
    "ranking": ["learning to rank", "ltr", "reranking", "re-ranking"],
    "aws": ["amazon web services", "amazon aws", "ec2", "s3", "sagemaker", "lambda"],
    "gcp": ["google cloud", "google cloud platform", "bigquery", "vertex ai", "dataflow"],
    "azure": ["microsoft azure", "azure ml", "azure openai"],
    "airflow": ["apache airflow"],
    "spark": ["apache spark", "pyspark"],
    "kafka": ["apache kafka"],
    "dbt": ["data build tool"],
    "postgresql": ["postgres", "pg"],
    "kubernetes": ["k8s"],
    "docker": ["containerization", "containers"],
    "ci/cd": ["continuous integration", "continuous deployment", "continuous delivery", "github actions", "gitlab ci"],
    "javascript": ["js", "es6", "ecmascript"],
    "typescript": ["ts"],
    "next.js": ["nextjs", "next js"],
    "node.js": ["nodejs", "node js"],
    "react": ["reactjs", "react.js"],
    "nlp": ["natural language processing", "natural-language processing"],
    "transformer": ["transformers", "bert", "roberta", "t5", "gpt-4", "gpt4", "gpt-3"],
    "prometheus": ["metrics monitoring"],
    "grafana": ["dashboard monitoring"],
    "rest api": ["rest apis", "restful api", "restful apis", "api development"],
    "microservices": ["microservice", "micro services", "micro-services"],
    "system design": ["distributed systems", "distributed system", "high-level design"],
    "redis": ["redis cache", "in-memory cache"],
    "mongodb": ["mongo db", "mongo"],
    "sql": ["structured query language", "rdbms"],
    "git": ["github", "gitlab", "version control"],
}

_DOMAIN_DERIVED_SKILLS = {
    "ai": [
        "python", "pytorch", "tensorflow", "scikit-learn", "llm", "rag",
        "embeddings", "semantic search", "vector database", "recommendation systems",
        "ranking", "mlflow", "fine-tuning", "transformer", "nlp", "faiss"
    ],
    "data": [
        "python", "sql", "spark", "airflow", "kafka", "dbt", "etl",
        "data pipeline", "snowflake", "bigquery"
    ],
    "backend": [
        "python", "rest api", "microservices", "postgresql", "docker",
        "system design", "redis"
    ],
    "frontend": [
        "javascript", "typescript", "react", "next.js", "css", "html"
    ],
    "uiux": ["figma", "wireframing", "prototyping", "user research"],
    "general": [],
}


def _expand_jd_text_with_synonyms(jd_lower):
    inferred = set()
    for canonical, aliases in _SKILL_SYNONYMS.items():
        if canonical in jd_lower:
            inferred.add(canonical)
            continue
        for alias in aliases:
            if alias in jd_lower:
                inferred.add(canonical)
                break
    return inferred


def extract_jd_skills(jd_text, skill_vocabulary, job_type):
    jd_lower = jd_text.lower()
    fallback = set(fallback_skills_for_job(job_type))
    all_skills = set(skill_vocabulary) | fallback

    found = set()
    for skill in sorted(all_skills, key=len, reverse=True):
        if skill and skill in jd_lower:
            found.add(skill)

    inferred = _expand_jd_text_with_synonyms(jd_lower)
    found |= inferred

    domain_defaults = _DOMAIN_DERIVED_SKILLS.get(job_type, [])
    if len(found) < 10:
        found |= set(domain_defaults)
    else:
        for s in domain_defaults[:5]:
            found.add(s)

    ordered = []
    seen = set()
    for skill in sorted(found, key=len, reverse=True):
        if skill not in seen:
            seen.add(skill)
            ordered.append(skill)
    return ordered


# ─────────────────────────────────────────────────────────────────────────────
# EXISTING SCORING FUNCTIONS (kept for fallback / legacy)
# ─────────────────────────────────────────────────────────────────────────────

def compute_skill_match(candidate, jd_skills):
    candidate_skills = dedupe_skills([
        skill.get("name", "")
        for skill in candidate.get("skills", [])
        if skill.get("name")
    ])
    jd_skills_norm = [normalize_skill(s) for s in jd_skills]
    matched = [s for s in jd_skills_norm if s in candidate_skills]
    if not jd_skills_norm:
        return 0.0, matched
    return len(matched) / len(jd_skills_norm), matched


def career_keywords_for_job(job_type):
    if job_type == "uiux":
        return [
            "figma", "wireframe", "wireframing", "prototype", "prototyping",
            "design system", "design systems", "user research", "ux", "ui",
            "visual design", "interaction design", "product design",
            "mobile design", "responsive design", "usability", "accessibility",
            "user flow", "user flows", "mockup", "mockups"
        ]
    if job_type == "frontend":
        return [
            "react", "next.js", "nextjs", "javascript", "typescript",
            "frontend", "front-end", "ui", "tailwind", "css", "html",
            "redux", "vite", "responsive", "component", "spa", "web app"
        ]
    if job_type == "backend":
        return [
            "api", "apis", "backend", "microservices", "rest", "database",
            "postgresql", "sql", "distributed systems", "scalable", "cloud",
            "docker", "kafka", "pipeline", "etl", "service", "services",
            "authentication", "system design"
        ]
    if job_type == "data":
        return [
            "data pipeline", "data pipelines", "etl", "spark", "airflow",
            "kafka", "warehouse", "snowflake", "bigquery", "dbt",
            "batch processing", "streaming", "data quality", "schema",
            "analytics", "pyspark"
        ]
    if job_type == "ai":
        return [
            "recommendation", "recommendation system", "ranking", "ranker",
            "retrieval", "search", "semantic search", "hybrid search",
            "matching", "embeddings", "embedding", "vector", "vector database",
            "faiss", "milvus", "weaviate", "pinecone", "qdrant",
            "opensearch", "elasticsearch", "bm25", "reranking", "re-ranking",
            "learning to rank", "ndcg", "mrr", "a/b testing", "ab testing",
            "experimentation", "personalization", "llm", "rag", "fine-tuning",
            "lora", "qlora", "peft", "production", "deployed", "real users",
            "scale", "ml system", "machine learning system"
        ]
    return ["production", "deployed", "real users", "scale", "system", "platform", "product"]


def compute_career_relevance(candidate, job_type):
    keywords = career_keywords_for_job(job_type)
    profile = candidate.get("profile", {})
    text_parts = [
        profile.get("headline", ""), profile.get("summary", ""),
        profile.get("current_title", ""), profile.get("current_industry", "")
    ]
    for job in candidate.get("career_history", []):
        text_parts += [
            job.get("title", ""), job.get("company", ""),
            job.get("industry", ""), job.get("description", "")
        ]
    for skill in candidate.get("skills", []):
        text_parts.append(skill.get("name", ""))
    full_text = " ".join(text_parts).lower()
    matches = [kw for kw in keywords if kw in full_text]
    unique_matches = list(dict.fromkeys(matches))
    score = min(len(unique_matches) * 0.035, 0.25)
    return score, unique_matches


def compute_title_fit(candidate, job_type):
    profile = candidate.get("profile", {})
    text = f"{safe_lower(profile.get('current_title'))} {safe_lower(profile.get('headline'))}"
    positive_by_type = {
        "uiux": ["ui designer", "ux designer", "ui/ux designer", "product designer",
                 "visual designer", "interaction designer"],
        "frontend": ["frontend engineer", "frontend developer", "front-end engineer",
                     "front-end developer", "react developer", "ui engineer",
                     "javascript developer", "web developer"],
        "backend": ["backend engineer", "software engineer", "backend developer",
                    "full stack engineer", "platform engineer"],
        "data": ["data engineer", "analytics engineer", "big data engineer", "etl developer"],
        "ai": ["ai engineer", "ml engineer", "machine learning engineer",
               "recommendation systems engineer", "search engineer",
               "nlp engineer", "data scientist"],
        "general": []
    }
    negative_by_type = {
        "uiux": ["backend engineer", "data engineer", "ml engineer",
                 "machine learning engineer", "operations manager",
                 "project manager", "marketing manager", "sales"],
        "frontend": ["backend engineer", "data engineer", "ml engineer",
                     "operations manager", "marketing manager", "sales"],
        "backend": ["ui designer", "ux designer", "product designer",
                    "operations manager", "marketing manager", "sales"],
        "data": ["ui designer", "ux designer", "product designer",
                 "marketing manager", "sales"],
        "ai": ["project manager", "operations manager", "marketing manager",
               "content writer", "sales", "ui designer", "ux designer"],
        "general": []
    }
    if any(w in text for w in positive_by_type.get(job_type, [])):
        return 0.12
    if any(w in text for w in negative_by_type.get(job_type, [])):
        return -0.18
    return 0.0


def compute_company_context(candidate):
    services_companies = [
        "tcs", "infosys", "wipro", "accenture",
        "cognizant", "capgemini", "mindtree"
    ]
    product_keywords = [
        "software", "saas", "platform", "product", "startup",
        "ai", "ml", "marketplace", "search", "recommendation"
    ]
    history = candidate.get("career_history", [])
    if not history:
        return 0.0
    service_count = sum(
        1 for job in history
        if safe_lower(job.get("company", "") or "") in services_companies
    )
    product_signal_count = sum(
        1 for job in history
        if any(kw in f"{safe_lower(job.get('industry', '') or '')} {safe_lower(job.get('description', '') or '')}"
               for kw in product_keywords)
    )
    if service_count == len(history):
        return -0.08
    if product_signal_count > 0:
        return 0.06
    return 0.0


def compute_signal_score(candidate, jd_params):
    signals = candidate.get("redrob_signals", {})
    score = 0.0
    score += 0.08 if signals.get("open_to_work_flag", False) else -0.08
    score += min(float(signals.get("recruiter_response_rate", 0) or 0), 1) * 0.08
    notice = signals.get("notice_period_days", 30) or 30
    if notice <= 30:
        score += 0.05
    elif notice <= 60:
        score += 0.02
    elif notice > 90:
        score -= 0.08
    last_active = signals.get("last_active_days", None)
    if last_active is not None:
        if last_active <= 14:
            score += 0.04
        elif last_active > 180:
            score -= 0.06
    expected_min = (signals.get("expected_salary_range_inr_lpa") or {}).get("min", 0) or 0
    if expected_min > jd_params.get("salary_max", 999):
        score -= 0.08
    preferred_mode = signals.get("preferred_work_mode", "flexible") or "flexible"
    jd_work_mode = jd_params.get("work_mode", "flexible")
    score += 0.02 if preferred_mode == "flexible" else (-0.04 if preferred_mode != jd_work_mode else 0)
    if signals.get("github_activity_score", -1) and signals.get("github_activity_score", -1) > 30:
        score += 0.04
    if signals.get("saved_by_recruiters_30d", 0) >= 10:
        score += 0.04
    return score


# ─────────────────────────────────────────────────────────────────────────────
# EVIDENCE, PROJECT QUALITY, CREDIBILITY, CONFIDENCE
# ─────────────────────────────────────────────────────────────────────────────

def _build_evidence_text(candidate):
    parts = []
    profile = candidate.get("profile", {})
    parts.append(safe_lower(profile.get("headline", "")))
    parts.append(safe_lower(profile.get("summary", "")))
    parts.append(safe_lower(profile.get("current_title", "")))
    for job in candidate.get("career_history", []):
        parts.append(safe_lower(job.get("title", "")))
        parts.append(safe_lower(job.get("description", "")))
    for proj in candidate.get("projects", []):
        parts.append(safe_lower(proj.get("name", "")))
        parts.append(safe_lower(proj.get("description", "")))
        parts.append(safe_lower(proj.get("tech_stack", "")))
        if isinstance(proj.get("tech_stack"), list):
            parts += [safe_lower(t) for t in proj["tech_stack"]]
    for cert in candidate.get("certifications", []):
        parts.append(safe_lower(cert.get("name", "")))
        parts.append(safe_lower(cert.get("issuer", "")))
    return " ".join(parts)


_PRODUCTION_SIGNALS = [
    "production", "distributed system", "microservice", "kafka", "event-driven",
    "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "cloud",
    "ci/cd", "continuous integration", "continuous deployment", "github actions",
    "jenkins", "terraform", "helm", "ansible",
    "machine learning", "deep learning", "llm", "rag", "langchain", "llamaindex",
    "embeddings", "vector database", "fine-tuning", "recommendation system",
    "neural network", "pytorch", "tensorflow", "scikit-learn",
    "data pipeline", "etl", "airflow", "spark", "pyspark", "streaming",
    "real-time", "data warehouse", "bigquery", "snowflake", "dbt",
    "monitoring", "observability", "prometheus", "grafana", "alerting",
    "load balancer", "auto-scaling", "high availability", "fault tolerance",
    "caching", "redis", "message queue", "api gateway",
    "architecture", "system design", "technical lead", "tech lead",
    "designed", "architected", "built from scratch", "greenfield",
    "owned", "ownership", "end-to-end", "full ownership",
    "enterprise", "saas platform", "b2b", "multi-tenant",
]

_IMPACT_PATTERNS = [
    (r"reduc\w* latency", "Reduced latency"),
    (r"improv\w* (response time|speed|performance|throughput)", "Improved performance"),
    (r"(\d+)x (faster|speedup|improvement)", "Speed improvement"),
    (r"(\d+)\s*%\s*(faster|reduction|improvement|increase|decrease|better)", "Measurable impact"),
    (r"reduc\w* (cost|costs|spend|spending)", "Cost reduction"),
    (r"improv\w* (accuracy|precision|recall|f1)", "Accuracy improvement"),
    (r"scal\w* (to|from)?\s*[\d,]+\s*(user|request|transaction|record)", "Scaled to large volume"),
    (r"serv\w* ([\d,]+\s*(user|customer|client|request))", "Served large user base"),
    (r"process\w* ([\d,]+\s*(record|event|message|transaction))", "High-volume processing"),
    (r"uptime.{0,10}(99|100)\s*%", "High availability achieved"),
    (r"zero downtime", "Zero downtime deployment"),
    (r"(millions|billions) of (user|request|record|event)", "Massive scale"),
]

_SOPHISTICATION_WEIGHTS = {
    "kafka": 2, "kubernetes": 2, "distributed system": 2,
    "microservice": 2, "rag": 2, "llm": 2, "machine learning": 2,
    "data pipeline": 2, "spark": 2, "terraform": 2,
    "docker": 1.5, "aws": 1.5, "gcp": 1.5, "azure": 1.5,
    "ci/cd": 1.5, "monitoring": 1.5, "observability": 1.5,
    "architecture": 1.5, "system design": 1.5, "event-driven": 1.5,
    "redis": 1.5, "airflow": 1.5, "embeddings": 1.5,
    "production": 1, "enterprise": 1, "real-time": 1,
    "high availability": 1, "auto-scaling": 1, "caching": 1,
    "owned": 1, "ownership": 1, "architected": 1, "designed": 1,
}


def _extract_project_corpus(candidate):
    corpus = []
    for proj in candidate.get("projects", []):
        name = proj.get("name", "Unnamed Project")
        desc = proj.get("description", "")
        tech = proj.get("tech_stack", "")
        if isinstance(tech, list):
            tech = " ".join(tech)
        combined = f"{desc} {tech}".strip()
        if combined:
            corpus.append((name, combined, "project"))
    for job in candidate.get("career_history", []):
        title = job.get("title", "")
        company = job.get("company", "")
        desc = job.get("description", "")
        if desc:
            label = f"{title} at {company}" if title else f"Role at {company}"
            corpus.append((label, desc, "career"))
    return corpus


def _detect_impact_mentions(text):
    text_lower = text.lower()
    found = []
    for pattern, label in _IMPACT_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            raw = match.group(0).strip()
            raw = re.sub(r"\buser\b$", "users", raw)
            raw = re.sub(r"\brequest\b$", "requests", raw)
            raw = re.sub(r"\brecord\b$", "records", raw)
            raw = re.sub(r"\bevent\b$", "events", raw)
            raw = re.sub(r"\btransaction\b$", "transactions", raw)
            found.append(raw)
    return list(dict.fromkeys(found))


def compute_project_quality_score(candidate):
    corpus = _extract_project_corpus(candidate)
    if not corpus:
        return 0, "No project or work evidence found.", "★☆☆☆☆", {}

    best_score = 0
    best_label = ""
    best_techs = []
    best_impacts = []
    best_type = "project"

    all_production_signals = []
    all_impact_signals = []

    for (label, text, source_type) in corpus:
        text_lower = text.lower()
        sophistication = 0.0
        techs_found = []
        for signal, weight in _SOPHISTICATION_WEIGHTS.items():
            if signal in text_lower:
                sophistication += weight
                techs_found.append(format_term(signal))
        prod_hits = sum(1 for sig in _PRODUCTION_SIGNALS if sig in text_lower)
        all_production_signals.extend([sig for sig in _PRODUCTION_SIGNALS if sig in text_lower])
        impacts = _detect_impact_mentions(text)
        all_impact_signals.extend(impacts)
        piece_score = min(sophistication * 6, 60) + min(prod_hits * 2, 20) + min(len(impacts) * 8, 20)
        piece_score = min(piece_score, 100)
        if piece_score > best_score:
            best_score = piece_score
            best_label = label
            best_techs = techs_found[:6]
            best_impacts = impacts[:4]
            best_type = source_type

    unique_prod = list(dict.fromkeys([format_term(s) for s in all_production_signals]))[:8]
    unique_impacts = list(dict.fromkeys(all_impact_signals))[:4]

    breadth_bonus = min(len(unique_prod) * 1.5, 15)
    final_score = int(min(best_score + breadth_bonus, 100))

    if final_score >= 85:
        stars = "★★★★★"
    elif final_score >= 65:
        stars = "★★★★☆"
    elif final_score >= 45:
        stars = "★★★☆☆"
    elif final_score >= 25:
        stars = "★★☆☆☆"
    else:
        stars = "★☆☆☆☆"

    reason_parts = []
    if best_techs:
        readable_techs = []
        raw_keyword_map = {"designed": None, "owned": None, "production": None, "architecture": None}
        for t in best_techs[:4]:
            if t.lower() not in raw_keyword_map:
                readable_techs.append(t)
        if readable_techs:
            reason_parts.append(
                f"The most relevant project experience is '{best_label}', demonstrating practical experience building with {', '.join(readable_techs)}."
            )
        else:
            reason_parts.append(
                f"The most relevant project experience is '{best_label}', highlighting production engineering capability."
            )
    if unique_impacts:
        reason_parts.append(f"Quantified outcomes include: {'; '.join(unique_impacts[:2])}.")
    if not reason_parts:
        reason_parts.append("Limited evidence of production-scale engineering experience was identified.")

    project_quality_reason = " ".join(reason_parts)

    impressive_evidence = {
        "best_label": best_label,
        "best_type": best_type,
        "key_technologies": best_techs,
        "all_signals": unique_prod,
        "impact_highlights": unique_impacts,
        "project_quality_score": final_score,
        "project_star_rating": stars,
        "why_it_matters": _generate_project_why_it_matters(best_techs, unique_impacts, final_score),
    }

    return final_score, project_quality_reason, stars, impressive_evidence


def _generate_project_why_it_matters(techs, impacts, score):
    parts = []
    tech_lower = [t.lower() for t in techs]
    if any(t in tech_lower for t in ["kafka", "event-driven"]):
        parts.append("event-driven, distributed architecture")
    if any(t in tech_lower for t in ["kubernetes", "docker"]):
        parts.append("production container orchestration")
    if any(t in tech_lower for t in ["aws", "gcp", "azure"]):
        parts.append("cloud infrastructure experience")
    if any(t in tech_lower for t in ["machine learning", "llm", "rag", "embeddings"]):
        parts.append("AI/ML systems engineering")
    if any(t in tech_lower for t in ["microservice", "microservices"]):
        parts.append("microservices architecture")
    if any(t in tech_lower for t in ["monitoring", "observability"]):
        parts.append("production observability practices")
    if any(t in tech_lower for t in ["data pipeline", "spark", "airflow"]):
        parts.append("large-scale data engineering")
    if impacts:
        parts.append("with measurable, quantified outcomes")
    if not parts:
        if score >= 45:
            return "Demonstrates practical engineering experience beyond basic CRUD development."
        return "Limited evidence of production-grade engineering complexity."
    joined = ", ".join(parts[:3])
    return f"Demonstrates {joined} — signals production-scale engineering maturity."


def _enrich_reasoning_with_project_quality(base_reasoning, project_quality_score, project_quality_reason,
                                            project_star_rating, impressive_evidence, candidate=None,
                                            role_alignment_score=1.0, job_type="general"):
    if project_quality_score < 25:
        return base_reasoning

    _pq_labels = [
        "Project quality",
        "Project evidence quality",
        "Overall project quality",
        "Project quality assessment",
    ]
    _pq_label = _pq_labels[hash(str(project_quality_score) + str(project_star_rating)) % len(_pq_labels)]

    proj_insight = (
        f" | {_pq_label}: {project_star_rating} ({project_quality_score}/100). "
        f"{project_quality_reason}"
    )

    _low_alignment = role_alignment_score < 0.35

    if project_quality_score >= 65:
        _raw_kw = {"designed", "owned", "production", "architected", "built", "architecture"}
        clean_techs = [
            t for t in impressive_evidence.get("key_technologies", [])
            if t.lower() not in _raw_kw
        ]
        impacts = impressive_evidence.get("impact_highlights", [])

        if _low_alignment:
            _domain_label = format_term(job_type) if job_type != "general" else "this"
            tech_note = f" ({', '.join(clean_techs[:3])})" if clean_techs else ""
            proj_insight += (
                f" The project work reflects strong engineering depth{tech_note}, "
                f"though it is concentrated outside {_domain_label}-specific domains and does not offset the role alignment gap."
            )
        else:
            _prod_idx = hash(str(project_quality_score) + str(len(clean_techs))) % len(_PRODUCTION_PHRASES)
            proj_insight += f" {_PRODUCTION_PHRASES[_prod_idx]}"

            if clean_techs:
                proj_insight += f", with demonstrated experience in {', '.join(clean_techs[:3])}"
            if impacts:
                proj_insight += f". Quantified outcome: {impacts[0]}"
            proj_insight += "."

    return base_reasoning + proj_insight


def compute_evidence_score(candidate, matched_skills):
    if not matched_skills:
        return 0.0
    evidence_text = _build_evidence_text(candidate)
    validated = 0
    for skill in matched_skills:
        skill_n = normalize_skill(skill)
        if len(skill_n) <= 2:
            if re.search(r'(?<![a-z])' + re.escape(skill_n) + r'(?![a-z])', evidence_text):
                validated += 1
        elif skill_n in evidence_text:
            validated += 1
    return validated / len(matched_skills)


# ─────────────────────────────────────────────────────────────────────────────
# ROLE ALIGNMENT SCORE (legacy fallback)
# ─────────────────────────────────────────────────────────────────────────────

_ROLE_SIGNALS = {
    "frontend": {
        "strong": [
            "frontend", "front-end", "react", "next.js", "ui engineer",
            "javascript developer", "web developer", "frontend developer",
            "frontend engineer"
        ],
        "weak": [
            "operations manager", "accountant", "sales executive",
            "hr manager", "marketing manager", "content writer",
            "data engineer", "ml engineer"
        ]
    },
    "backend": {
        "strong": [
            "backend", "software engineer", "platform engineer",
            "api developer", "server-side", "microservices", "full stack"
        ],
        "weak": [
            "ui designer", "ux designer", "sales", "hr", "accountant",
            "operations manager", "marketing"
        ]
    },
    "uiux": {
        "strong": [
            "ui designer", "ux designer", "product designer", "visual designer",
            "interaction designer", "design", "figma", "wireframe"
        ],
        "weak": [
            "backend engineer", "data engineer", "ml engineer",
            "sales", "accountant", "hr"
        ]
    },
    "data": {
        "strong": [
            "data engineer", "analytics engineer", "etl", "data pipeline",
            "spark", "airflow", "bigquery", "snowflake", "dbt"
        ],
        "weak": [
            "ui designer", "sales", "hr", "marketing", "accountant"
        ]
    },
    "ai": {
        "strong": [
            "ml engineer", "ai engineer", "machine learning", "data scientist",
            "nlp", "recommendation", "search engineer", "llm", "rag"
        ],
        "weak": [
            "ui designer", "sales", "hr", "marketing", "accountant",
            "operations manager"
        ]
    },
    "general": {"strong": [], "weak": []}
}


def compute_role_alignment_score(candidate, job_type):
    signals = _ROLE_SIGNALS.get(job_type, _ROLE_SIGNALS["general"])
    strong_kw = signals["strong"]
    weak_kw   = signals["weak"]

    profile = candidate.get("profile", {})
    text_parts = [
        safe_lower(profile.get("current_title", "")),
        safe_lower(profile.get("headline", "")),
        safe_lower(profile.get("summary", ""))
    ]
    for job in candidate.get("career_history", [])[:5]:
        text_parts.append(safe_lower(job.get("title", "")))
        text_parts.append(safe_lower(job.get("description", "")))
    for proj in candidate.get("projects", []):
        text_parts.append(safe_lower(proj.get("description", "")))
    full_text = " ".join(text_parts)

    strong_hits = sum(1 for kw in strong_kw if kw in full_text)
    weak_hits   = sum(1 for kw in weak_kw   if kw in full_text)

    score = min(strong_hits * 0.15, 0.85)
    score -= weak_hits * 0.12

    if score <= 0.05:
        career_kws = set(career_keywords_for_job(job_type))
        skill_names = {normalize_skill(s.get("name", "")) for s in candidate.get("skills", [])}
        skill_hits  = sum(1 for kw in career_kws if kw in skill_names)
        skill_fallback = min(skill_hits * 0.08, 0.55)
        proj_text = " ".join(
            safe_lower(p.get("description", "") + " " +
                       (p.get("tech_stack") if isinstance(p.get("tech_stack"), str)
                        else " ".join(p.get("tech_stack") or [])))
            for p in candidate.get("projects", [])
        )
        proj_hits = sum(1 for kw in career_kws if kw in proj_text)
        proj_fallback = min(proj_hits * 0.05, 0.30)
        score = max(score, skill_fallback + proj_fallback)

    primary_spec, secondary_spec, _ = detect_candidate_specialization(candidate)

    if primary_spec != job_type and primary_spec != "general":
        spec_signals = _SPECIALIZATION_SIGNALS.get(job_type, {})
        skills_raw = [normalize_skill(s.get("name", "")) for s in candidate.get("skills", []) if s.get("name")]
        job_type_spec_score = sum(
            1.5 for hs in spec_signals.get("heavy_skills", []) if hs in skills_raw
        ) + sum(
            0.5 for kw in spec_signals.get("domain_keywords", []) if kw in full_text
        )
        primary_signals = _SPECIALIZATION_SIGNALS.get(primary_spec, {})
        primary_spec_score = sum(
            1.5 for hs in primary_signals.get("heavy_skills", []) if hs in skills_raw
        ) + sum(
            0.5 for kw in primary_signals.get("domain_keywords", []) if kw in full_text
        )
        ratio = job_type_spec_score / max(primary_spec_score, 0.01)

        if ratio < 0.25:
            score = min(score, 0.35)
        elif ratio < 0.50:
            score = min(score, 0.52)
        elif ratio < 0.75:
            score = min(score, 0.68)

    return max(0.0, min(1.0, score))


# ─────────────────────────────────────────────────────────────────────────────
# EXPERIENCE FIT
# ─────────────────────────────────────────────────────────────────────────────

def compute_experience_fit_score(candidate_years, required_years, required_max=None):
    required_years = max(required_years, 1)
    if required_max and required_max > required_years:
        if required_years <= candidate_years <= required_max:
            return 1.0
        elif candidate_years < required_years:
            diff = required_years - candidate_years
            return max(0.0, 1.0 - diff * 0.15)
        else:
            diff = candidate_years - required_max
            if diff <= 3:
                return 0.92
            elif diff <= 6:
                return 0.82
            else:
                return max(0.65, 0.82 - (diff - 6) * 0.02)
    diff = candidate_years - required_years
    if diff < 0:
        return max(0.0, 1.0 + diff * 0.15)
    elif diff == 0:
        return 1.0
    elif diff <= 3:
        return 0.95
    elif diff <= 6:
        return 0.85
    else:
        return max(0.70, 0.85 - (diff - 6) * 0.02)


# ─────────────────────────────────────────────────────────────────────────────
# HONEYPOT / CREDIBILITY DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def detect_honeypot(candidate):
    skills = candidate.get("skills", [])
    expert_count = 0
    suspicious_expert_count = 0
    for skill in skills:
        if skill.get("proficiency", "") == "expert":
            expert_count += 1
            if skill.get("duration_months", 0) <= 3:
                suspicious_expert_count += 1
    if expert_count >= 8 and suspicious_expert_count >= 4:
        return True
    salary = candidate.get("redrob_signals", {}).get("expected_salary_range_inr_lpa", {})
    if salary.get("min", 0) and salary.get("max", 0) and salary["min"] > salary["max"]:
        return True
    return False


def compute_credibility_score(candidate, matched_skills, evidence_score):
    score = 1.0
    flags = []

    skills_raw = [
        normalize_skill(s.get("name", ""))
        for s in candidate.get("skills", [])
        if s.get("name")
    ]

    counts = Counter(skills_raw)
    dupes = [s for s, c in counts.items() if c > 1]
    if dupes:
        penalty = min(len(dupes) * 0.05, 0.25)
        score -= penalty
        flags.append(f"Duplicate skill entries detected ({len(dupes)} skills repeated)")

    if len(skills_raw) > 20 and evidence_score < 0.3:
        score -= 0.20
        flags.append("Large skill list unsupported by project or work evidence")

    suspicious_expert = sum(
        1 for s in candidate.get("skills", [])
        if s.get("proficiency", "") == "expert" and s.get("duration_months", 99) <= 3
    )
    if suspicious_expert >= 3:
        score -= suspicious_expert * 0.05
        flags.append(f"{suspicious_expert} expert-level skills claimed with <3 months experience")

    salary = candidate.get("redrob_signals", {}).get("expected_salary_range_inr_lpa", {})
    if salary.get("min", 0) and salary.get("max", 0) and salary["min"] > salary["max"]:
        score -= 0.25
        flags.append("Expected salary range is inverted (min > max)")

    if not candidate.get("career_history") and len(skills_raw) > 10:
        score -= 0.15
        flags.append("Extensive skills listed with no career history")

    if evidence_score < 0.25:
        score -= 0.15
        flags.append("Matched skills not supported by project or work descriptions")

    score = max(0.0, min(1.0, score))
    return score, flags


# ─────────────────────────────────────────────────────────────────────────────
# CONFIDENCE LEVEL
# ─────────────────────────────────────────────────────────────────────────────

def compute_confidence_level(evidence_score, credibility_score, skill_match_ratio):
    avg = (evidence_score + credibility_score + skill_match_ratio) / 3
    if avg >= 0.65:
        return "High"
    elif avg >= 0.40:
        return "Moderate"
    return "Low"


# ─────────────────────────────────────────────────────────────────────────────
# RECRUITER-GRADE REASONING (OLD HAND-CRAFTED VERSION)
# ─────────────────────────────────────────────────────────────────────────────

_CLEARLY_UNRELATED_TITLES = {
    "marketing manager", "content writer", "seo analyst", "seo specialist",
    "digital marketing", "social media manager", "brand manager", "marketing executive",
    "accountant", "accounts manager", "finance manager", "financial analyst",
    "hr manager", "human resources", "talent acquisition", "recruiter",
    "operations manager", "project coordinator", "business analyst",
    "sales executive", "sales manager", "business development",
    "mechanical engineer", "civil engineer", "electrical engineer",
    "procurement manager", "supply chain", "logistics",
    "graphic designer", "visual designer",
    "customer support", "customer success", "customer service",
    "teacher", "lecturer", "professor",
    "intern",
}

_TECH_SKILLS_REQUIRING_STRONG_EVIDENCE = {
    "machine learning", "deep learning", "llm", "rag", "pytorch", "tensorflow",
    "scikit-learn", "langchain", "llamaindex", "faiss", "embeddings",
    "kubernetes", "kafka", "spark", "airflow", "terraform", "ansible",
    "docker", "microservices", "distributed systems", "recommendation systems",
    "ranking", "fine-tuning", "lora", "qlora", "peft", "nlp", "transformer",
    "go", "rust", "scala", "erlang",
    "elasticsearch", "opensearch", "vector database", "redis", "mongodb",
    "fastapi", "django", "flask", "spring boot",
}


def _title_is_plausible_for_skill(job_title_lower, skill_n):
    for unrelated in _CLEARLY_UNRELATED_TITLES:
        if unrelated in job_title_lower:
            if skill_n in _TECH_SKILLS_REQUIRING_STRONG_EVIDENCE:
                return False
            if any(generic in skill_n for generic in ("python", "sql", "excel", "powerpoint", "word")):
                return True
            return False
    return True


def _get_evidence_text_for_skill(candidate, skill):
    skill_n = normalize_skill(skill)

    def _skill_in_text(s, text):
        if len(s) <= 2:
            return re.search(r'(?<![a-z])' + re.escape(s) + r'(?![a-z])', text) is not None
        return s in text

    for proj in candidate.get("projects", []):
        proj_text = safe_lower(
            proj.get("description", "") + " " +
            (proj.get("tech_stack") if isinstance(proj.get("tech_stack"), str)
             else " ".join(proj.get("tech_stack") or []))
        )
        if _skill_in_text(skill_n, proj_text) and proj.get("name"):
            return f'"{proj["name"]}" project'

    for job in candidate.get("career_history", []):
        job_desc = safe_lower(job.get("description", ""))
        job_title = safe_lower(job.get("title", ""))
        if _skill_in_text(skill_n, job_desc) and job.get("title"):
            if _title_is_plausible_for_skill(job_title, skill_n):
                return f'{job["title"]} role'
            return None

    for cert in candidate.get("certifications", []):
        if _skill_in_text(skill_n, safe_lower(cert.get("name", ""))):
            return f'{cert["name"]} certification'

    return None


def _get_all_evidence_sources_for_skill(candidate, skill):
    skill_n = normalize_skill(skill)

    def _skill_in_text(s, text):
        if len(s) <= 2:
            return re.search(r'(?<![a-z])' + re.escape(s) + r'(?![a-z])', text) is not None
        return s in text

    projects, roles, certs = [], [], []

    for proj in candidate.get("projects", []):
        proj_text = safe_lower(
            proj.get("description", "") + " " +
            (proj.get("tech_stack") if isinstance(proj.get("tech_stack"), str)
             else " ".join(proj.get("tech_stack") or []))
        )
        if _skill_in_text(skill_n, proj_text) and proj.get("name"):
            projects.append(proj["name"])

    for job in candidate.get("career_history", []):
        job_desc = safe_lower(job.get("description", ""))
        job_title = safe_lower(job.get("title", ""))
        if _skill_in_text(skill_n, job_desc) and job.get("title"):
            if _title_is_plausible_for_skill(job_title, skill_n):
                roles.append(job["title"])

    for cert in candidate.get("certifications", []):
        if _skill_in_text(skill_n, safe_lower(cert.get("name", ""))):
            certs.append(cert["name"])

    total = len(projects) + len(roles) + len(certs)
    if total >= 3 or (projects and roles):
        strength = "Strong"
    elif total >= 1:
        strength = "Moderate"
    else:
        strength = "Weak"

    return {
        "projects": projects[:3],
        "roles":    roles[:2],
        "certs":    certs[:2],
        "strength": strength,
    }


def build_skill_evidence_map(candidate, skills):
    result = []
    for skill in skills:
        ev = _get_all_evidence_sources_for_skill(candidate, skill)
        sources = (
            [f'"{p}" project' for p in ev["projects"]] +
            [f'{r} experience' for r in ev["roles"]] +
            [f'{c} certification' for c in ev["certs"]]
        )
        if not sources:
            sources = ["Skills section only"]
        result.append({
            "skill":    skill,
            "strength": ev["strength"],
            "sources":  sources,
        })
    return result


_SPEC_INTRO_LABELS = [
    "Professional focus",
    "Core expertise",
    "Primary domain",
    "Career specialization",
    "Career focus",
]

_SPEC_PATH_LABELS = [
    "Career path",
    "Professional background",
    "Career trajectory",
    "Career progression",
]

_SKILL_LISTED_INTROS = [
    "Additional technologies listed include",
    "Other listed skills include",
    "The profile also mentions",
    "Additional relevant skills include",
]

_PRODUCTION_PHRASES = [
    "Production-scale engineering experience strengthens this profile",
    "Demonstrated production engineering experience is a key strength of this profile",
    "Experience building production systems contributes positively to the overall ranking",
    "Proven production engineering experience improves this candidate's evaluation",
]

_SKILL_MATCH_PHRASES = [
    "The profile directly matches **{pct}%** of the required skills for this position.",
    "Direct alignment with the job requirements is **{pct}%**.",
    "The profile matches approximately **{pct}%** of the required skills.",
    "Direct skill alignment with the job description is **{pct}%**.",
]

# ── Career keyword to professional phrase mapping ──
_CAREER_PHRASE_MAP = {
    "recommendation": "Recommendation Systems",
    "ranking": "Search Ranking",
    "ranker": "Ranking Algorithms",
    "retrieval": "Information Retrieval",
    "search": "Search Systems",
    "semantic search": "Semantic Search",
    "hybrid search": "Hybrid Search",
    "embeddings": "Embeddings & Vector Search",
    "faiss": "FAISS Vector Search",
    "milvus": "Milvus Vector DB",
    "weaviate": "Weaviate",
    "pinecone": "Pinecone",
    "qdrant": "Qdrant",
    "opensearch": "OpenSearch",
    "elasticsearch": "Elasticsearch",
    "bm25": "BM25",
    "reranking": "Re‑ranking",
    "learning to rank": "Learning to Rank",
    "matching": "Candidate Matching",
    "a/b testing": "A/B Testing",
    "experimentation": "Experimentation",
    "personalization": "Personalization",
    "llm": "Large Language Models (LLMs)",
    "rag": "Retrieval-Augmented Generation (RAG)",
    "fine-tuning": "Fine‑tuning",
    "lora": "LoRA",
    "qlora": "QLoRA",
    "peft": "PEFT",
    "production": "Production Systems",
    "deployed": "Production Deployment",
    "scale": "Large‑Scale Systems",
    "ml system": "ML Systems",
    "machine learning system": "ML Systems",
}



def _is_ai_focused(top_jobs, primary_specialization):
    if primary_specialization == "ai":
        return True
    ai_title_keywords = {
        "ai engineer", "ml engineer", "machine learning engineer",
        "data scientist", "nlp engineer", "search engineer",
        "applied scientist", "research scientist",
        "recommendation engineer", "retrieval engineer",
        "ai researcher", "ai research engineer"
    }
    for title in top_jobs:
        title_lower = title.lower()
        if any(kw in title_lower for kw in ai_title_keywords):
            return True
    return False

def build_reasoning(
    candidate,
    jd_skills,
    matched_skills,
    career_matches,
    experience_years,
    skill_match_ratio,
    sem_score,
    signal_score,
    is_honeypot,
    evidence_score=0.5,
    role_alignment_score=0.5,
    experience_fit_score=0.5,
    credibility_score=1.0,
    credibility_flags=None,
    primary_specialization="general",
    secondary_specialization=None,
    career_trajectory="",
    specialization_penalty=1.0,
    job_type="general",
    required_exp_min=1,
    required_exp_max=None,
    jd_skills_explicit=None,
):
    if is_honeypot:
        return (
            "Suspicious profile pattern detected. "
            "Keyword density is inconsistent with supporting evidence. "
            "This candidate has been significantly down‑ranked."
        )

    profile = candidate.get("profile", {})
    title = profile.get("current_title", "Candidate")
    signals = candidate.get("redrob_signals", {})
    career_history = candidate.get("career_history", [])
    projects = candidate.get("projects", [])

    # Helpers for rotating templates and extracting employer names
    def _rotate(seq):
        cid = str(candidate.get("candidate_id", "")) + str(title)
        return seq[hash(cid) % len(seq)]

    def _get_company_for_role(job_title):
        for job in career_history:
            if job.get("title") == job_title:
                return job.get("company")
        return None

    # ------------------------------------------------------------------
    # 1. Specialization message – single, non‑repetitive
    # ------------------------------------------------------------------

    specialization_is_strength = False
    specialization_msg = ""
    if primary_specialization == job_type:
        if specialization_penalty >= 0.85:
            specialization_is_strength = True
            # Strong match – we'll phrase it as one concise statement
            templates = [
                f"**Primary expertise in {format_term(primary_specialization)}** – a strong match for this role.",
                f"**Specialised in {format_term(primary_specialization)}** – directly aligned with the position.",
                f"**Career focus on {format_term(primary_specialization)}** – highly relevant to the job requirements.",
            ]
            specialization_msg = _rotate(templates)
        else:
            templates = [
                f"**Primary specialisation is {format_term(primary_specialization)}** – partial fit for this role.",
                f"**Background centred on {format_term(primary_specialization)}** – some overlap with the role.",
            ]
            specialization_msg = _rotate(templates)
    else:
        # Different primary domain
        sec_note = f" (secondary {format_term(secondary_specialization)} experience noted)" if secondary_specialization else ""
        if specialization_penalty < 0.55:
            templates = [
                f"**Primary expertise is in {format_term(primary_specialization)}**, with limited alignment to this {format_term(job_type)}‑focused role.{sec_note}",
                f"**Career background is in {format_term(primary_specialization)}** – not a direct match for the {format_term(job_type)} position.{sec_note}",
            ]
        else:
            templates = [
                f"**Professional background is {format_term(primary_specialization)}-oriented** – provides partial alignment with the {format_term(job_type)} role.{sec_note}",
            ]
        specialization_msg = _rotate(templates)

    # ------------------------------------------------------------------
    # 2. Build strengths and concerns
    # ------------------------------------------------------------------
    strengths = []
    concerns = []

    # Add specialization as either strength or concern
    if specialization_is_strength:
        strengths.append(specialization_msg)
    else:
        concerns.append(specialization_msg)

    
    evidenced_skills = []
    unverified_skills = []
    for sk in matched_skills[:10]:
        ev = _get_evidence_text_for_skill(candidate, sk)
        if ev:
            evidenced_skills.append((sk, ev))
        else:
            unverified_skills.append(sk)

    # Skill evidence strengths (only for verified skills)
    for sk, ev in evidenced_skills[:3]:
        # Determine source type and extract job title/company if applicable
        if " role" in ev:
            role_name = ev.replace(" role", "").strip()
            company = _get_company_for_role(role_name)
            company_part = f" at {company}" if company else ""
            templates = [
                f"Applied **{format_term(sk)}** as {article(role_name)} {role_name}{company_part}.",
                f"Built solutions using **{format_term(sk)}** in the {role_name} role{company_part}.",
                f"Hands‑on experience with **{format_term(sk)}** while working as {article(role_name)} {role_name}{company_part}.",
                f"Developed **{format_term(sk)}**–based systems as {article(role_name)} {role_name}{company_part}.",
            ]
            strengths.append(_rotate(templates))
        elif " project" in ev:
            proj_name = ev.replace(" project", "").strip()
            templates = [
                f"Project work on **{format_term(sk)}** – applied in the {proj_name} project.",
                f"Implemented **{format_term(sk)}** during the {proj_name} project.",
                f"Built with **{format_term(sk)}** in the {proj_name} project.",
            ]
            strengths.append(_rotate(templates))
        elif " certification" in ev:
            cert_name = ev.replace(" certification", "").strip()
            strengths.append(f"**{format_term(sk)}** certification – {cert_name}.")
        else:
            # Generic evidence, try to include source
            templates = [
                f"Demonstrated use of **{format_term(sk)}** – evidenced through {ev}.",
                f"Experience with **{format_term(sk)}** confirmed via {ev}.",
            ]
            strengths.append(_rotate(templates))

    # Unverified skills – mention as a concern, not a strength
    if unverified_skills:
        unverified_str = ", ".join(format_term(s) for s in unverified_skills[:4])
        if len(unverified_skills) > 4:
            unverified_str += f" and {len(unverified_skills)-4} other(s)"
        if evidence_score < 0.30:
            concerns.append(
        f"Profile lists {unverified_str}, but these skills are not supported by project or work history."
    )
        else:
            strengths.append(
    f"The profile also lists {unverified_str};although supporting evidence for these skills is limited."
)
          

  
    pct = round(skill_match_ratio * 100)
    skill_match_templates = [
        f"Direct keyword alignment: {pct}%.",
        f"Explicit skill overlap: {pct}%.",
        f"Technical skills coverage: {pct}%.",
    ]
    if pct >= 40:
        strengths.append(_rotate(skill_match_templates))
    else:
        concerns.append(_rotate(skill_match_templates))

    # ------------------------------------------------------------------
    # 5. Role alignment – use actual job titles and career progression
    # ------------------------------------------------------------------
    top_titles = [j.get("title") for j in career_history[:3] if j.get("title")]
    if top_titles and role_alignment_score >= 0.50:
        # Build a progression string (e.g., "Senior ML Engineer → Applied Scientist")
        if len(top_titles) >= 2:
            progression = " → ".join(top_titles[:2])
            templates = [
                f"Recent roles ({progression}) closely match the position’s responsibilities.",
                f"Career progression ({progression}) aligns well with the role’s seniority and domain.",
                f"Experience as {progression} – directly relevant to this job.",
            ]
        else:
            templates = [
                f"Current role as {top_titles[0]} is closely aligned with the position.",
                f"Background as {top_titles[0]} – strong relevance to the role.",
            ]
        strengths.append(_rotate(templates))
    elif top_titles and role_alignment_score < 0.30:
        # Titles are unrelated – mention as a concern (unless they are AI‑focused)
        if not _is_ai_focused(top_titles, primary_specialization):
            titles_str = ", ".join(top_titles[:2])
            concerns.append(
                f"Career history ({titles_str}) shows limited relevance to {article(format_term(job_type))} {format_term(job_type)} role."
            )
    elif career_matches and role_alignment_score >= 0.35:
        # Fallback to career keywords (e.g., "recommendation systems")
        readable = []
        for match in career_matches[:2]:
            mapped = _CAREER_PHRASE_MAP.get(match.lower(), format_term(match))
            readable.append(mapped)
        area = " and ".join(readable) if len(readable) > 1 else readable[0]
        templates = [
            f"Professional background includes {area}.",
            f"Previous work focused on {area}.",
            f"Career history demonstrates experience in {area}.",
        ]
        strengths.append(_rotate(templates))

    # ------------------------------------------------------------------
    # 6. Project evidence – only if projects exist and evidence_score is good
    # ------------------------------------------------------------------
    proj_names = [p.get("name") for p in projects if p.get("name")]
    if proj_names and evidence_score >= 0.50:
        proj_str = ", ".join(f'"{n}"' for n in proj_names[:3])
        templates = [
            f"Project portfolio includes {proj_str} – practical implementation evidence.",
            f"Hands‑on project work: {proj_str}.",
            f"Relevant projects: {proj_str} – demonstrating applied skills.",
        ]
        strengths.append(_rotate(templates))
    elif proj_names and evidence_score < 0.20 and role_alignment_score < 0.35:
        # Not a strength, but mention that projects don't back the required skills
        concerns.append(
            f"Projects ({', '.join(proj_names[:2])}) do not provide sufficient evidence of required skills."
        )

    # ------------------------------------------------------------------
    # 7. Experience fit – use softer wording
    # ------------------------------------------------------------------
    if required_exp_max and required_exp_max > required_exp_min:
        if experience_fit_score >= 1.0:
            strengths.append(
                f"**{experience_years} years** – within the preferred {required_exp_min}–{required_exp_max} years range."
            )
        elif experience_fit_score >= 0.85:
            strengths.append(
                f"{experience_years} years – closely matches the preferred range ({required_exp_min}–{required_exp_max} years)."
            )
        elif experience_fit_score >= 0.70:
            if experience_years < required_exp_min:
                concerns.append(
                    f"{experience_years} years – below the preferred minimum of {required_exp_min} years."
                )
            else:
                concerns.append(
                    f"{experience_years} years – exceeds the preferred range ({required_exp_min}–{required_exp_max} years)."
                )
        elif experience_fit_score < 0.50 and experience_years > 0:
            concerns.append(
                f"**{experience_years} years** – substantially outside the {required_exp_min}–{required_exp_max} yr band."
            )
    else:
        if experience_fit_score >= 0.90:
            strengths.append(f"**{experience_years} years** – closely matches the role requirement.")
        elif experience_fit_score >= 0.70:
            strengths.append(f"{experience_years} years – reasonable fit for the role.")
        elif experience_fit_score < 0.50 and experience_years > 0:
            concerns.append(f"**{experience_years} years** – significantly more experience than requested.")

   
    if credibility_flags:
        filtered = [
            flag for flag in credibility_flags
            if "Matched skills not supported by project or work descriptions" not in flag
        ]
        concerns.extend(filtered[:2])

  
    notice = signals.get("notice_period_days", None)
    if notice is not None:
        if notice > 90:
            concerns.append(f"Notice period of {notice} days exceeds the preferred 30‑day window.")
        elif notice <= 30 and signal_score > 0:
            strengths.append("Available to join within 30 days.")

  
    if skill_match_ratio < 0.30 and evidence_score >= 0.50 and role_alignment_score >= 0.40:
        strengths.append(
            "Although direct keyword overlap is modest, the ranking is supported by strong project evidence, validated experience, and career alignment."
        )

    strengths = strengths[:5]
    concerns = concerns[:3]
    lines = []
    if strengths:
        lines.append("Strengths: " + " | ".join(strengths))  # limit to 5
    if concerns:
        lines.append("Concerns: " + " | ".join(concerns))   # limit to 3

    # Fallback if no lines (should not happen)
    if not lines:
        skill_text = ", ".join(matched_skills[:4]) if matched_skills else "limited direct JD overlap"
        lines.append(
            f"{title} with {experience_years} years experience. "
            f"Career: {career_trajectory}. Matched skills: {skill_text}."
        )

    return " ".join(lines)

def build_low_match_explanation(
    candidate,
    skill_match_ratio,
    overall_score,
    evidence_score,
    credibility_score,
    role_alignment_score,
    experience_years,
):
    if skill_match_ratio >= 0.40:
        return None

    profile   = candidate.get("profile", {})
    title     = profile.get("current_title", "this candidate")
    proj_names = [p.get("name") for p in candidate.get("projects", []) if p.get("name")]

    reasons = []

    if role_alignment_score >= 0.55:
        top_jobs = [j.get("title") for j in candidate.get("career_history", [])[:2] if j.get("title")]
        if top_jobs:
            reasons.append(
                f"Career history ({' → '.join(top_jobs)}) demonstrates strong alignment with this role."
            )
        else:
            reasons.append("Career history demonstrates strong alignment with the overall requirements of the role.")

    if evidence_score >= 0.65 and proj_names:
        proj_str = ", ".join(f'"{n}"' for n in proj_names[:2])
        reasons.append(
            f"Project work ({proj_str}) provides independent evidence of the required technical skills."
        )
    elif evidence_score >= 0.50:
        reasons.append("Project and work experience provide independent evidence of relevant technical skills.")

    if credibility_score >= 0.80:
        reasons.append("The overall profile demonstrates stronger credibility than comparable candidates.")

    if experience_years >= 3:
        reasons.append(f"{experience_years} years of relevant industry experience")

    if not reasons:
        return (
            f"Although direct alignment with the required skills is {round(skill_match_ratio * 100)}%, "
            f"the candidate demonstrates strong transferable experience supported by validated projects and work history. "
            f"The overall profile reflects stronger practical evidence than keyword coverage alone indicates."
        )

    pct = round(skill_match_ratio * 100)
    joined = "; ".join(reasons)
    return (
        f"Although direct alignment with the required skills is {pct}%, "
        f"the candidate ranks competitively due to {joined}. "
        f"The ranking weights validated experience, project quality, and career alignment over keyword coverage alone."
    )


# ─────────────────────────────────────────────────────────────────────────────
# COMPARISON ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def _gap_tier(gap, t1=15, t2=30):
    if gap >= t2:
        return 2
    if gap >= t1:
        return 1
    return 0


_COMPARISON_TABLE = [
    ("evidence_score", 7, lambda w, l: [
        "Technical skills are backed by stronger project and work-history evidence.",
        "Technical competencies are validated through substantially stronger project evidence and professional experience.",
        "Skills are supported by considerably stronger evidence across projects, roles, and work history — not just listed."
    ][_gap_tier(w - l)]),
    ("role_alignment_score", 7, lambda w, l: [
        "Work history aligns more closely with the requirements of this position.",
        "Career history demonstrates closer alignment with the target role across titles and experience.",
        "Career history demonstrates considerably stronger alignment with this position — titles, background, and industry are more consistent with the role."
    ][_gap_tier(w - l)]),
    ("experience_fit_score", 6, lambda w, l: [
        "Experience level is a closer fit for the seniority this role requires.",
        "Experience level more closely matches the position requirements.",
        "Experience level matches the position requirements significantly more closely — neither underqualified nor overqualified."
    ][_gap_tier(w - l)]),
    ("credibility_score", 7, lambda w, l: [
        "Profile credibility is higher — listed skills are more reliably supported by actual experience.",
        "Profile claims are more consistently validated across multiple resume sections.",
        "Profile claims are validated consistently across multiple resume sections with no stuffing signals — higher overall reliability."
    ][_gap_tier(w - l)]),
    ("validated_skill_ratio", 6, lambda w, l: [
        "A greater proportion of listed skills are supported by verifiable evidence.",
        "A significantly higher share of technical skills are supported by project or work history evidence.",
        "The vast majority of listed skills are directly verifiable through project or professional experience — a substantially higher rate than the comparison candidate."
    ][_gap_tier(w - l)]),
    ("validated_skill_count", 5, lambda w, l: [
        "More required skills are backed by supporting evidence.",
        "A greater number of the job's required skills are evidenced across projects and roles.",
        "Substantially more of the required skills are supported by direct evidence — not merely listed."
    ][_gap_tier(w - l, t1=3, t2=6)]),
    ("career_consistency_score", 6, lambda w, l: [
        "Professional history shows a more consistent career focus.",
        "Career progression is more coherent and relevant, with fewer unrelated roles.",
        "Career history reflects a considerably more focused and consistent professional path, with stronger domain continuity."
    ][_gap_tier(w - l)]),
    ("project_relevance_score", 6, lambda w, l: [
        "Project history shows stronger relevance to the requirements of this role.",
        "Project portfolio demonstrates substantially stronger alignment with the skills and experience this role demands.",
        "Project history reflects considerably stronger and more relevant hands-on experience for this type of position."
    ][_gap_tier(w - l)]),
    ("project_quality_score", 8, lambda w, l: [
        "Project history demonstrates stronger production-grade engineering depth.",
        "Project history demonstrates substantially stronger production engineering, including cloud infrastructure or distributed systems experience.",
        "Project history demonstrates considerably stronger production-scale engineering, with measurable technical impact and cloud/distributed systems architecture — a key differentiator over candidates with similar keyword matches."
    ][_gap_tier(w - l, t1=15, t2=30)]),
    ("skill_match", 6, lambda w, l: [
        "A higher proportion of the job's required skills are present in this profile.",
        "Significantly more of the required skills appear in this candidate's background.",
        "The profile covers substantially more of the required skills for this position."
    ][_gap_tier(w - l)]),
    ("career_relevance", 5, lambda w, l: [
        "Career background contains stronger signals relevant to this type of role.",
        "Career signals across titles, descriptions, and industry background are considerably stronger.",
        "Career background demonstrates substantially stronger domain relevance across all profile sections."
    ][_gap_tier(w - l)]),
    ("specialization_fit", 10, lambda w, l: [
        "Career specialization is a closer match for this role type.",
        "Primary career specialization aligns more closely with the target role — this candidate's professional identity fits the position.",
        "Primary career specialization is a considerably stronger match as this candidate's entire career trajectory points toward this type of role."
    ][_gap_tier(w - l, t1=15, t2=30)]),
    ("overall_score", 4, lambda w, l: [
        "Overall profile quality is higher when evaluated across all dimensions.",
        "Overall profile match is stronger across the evaluated dimensions.",
        "Overall profile match is substantially stronger across all evaluated hiring dimensions."
    ][_gap_tier(w - l, t1=10, t2=20)]),
]

_NEAR_IDENTICAL_MSG = (
    "Candidates demonstrate similar technical qualifications; "
    "ranking was influenced by stronger evidence validation and overall profile consistency."
)


def _extract_comparison_signals(result_dict):
    def _get(key):
        v = result_dict.get(key)
        return float(v) if v is not None else 0.0

    spec_penalty_pct = round(float(result_dict.get("specialization_penalty", 1.0)) * 100, 1)

    return {
        "evidence_score":          _get("evidence_score"),
        "role_alignment_score":    _get("role_alignment_score"),
        "experience_fit_score":    _get("experience_fit_score"),
        "credibility_score":       _get("credibility_score"),
        "validated_skill_ratio":   _get("validated_skill_ratio"),
        "validated_skill_count":   _get("validated_skill_count"),
        "career_consistency_score":_get("career_consistency_score"),
        "project_relevance_score": _get("project_relevance_score"),
        "project_quality_score":   _get("project_quality_score"),
        "skill_match":             _get("skill_match"),
        "career_relevance":        _get("career_relevance"),
        "overall_score":           _get("overall_score"),
        "specialization_fit":      spec_penalty_pct,
    }


def _generate_reasons(signals_a, signals_b, perspective="a_over_b", max_reasons=5):
    advantages = []

    for field, min_gap, message_fn in _COMPARISON_TABLE:
        w_val = signals_a.get(field, 0) if perspective == "a_over_b" else signals_b.get(field, 0)
        l_val = signals_b.get(field, 0) if perspective == "a_over_b" else signals_a.get(field, 0)
        gap   = w_val - l_val

        if gap >= min_gap:
            msg = message_fn(w_val, l_val)
            advantages.append((gap, msg))

    advantages.sort(key=lambda x: x[0], reverse=True)

    seen, reasons = set(), []
    for _, msg in advantages:
        if msg not in seen:
            seen.add(msg)
            reasons.append(msg)
        if len(reasons) >= max_reasons:
            break

    return reasons


def _build_comparison_narrative(name_a, name_b, reasons_a, a_ranked_higher):
    if not reasons_a:
        return (
            f"{name_a} and {name_b} have very similar profiles. "
            "Minor differences in evidence depth and profile consistency determined the ranking."
        )

    top = reasons_a[0].rstrip(".")
    rest_count = len(reasons_a) - 1
    direction = "ranked higher" if a_ranked_higher else "ranked lower"

    if rest_count == 0:
        return f"{name_a} {direction} primarily because: {top.lower()}."
    elif rest_count == 1:
        return (
            f"{name_a} {direction} because {top.lower()}, "
            f"and {reasons_a[1].lower()}"
        )
    else:
        return (
            f"{name_a} {direction} due to several advantages: "
            f"{top.lower()}, {reasons_a[1].lower()}, "
            f"and {rest_count - 1} additional factor{'s' if rest_count > 1 else ''}."
        )


def compare_candidates(candidate_a, candidate_b):
    sig_a = _extract_comparison_signals(candidate_a)
    sig_b = _extract_comparison_signals(candidate_b)

    name_a = candidate_a.get("name", "Candidate A")
    name_b = candidate_b.get("name", "Candidate B")

    reasons_a = _generate_reasons(sig_a, sig_b, perspective="a_over_b")
    reasons_b = _generate_reasons(sig_a, sig_b, perspective="b_over_a")

    if not reasons_a:
        reasons_a = [_NEAR_IDENTICAL_MSG]
    if not reasons_b:
        reasons_b = [_NEAR_IDENTICAL_MSG]

    a_ranked_higher = (
        (candidate_a.get("rank") or 999) < (candidate_b.get("rank") or 999)
    )

    signal_deltas = {
        field: round(
            (sig_a.get(field, 0) or 0) - (sig_b.get(field, 0) or 0), 1
        )
        for field, _, __ in _COMPARISON_TABLE
    }

    return {
        "candidate_a":      name_a,
        "candidate_b":      name_b,
        "a_ranked_higher":  a_ranked_higher,
        "reasons_a_higher": reasons_a,
        "reasons_b_higher": reasons_b,
        "signal_deltas":    signal_deltas,
        "narrative":        _build_comparison_narrative(name_a, name_b, reasons_a, a_ranked_higher),
        "top_differentiator": reasons_a[0] if reasons_a and reasons_a[0] != _NEAR_IDENTICAL_MSG else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# FAISS INDEX
# ─────────────────────────────────────────────────────────────────────────────

def build_faiss_index(embeddings):
    embeddings = np.array(embeddings, dtype=np.float32)
    faiss.normalize_L2(embeddings)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)
    return index


# ─────────────────────────────────────────────────────────────────────────────
# MAIN RANKING (DYNAMIC JD SUPPORT)
# ─────────────────────────────────────────────────────────────────────────────

def rank_candidates(
    candidates,
    jd_text,
    jd_params,
    top_n=100,
    job_domain=""
):
    if not candidates:
        return []

    skill_vocabulary = build_skill_vocabulary(candidates)
    jd_profile = parse_jd_profile(jd_text, job_domain, skill_vocabulary)

    domain_scores_multi = jd_profile["domain_scores"]
    job_type = pick_primary_job_type(domain_scores_multi)
    if job_type == "general":
        job_type = detect_job_type(job_domain, jd_text)
    print("DETECTED JOB TYPE:", job_type, "| Domain scores:", domain_scores_multi)

    dynamic_weights = build_dynamic_weights(jd_profile)

    candidate_texts = [create_candidate_text(c) for c in candidates]
    candidate_embeddings = model.encode(candidate_texts, batch_size=64, show_progress_bar=False)
    candidate_embeddings = np.array(candidate_embeddings, dtype=np.float32)
    faiss.normalize_L2(candidate_embeddings)

    index = build_faiss_index(candidate_embeddings)
    jd_embedding = np.array(model.encode([jd_text]), dtype=np.float32)
    faiss.normalize_L2(jd_embedding)

    scores, indices = index.search(jd_embedding, len(candidates))
    similarities = np.zeros(len(candidates))
    for rank_idx, candidate_idx in enumerate(indices[0]):
        similarities[candidate_idx] = scores[0][rank_idx]

    jd_skills_v2 = extract_jd_skills_v2(jd_text, skill_vocabulary, jd_profile)
    jd_skills_explicit_set = jd_skills_v2["explicit_required"]
    jd_skills = jd_skills_explicit_set if len(jd_skills_explicit_set) >= 5 \
        else extract_jd_skills(jd_text, skill_vocabulary, job_type)
    jd_skills_explicit = set(jd_skills)

    _exp_from_profile = jd_profile.get("experience_min")
    _exp_max_from_profile = jd_profile.get("experience_max")
    required_exp = max(
        jd_params.get("min_experience", None) or _exp_from_profile or 1, 1
    )
    required_exp_max = jd_params.get("max_experience", None) or _exp_max_from_profile

    results = []

    for idx, candidate in enumerate(candidates):
        profile = candidate.get("profile", {})

        sem_score      = float(similarities[idx])
        signal_score   = compute_signal_score(candidate, jd_params)
        is_honeypot    = detect_honeypot(candidate)
        experience_years = profile.get("years_of_experience", 0) or 0

        skill_match_ratio, matched_skills = compute_skill_match(candidate, jd_skills)
        _dyn_career_kws = career_keywords_dynamic(jd_profile)
        career_score, career_matches       = compute_career_relevance(candidate, job_type)
        title_fit_score                    = compute_title_fit_dynamic(candidate, jd_profile)
        company_context_score              = compute_company_context(candidate)

        evidence_score        = compute_evidence_score(candidate, matched_skills)
        role_alignment_score  = compute_role_alignment_dynamic(candidate, jd_profile)
        experience_fit_score  = compute_experience_fit_score(experience_years, required_exp, required_max=required_exp_max)
        credibility_score, credibility_flags = compute_credibility_score(
            candidate, matched_skills, evidence_score
        )

        _ev_text   = _build_evidence_text(candidate)
        # IMPORTANT: the API only ever returns matched_skills[:8] to the frontend
        # (see "matched_skills": matched_skills[:8] below). validated_skill_count
        # must be computed against that SAME truncated set, otherwise it can
        # exceed the displayed skill count (e.g. "14/8") when a candidate has
        # more than 8 matched skills.
        _matched_skills_for_display = matched_skills[:8]
        _validated = [s for s in _matched_skills_for_display if normalize_skill(s) in _ev_text]
        validated_skill_count = len(_validated)
        validated_skill_ratio = (
            round(validated_skill_count / len(_matched_skills_for_display) * 100, 1)
            if _matched_skills_for_display else 0.0
        )

        _career_kws = set(career_keywords_dynamic(jd_profile))
        _history = candidate.get("career_history", [])
        if _history:
            _consistent = sum(
                1 for job in _history
                if any(
                    kw in (safe_lower(job.get("title", "")) + " " +
                           safe_lower(job.get("description", "")))
                    for kw in _career_kws
                )
            )
            career_consistency_score = round(min(_consistent / len(_history), 1.0) * 100, 1)
        else:
            career_consistency_score = 0.0

        _project_texts = []
        for proj in candidate.get("projects", []):
            _project_texts.append(
                safe_lower(proj.get("description", "") + " " +
                           " ".join(proj.get("tech_stack", [])))
            )
        for job in candidate.get("career_history", []):
            _project_texts.append(
                safe_lower(job.get("title", "") + " " + job.get("description", ""))
            )

        if _project_texts and jd_skills:
            _jd_skill_set = {normalize_skill(s) for s in jd_skills}
            matched_skills_in_projects = set()
            for text in _project_texts:
                for skill in _jd_skill_set:
                    if skill in text:
                        matched_skills_in_projects.add(skill)
            project_relevance_score = round((len(matched_skills_in_projects) / len(_jd_skill_set)) * 100, 1)
        else:
            project_relevance_score = 0.0

        project_quality_score, project_quality_reason, project_star_rating, impressive_project_evidence = \
            compute_project_quality_score(candidate)

        primary_spec, secondary_spec, career_trajectory = detect_candidate_specialization(candidate)

        _spec_sig = _SPECIALIZATION_SIGNALS.get(job_type, {})
        _prim_sig = _SPECIALIZATION_SIGNALS.get(primary_spec, {})
        _skills_raw_set = {normalize_skill(s.get("name", "")) for s in candidate.get("skills", []) if s.get("name")}
        _all_text_for_spec = safe_lower(
            profile.get("summary", "") + " " + profile.get("headline", "") + " " +
            " ".join(j.get("description", "") for j in candidate.get("career_history", [])[:4])
        )
        _job_type_spec_score = (
            sum(1.5 for hs in _spec_sig.get("heavy_skills", []) if hs in _skills_raw_set) +
            sum(0.5 for kw in _spec_sig.get("domain_keywords", []) if kw in _all_text_for_spec)
        )
        _primary_spec_score = (
            sum(1.5 for hs in _prim_sig.get("heavy_skills", []) if hs in _skills_raw_set) +
            sum(0.5 for kw in _prim_sig.get("domain_keywords", []) if kw in _all_text_for_spec)
        )
        specialization_ratio = _job_type_spec_score / max(_primary_spec_score, 0.01)

        _jt_title_kws = _SPECIALIZATION_SIGNALS.get(job_type, {}).get("title_keywords", [])
        _all_candidate_titles = []
        if profile.get("current_title"):
            _all_candidate_titles.append(safe_lower(profile["current_title"]))
        for _j in candidate.get("career_history", []):
            _all_candidate_titles.append(safe_lower(_j.get("title", "")))
        _has_career_title_match = any(
            any(kw in t for kw in _jt_title_kws)
            for t in _all_candidate_titles
        )
        _unrelated_count, _total_count = _count_unrelated_titles(
            candidate.get("career_history", []),
            profile.get("current_title", "")
        )

        specialization_penalty = compute_specialization_penalty(
            primary_spec,
            job_type,
            specialization_ratio,
            unrelated_title_count=_unrelated_count,
            total_title_count=_total_count,
            has_career_title_match=_has_career_title_match,
        )

        skill_alignment      = skill_match_ratio
        role_alignment       = role_alignment_score
        evidence_w           = evidence_score
        project_quality_w    = project_quality_score / 100.0
        project_relevance_w  = project_relevance_score / 100.0
        experience_fit_w     = experience_fit_score
        sem_w                = sem_score

        dw = dynamic_weights

        hybrid_score = (
            skill_alignment      * dw["skill_alignment"]      +
            sem_w                * dw["sem_w"]                 +
            project_relevance_w  * dw["project_relevance_w"]  +
            evidence_w           * dw["evidence_w"]           +
            project_quality_w    * dw["project_quality_w"]    +
            credibility_score    * dw["credibility_score"]    +
            role_alignment       * dw["role_alignment"]       +
            experience_fit_w     * dw["experience_fit_w"]     +
            career_score          * dw["career_score"]        +
            company_context_score * dw["company_context"]     +
            title_fit_score       * dw["title_fit"]           +
            signal_score          * dw["signal_score"]
        )

        hybrid_score *= specialization_penalty
        if credibility_score < 0.40:
            hybrid_score *= credibility_score + 0.10
        if is_honeypot:
            hybrid_score *= 0.05

        hybrid_score = max(0.0, min(1.0, hybrid_score))

        _penalty_weight = dw.get("_penalty_weight", 0.0)
        hybrid_score, triggered_negatives = apply_dynamic_negative_signals(
            candidate, jd_profile, hybrid_score, penalty_weight=_penalty_weight
        )
        hybrid_score = max(0.0, min(1.0, hybrid_score))

        raw_skills = dedupe_skills([
            skill.get("name", "")
            for skill in candidate.get("skills", [])
            if skill.get("name")
        ])
        display_skills = dedupe_skills(matched_skills + raw_skills)[:8]

        matched_lower = [normalize_skill(s) for s in matched_skills]
        evidence_text = _build_evidence_text(candidate)
        matched_skill_pct = {}
        for skill in display_skills:
            skill_n = normalize_skill(skill)
            if skill_n in matched_lower:
                matched_skill_pct[skill] = 100 if skill_n in evidence_text else 65
            else:
                matched_skill_pct[skill] = 40

        evidence_sources = build_skill_evidence_map(candidate, matched_skills[:8])

        low_match_explanation = build_low_match_explanation(
            candidate,
            skill_match_ratio=skill_match_ratio,
            overall_score=hybrid_score,
            evidence_score=evidence_score,
            credibility_score=credibility_score,
            role_alignment_score=role_alignment_score,
            experience_years=experience_years,
        )

        reasoning = build_reasoning(
            candidate=candidate,
            jd_skills=jd_skills,
            matched_skills=matched_skills,
            career_matches=career_matches,
            experience_years=experience_years,
            skill_match_ratio=skill_match_ratio,
            sem_score=sem_score,
            signal_score=signal_score,
            is_honeypot=is_honeypot,
            evidence_score=evidence_score,
            role_alignment_score=role_alignment_score,
            experience_fit_score=experience_fit_score,
            credibility_score=credibility_score,
            credibility_flags=credibility_flags,
            primary_specialization=primary_spec,
            secondary_specialization=secondary_spec,
            career_trajectory=career_trajectory,
            specialization_penalty=specialization_penalty,
            job_type=job_type,
            required_exp_min=required_exp,
            required_exp_max=required_exp_max,
            jd_skills_explicit=jd_skills_explicit,
        )

        reasoning = _enrich_reasoning_with_project_quality(
            reasoning, project_quality_score, project_quality_reason,
            project_star_rating, impressive_project_evidence,
            role_alignment_score=role_alignment_score,
            job_type=job_type,
        )

        confidence_level = compute_confidence_level(
            evidence_score, credibility_score, skill_match_ratio
        )

        name        = profile.get("anonymized_name", candidate.get("candidate_id", "Unknown"))
        overall_pct = round(hybrid_score * 100, 1)
        technical_pct = round(min(100, sem_score * 100), 1)
        skill_pct   = round(skill_match_ratio * 100, 1)
        career_pct  = round(min(100, max(0, career_score * 400)), 1)
        signal_pct  = round(min(100, max(0, (signal_score + 0.2) * 250)), 1)
        exp_pct     = round(experience_fit_score * 100, 1)

        print(
            name,
            "sem=", round(sem_score, 3),
            "skill=", round(skill_match_ratio, 3),
            "role_align=", round(role_alignment_score, 3),
            "evidence=", round(evidence_score, 3),
            "exp_fit=", round(experience_fit_score, 3),
            "credibility=", round(credibility_score, 3),
            "hybrid=", round(hybrid_score, 3)
        )
        print("ADDING:", name)

        results.append({
            "candidate_id":     candidate.get("candidate_id", "Unknown"),
            "name":             name,
            "rank":             0,
            "score":            round(hybrid_score, 4),
            "overall_score":    overall_pct,
            "technical_match":  technical_pct,
            "skill_match":      skill_pct,
            "skill_scores":     matched_skill_pct,
            "career_relevance": career_pct,
            "behavioral_fit":   signal_pct,
            "experience_match": exp_pct,
            "project_relevance": project_relevance_score,
            "reasoning":        reasoning,
            "reason":           reasoning,
            "skills":           display_skills,
            "matched_skills":   matched_skills[:8],
            "career_matches":   career_matches[:8],
            "experience_years": experience_years,
            "current_title":    profile.get("current_title", ""),
            "headline":         profile.get("headline", ""),
            "location":         profile.get("location", ""),
            "country":          profile.get("country", ""),
            "job_type_detected": job_type,
            "domain_scores":    domain_scores_multi,
            "resume_url":       candidate.get("resume_url", None),
            "evidence_score":          round(evidence_score * 100, 1),
            "role_alignment_score":    round(role_alignment_score * 100, 1),
            "experience_fit_score":    round(experience_fit_score * 100, 1),
            "credibility_score":       round(credibility_score * 100, 1),
            "confidence_level":        confidence_level,
            "credibility_flags":       credibility_flags,
            "is_honeypot":             is_honeypot,
            "validated_skill_count":    validated_skill_count,
            "validated_skill_ratio":    validated_skill_ratio,
            "career_consistency_score": career_consistency_score,
            "project_relevance_score":  project_relevance_score,
            "evidence_sources":         evidence_sources,
            "low_match_explanation":    low_match_explanation,
            "primary_specialization":   primary_spec,
            "secondary_specialization": secondary_spec,
            "career_trajectory":        career_trajectory,
            "specialization_penalty":   round(specialization_penalty, 3),
            "specialization_ratio":     round(specialization_ratio, 3),
            "project_quality_score":        project_quality_score,
            "project_quality_reason":       project_quality_reason,
            "project_star_rating":          project_star_rating,
            "impressive_project_evidence":  impressive_project_evidence,
            "debug": build_debug_bundle(
                jd_profile=jd_profile,
                dynamic_weights=dynamic_weights,
                matched_skills=matched_skills,
                jd_skills_v2=jd_skills_v2,
                triggered_positives=jd_profile.get("positive_signals", []),
                triggered_negatives=triggered_negatives,
                score_components={
                    "skill_alignment":      round(skill_match_ratio, 4),
                    "sem_score":            round(sem_score, 4),
                    "project_relevance":    round(project_relevance_score / 100, 4),
                    "evidence":             round(evidence_score, 4),
                    "project_quality":      round(project_quality_score / 100, 4),
                    "credibility":          round(credibility_score, 4),
                    "role_alignment":       round(role_alignment_score, 4),
                    "experience_fit":       round(experience_fit_score, 4),
                    "career_score":         round(career_score, 4),
                    "specialization_penalty": round(specialization_penalty, 4),
                },
            ),
        })

    results.sort(
        key=lambda item: (
            item["score"],
            item["career_relevance"],
            item["skill_match"],
            item["candidate_id"]
        ),
        reverse=True
    )

    final_results = results[:top_n]
    highest_score = final_results[0]["score"] if final_results else 1

    for rank, item in enumerate(final_results, start=1):
        item["rank"] = rank
        item["display_score"] = round((item["score"] / highest_score) * 100, 1)
        total = len(final_results)
        item["percentile_rank"] = (
            100 if total == 1
            else round(100 * (total - rank) / (total - 1), 1)
        )

    for i in range(min(len(final_results) - 1, 5)):
        final_results[i]["comparison_vs_next"] = compare_candidates(
            final_results[i], final_results[i + 1]
        )

    _assign_recommendations(final_results)

    return final_results


# ─────────────────────────────────────────────────────────────────────────────
# RECOMMENDATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def _assign_recommendations(ranked_results):
    if not ranked_results:
        return

    for item in ranked_results:
        rank = item.get("rank", 99)
        is_honeypot = item.get("is_honeypot", False)

        if is_honeypot:
            item["hiring_recommendation"] = "Not Recommended"
            continue

        evidence    = item.get("evidence_score", 50)
        credibility = item.get("credibility_score", 50)
        proj_qual   = item.get("project_quality_score", 0)
        role_align  = item.get("role_alignment_score", 50)
        conf        = item.get("confidence_level", "Moderate")
        flags       = item.get("credibility_flags", [])

        serious_issue = (len(flags) >= 2 or credibility < 25 or (conf == "Low" and evidence < 20))

        strong_evidence = (
            evidence >= 40 and
            credibility >= 40 and
            proj_qual >= 25 and
            role_align >= 35 and
            conf != "Low"
        )
        good_evidence = (
            evidence >= 20 and
            credibility >= 20 and
            proj_qual >= 8 and
            conf != "Low"
        )
        weak_evidence = (evidence < 15 or credibility < 20 or (conf == "Low" and evidence < 15))

        if rank <= 5:
            rec = "Strong Interview" if not serious_issue else "Review Carefully"
        elif rank <= 15:
            if strong_evidence:
                rec = "Strong Interview"
            elif weak_evidence:
                rec = "Review Carefully"
            else:
                rec = "Interview"
        elif rank <= 30:
            if strong_evidence or good_evidence:
                rec = "Interview"
            elif weak_evidence or credibility < 15 or evidence < 10:
                rec = "Not Recommended"
            else:
                rec = "Review Carefully"
        else:
            if credibility >= 70 and not serious_issue:
                rec = "Review Carefully"
            elif evidence >= 40 and credibility >= 40:
                rec = "Review Carefully"
            elif evidence < 10 or credibility < 15:
                rec = "Not Recommended"
            else:
                rec = "Not Recommended"

        if rec == "Not Recommended" and credibility >= 70 and not serious_issue:
            rec = "Review Carefully"
        if rank > 30 and rec == "Strong Interview":
            rec = "Review Carefully"

        item["hiring_recommendation"] = rec


# ─────────────────────────────────────────────────────────────────────────────
# CSV WRITER
# ─────────────────────────────────────────────────────────────────────────────

def write_csv(ranked_data, output_path):
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["candidate_id", "rank", "score", "reasoning"])
        for item in ranked_data:
            writer.writerow([
                item["candidate_id"],
                item["rank"],
                item["score"],
                item["reasoning"]
            ])