"""
ranking_dynamic.py
==================
Drop-in upgrade for ranking.py — dynamic JD understanding layer.

Provides:
  parse_jd_profile()         — structured JD parser (regex + keyword, no LLM)
  detect_job_type_multi()    — multi-domain detection with confidence scores
  build_dynamic_weights()    — per-JD adaptive scoring weights
  compute_role_alignment_dynamic()  — JD-driven role alignment (replaces hardcoded _ROLE_SIGNALS)
  extract_jd_skills_v2()     — separates explicit / inferred / nice-to-have skills
  apply_dynamic_negative_signals()  — JD-derived candidate penalties
  parse_experience_requirements()   — richer experience range extraction

All functions are deterministic (regex + keyword), CPU-only, no network calls.
"""

import re
from collections import defaultdict


# ─────────────────────────────────────────────────────────────────────────────
# SEED TAXONOMIES  (kept small; JD parsing drives the real extraction)
# ─────────────────────────────────────────────────────────────────────────────

_DOMAIN_SEED = {
    "ai": {
        "keywords": [
            "machine learning", "deep learning", "llm", "large language model",
            "rag", "retrieval augmented generation", "embeddings", "vector database",
            "recommendation system", "ranking", "search", "nlp",
            "natural language processing", "pytorch", "tensorflow", "scikit-learn",
            "fine-tuning", "lora", "qlora", "peft", "transformer", "faiss",
            "semantic search", "neural network", "model training", "mlflow",
            "langchain", "llamaindex", "openai", "huggingface", "bert", "gpt",
            "milvus", "weaviate", "pinecone", "qdrant", "opensearch",
        ],
        "title_signals": [
            "ml engineer", "ai engineer", "machine learning", "data scientist",
            "nlp engineer", "search engineer", "applied scientist",
            "research scientist", "recommendation engineer", "retrieval engineer",
        ],
    },
    "backend": {
        "keywords": [
            "backend", "fastapi", "django", "flask", "spring boot", "node.js",
            "microservices", "rest api", "graphql", "postgresql", "mysql",
            "system design", "distributed systems", "kafka", "api development",
            "server-side", "database design", "redis", "mongodb",
        ],
        "title_signals": [
            "backend engineer", "backend developer", "software engineer",
            "platform engineer", "api developer", "server-side",
        ],
    },
    "frontend": {
        "keywords": [
            "react", "next.js", "nextjs", "javascript", "typescript",
            "tailwind", "css", "html", "redux", "vite", "webpack",
            "spa", "responsive design", "ui component", "frontend", "front-end",
        ],
        "title_signals": [
            "frontend", "front-end", "react developer", "ui engineer",
            "javascript developer", "web developer",
        ],
    },
    "data": {
        "keywords": [
            "data pipeline", "etl", "spark", "pyspark", "airflow", "kafka",
            "snowflake", "bigquery", "dbt", "databricks", "warehouse",
            "data engineering", "batch processing", "streaming", "hadoop",
        ],
        "title_signals": [
            "data engineer", "analytics engineer", "etl developer",
            "big data", "data platform",
        ],
    },
    "devops": {
        "keywords": [
            "kubernetes", "terraform", "ansible", "jenkins", "ci/cd",
            "helm", "prometheus", "grafana", "infrastructure", "devops",
            "deployment pipeline", "github actions", "gitlab ci",
            "site reliability", "sre",
        ],
        "title_signals": [
            "devops", "sre", "site reliability", "infrastructure engineer",
            "platform engineer", "cloud engineer",
        ],
    },
    "uiux": {
        "keywords": [
            "figma", "wireframe", "wireframing", "prototype", "prototyping",
            "design system", "user research", "ux", "ui design",
            "visual design", "interaction design", "adobe xd", "sketch",
            "usability testing", "user flow", "product design",
        ],
        "title_signals": [
            "ux designer", "ui designer", "product designer",
            "visual designer", "interaction designer",
        ],
    },
    "mobile": {
        "keywords": [
            "ios", "android", "swift", "kotlin", "flutter", "react native",
            "xcode", "mobile app", "play store", "app store", "swiftui",
            "jetpack compose",
        ],
        "title_signals": [
            "ios developer", "android developer", "mobile engineer",
            "flutter developer", "react native developer",
        ],
    },
    "cybersecurity": {
        "keywords": [
            "penetration testing", "pentest", "owasp", "soc", "siem",
            "vulnerability", "threat modeling", "zero trust", "encryption",
            "firewall", "incident response", "malware", "ctf",
            "security engineering", "devsecops",
        ],
        "title_signals": [
            "security engineer", "penetration tester", "soc analyst",
            "cybersecurity", "devsecops",
        ],
    },
    "finance": {
        "keywords": [
            "fintech", "quantitative", "risk management", "financial modeling",
            "trading", "bloomberg", "portfolio", "derivatives", "algorithmic trading",
            "payment", "lending", "banking", "insurance", "quant",
        ],
        "title_signals": [
            "quant", "quantitative analyst", "risk analyst",
            "fintech engineer", "trading engineer",
        ],
    },
    "general": {
        "keywords": [],
        "title_signals": [],
    },
}

# Seniority markers
_SENIORITY_MAP = {
    "junior": ["junior", "entry level", "entry-level", "fresher", "graduate", "intern", "0-2 years"],
    "mid":    ["mid-level", "mid level", "2-5 years", "3-5 years", "intermediate"],
    "senior": ["senior", "sr.", "5+ years", "5-9 years", "6+ years", "experienced", "seasoned"],
    "lead":   ["lead", "principal", "staff", "architect", "founding", "founding engineer",
               "team lead", "tech lead", "head of"],
    "manager":["manager", "director", "vp ", "head of engineering", "cto"],
}

# Section headers that bound JD parsing
_JD_SECTION_HEADERS = [
    r"requirements?", r"qualifications?", r"must[- ]have", r"nice[- ]to[- ]have",
    r"preferred", r"responsibilities", r"duties", r"what you.ll do", r"what we.re looking for",
    r"skills?", r"experience", r"about the role", r"job description", r"disqualifiers?",
    r"we are NOT looking for", r"not a fit", r"you.re NOT",
]

# Negative/disqualifying language patterns
_NEGATIVE_PATTERNS = [
    r"not?\s+(?:a\s+)?pure\s+(research|academic|consulting)",
    r"not?\s+(?:just\s+)?(?:tutorial|framework|beginner)",
    r"not?\s+(?:a\s+)?job\s+hopper",
    r"no\s+(?:recent\s+)?(?:job\s+hop|frequent\s+change)",
    r"must\s+have\s+production",
    r"production[- ](?:only|required|mandatory|experience\s+required)",
    r"not?\s+(?:computer\s+vision\s+without\s+nlp)",
    r"not?\s+(?:only\s+)?consulting",
    r"must\s+be\s+active",
    r"must\s+have\s+(?:shipped|deployed|built|worked\s+on)",
    r"no\s+(?:pure\s+)?academics?",
    r"avoid(?:ing)?\s+(?:candidates?\s+(?:who|with))",
    r"disqualif",
    r"not\s+(?:a\s+)?fit\s+if",
    r"we\s+(?:do\s+not|don.t)\s+want",
]

# Work mode detection
_WORK_MODE_PATTERNS = {
    "remote": [r"\bremote\b", r"work from home", r"wfh", r"fully remote"],
    "onsite": [r"\bonsite\b", r"on-site", r"on site", r"in.office", r"office only"],
    "hybrid": [r"\bhybrid\b", r"partly remote", r"flexible work"],
}

# Availability / urgency signals
_AVAILABILITY_PATTERNS = [
    r"immediate(?:ly)?", r"asap", r"as soon as possible",
    r"within\s+\d+\s+(?:days?|weeks?)",
    r"notice\s+period\s+(?:of\s+)?(?:under|less\s+than|max(?:imum)?|no\s+more\s+than)\s+\d+",
    r"join(?:ing)?\s+within",
]

# Certification/qualification cues
_CERT_PATTERNS = [
    r"(?:aws|gcp|azure|google|microsoft)\s+certified",
    r"certification\s+(?:required|preferred|mandatory|is\s+a\s+plus)",
    r"certified\s+\w+",
    r"must\s+have\s+(?:a\s+)?(?:degree|certification|diploma)",
    r"phd?|m\.?s\.?|master.s|bachelor.s",
]

# ── Skill synonyms (copied from ranking.py to avoid circular import) ──
_SKILL_SYNONYMS = {
    # Python ecosystem
    "python": ["py", "python3", "python 3"],
    "pytorch": ["torch"],
    "tensorflow": ["tf", "tensorflow2", "tensorflow 2"],
    "scikit-learn": ["sklearn", "scikit learn"],
    # LLM / RAG / vector
    "llm": ["large language model", "large language models", "llms"],
    "rag": ["retrieval augmented generation", "retrieval-augmented generation"],
    "langchain": ["lang chain"],
    "llamaindex": ["llama index", "llama-index"],
    "embeddings": ["embedding", "text embeddings", "dense vectors", "vector embeddings"],
    "semantic search": ["dense retrieval", "neural search", "embedding search"],
    "faiss": ["facebook ai similarity search"],
    "vector database": ["vector db", "vector store", "vectordb"],
    # ML ops
    "mlflow": ["ml flow"],
    "fine-tuning": ["finetuning", "fine tuning", "lora", "qlora", "peft"],
    "lora": ["low-rank adaptation", "low rank adaptation"],
    # Search / ranking
    "elasticsearch": ["elastic search", "elastic"],
    "opensearch": ["open search"],
    "recommendation systems": ["recommendation system", "recommender system", "recommender systems", "recsys"],
    "ranking": ["learning to rank", "ltr", "reranking", "re-ranking"],
    # Cloud
    "aws": ["amazon web services", "amazon aws", "ec2", "s3", "sagemaker", "lambda"],
    "gcp": ["google cloud", "google cloud platform", "bigquery", "vertex ai", "dataflow"],
    "azure": ["microsoft azure", "azure ml", "azure openai"],
    # Data / pipelines
    "airflow": ["apache airflow"],
    "spark": ["apache spark", "pyspark"],
    "kafka": ["apache kafka"],
    "dbt": ["data build tool"],
    "postgresql": ["postgres", "pg"],
    # DevOps
    "kubernetes": ["k8s"],
    "docker": ["containerization", "containers"],
    "ci/cd": ["continuous integration", "continuous deployment", "continuous delivery", "github actions", "gitlab ci"],
    # JS / Frontend
    "javascript": ["js", "es6", "ecmascript"],
    "typescript": ["ts"],
    "next.js": ["nextjs", "next js"],
    "node.js": ["nodejs", "node js"],
    "react": ["reactjs", "react.js"],
    # NLP
    "nlp": ["natural language processing", "natural-language processing"],
    "transformer": ["transformers", "bert", "roberta", "t5", "gpt-4", "gpt4", "gpt-3"],
    # Monitoring
    "prometheus": ["metrics monitoring"],
    "grafana": ["dashboard monitoring"],
    # Other
    "rest api": ["rest apis", "restful api", "restful apis", "api development"],
    "microservices": ["microservice", "micro services", "micro-services"],
    "system design": ["distributed systems", "distributed system", "high-level design"],
    "redis": ["redis cache", "in-memory cache"],
    "mongodb": ["mongo db", "mongo"],
    "sql": ["structured query language", "rdbms"],
    "git": ["github", "gitlab", "version control"],
}


# ─────────────────────────────────────────────────────────────────────────────
# 1. MULTI-DOMAIN DETECTION WITH CONFIDENCE SCORES
# ─────────────────────────────────────────────────────────────────────────────

def detect_job_type_multi(job_domain: str, jd_text: str) -> dict:
    """
    Return a dict of {domain: confidence_score} for all plausible domains.

    Replaces the single-label detect_job_type().

    Strategy:
    - Count keyword hits per domain in full JD text (lower weight).
    - Count title-signal hits (higher weight).
    - Normalise to [0, 1] per domain independently (not softmax — each domain
      is independent; JD can span multiple domains legitimately).

    Returns e.g. {"ai": 0.87, "backend": 0.41, "data": 0.22}
    Only domains with score > 0.15 are included (noise filter).
    """
    text = f"{job_domain} {jd_text}".lower()
    scores = {}

    for domain, seed in _DOMAIN_SEED.items():
        if domain == "general":
            continue

        kw_hits = sum(1 for kw in seed["keywords"] if kw in text)
        title_hits = sum(1 for ts in seed["title_signals"] if ts in text)

        # Weighted: title signals count 2x keywords
        raw = kw_hits * 1.0 + title_hits * 2.0

        # Normalise: max raw score varies per domain; use a soft cap
        max_possible = len(seed["keywords"]) + len(seed["title_signals"]) * 2
        normalised = raw / max(max_possible * 0.4, 1)  # 40% of max = score 1.0
        normalised = min(normalised, 1.0)

        if normalised > 0.10:
            scores[domain] = round(normalised, 3)

    if not scores:
        scores["general"] = 1.0
        return scores

    # Sort descending
    return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True))


def pick_primary_job_type(multi_scores: dict, threshold: float = 0.30) -> str:
    """
    Pick the strongest domain label from multi_scores.
    Falls back to 'general' if top confidence is below threshold.
    """
    if not multi_scores:
        return "general"
    top_domain, top_score = next(iter(multi_scores.items()))
    if top_score < threshold:
        return "general"
    return top_domain


# ─────────────────────────────────────────────────────────────────────────────
# 2. EXPERIENCE RANGE PARSING
# ─────────────────────────────────────────────────────────────────────────────

def parse_experience_requirements(jd_text: str) -> dict:
    """
    Extract structured experience requirements from JD text.

    Returns:
        {
            "min_years": int | None,
            "max_years": int | None,
            "seniority": str | None,   # "junior" / "mid" / "senior" / "lead"
            "founding": bool,
        }
    """
    text = jd_text.lower()
    min_y = max_y = None

    # Patterns like "5-9 years", "5 to 9 years"
    band = re.search(r"(\d+)\s*[-–to]+\s*(\d+)\s*(?:years?|yrs?)", text)
    if band:
        min_y = int(band.group(1))
        max_y = int(band.group(2))
    else:
        # "5+ years", "minimum 5 years", "at least 5 years"
        plus = re.search(r"(\d+)\+\s*(?:years?|yrs?)", text)
        if plus:
            min_y = int(plus.group(1))
        else:
            minimum = re.search(
                r"(?:minimum|min(?:imum)?|at\s+least|more\s+than)\s+(\d+)\s*(?:years?|yrs?)",
                text
            )
            if minimum:
                min_y = int(minimum.group(1))
            else:
                # Plain "X years of experience"
                plain = re.search(r"(\d+)\s*(?:years?|yrs?)\s+of\s+(?:relevant\s+)?experience", text)
                if plain:
                    min_y = int(plain.group(1))

    # Seniority label
    seniority = None
    for level, patterns in _SENIORITY_MAP.items():
        if any(p in text for p in patterns):
            seniority = level
            break

    # Infer min/max from seniority label if not already set
    if min_y is None:
        _seniority_defaults = {
            "junior": (0, 2), "mid": (2, 5), "senior": (5, 10),
            "lead": (7, None), "manager": (8, None),
        }
        if seniority in _seniority_defaults:
            min_y, max_y = _seniority_defaults[seniority]

    founding = "founding" in text or "founding engineer" in text

    return {
        "min_years": min_y,
        "max_years": max_y,
        "seniority": seniority,
        "founding": founding,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. FULL JD PROFILE PARSER
# ─────────────────────────────────────────────────────────────────────────────

def _extract_jd_sections(jd_text: str) -> dict:
    """
    Split JD text into labelled sections heuristically.
    Returns {"requirements": str, "nice_to_have": str, "responsibilities": str,
             "negative": str, "full": str}
    """
    text = jd_text
    sections = defaultdict(str)
    sections["full"] = text.lower()

    lines = text.split("\n")
    current_section = "general"
    section_lines = defaultdict(list)

    for line in lines:
        ll = line.lower().strip()
        if not ll:
            continue
        # Detect section header
        for hdr in _JD_SECTION_HEADERS:
            if re.search(hdr, ll, re.IGNORECASE):
                # Map header to canonical key
                if re.search(r"nice[- ]to[- ]have|preferred|bonus|plus", ll):
                    current_section = "nice_to_have"
                elif re.search(r"must[- ]have|requirements?|qualifications?|skills?", ll):
                    current_section = "requirements"
                elif re.search(r"responsibilit|duties|what you.ll do", ll):
                    current_section = "responsibilities"
                elif re.search(r"disqualif|not a fit|we do not want|not looking for|you.re NOT", ll):
                    current_section = "negative"
                break
        section_lines[current_section].append(line)

    for k, v in section_lines.items():
        sections[k] = " ".join(v).lower()

    return dict(sections)


def _extract_skills_from_text(text: str, skill_vocabulary=None) -> list:
    """
    Extract skills from a text string using the shared synonym map + optional vocabulary.
    Returns a deduplicated list of canonical lowercase skill names.
    """
    found = set()
    text_lower = text.lower()

    # Direct vocabulary match
    if skill_vocabulary:
        for skill in sorted(skill_vocabulary, key=len, reverse=True):
            if skill and skill in text_lower:
                found.add(skill.lower())

    # Synonym expansion using local _SKILL_SYNONYMS
    for canonical, aliases in _SKILL_SYNONYMS.items():
        if canonical in text_lower:
            found.add(canonical)
            continue
        for alias in aliases:
            if alias in text_lower:
                found.add(canonical)
                break

    return sorted(found)


def _extract_positive_signals(jd_text: str) -> list:
    """Extract positive signals that the JD emphasises (production, scale, etc.)."""
    text = jd_text.lower()
    signals = []
    _pos_signal_patterns = [
        (r"production[- ](?:grade|ready|scale|system)", "production_grade"),
        (r"large[- ]scale|at\s+scale|millions?\s+of\s+(?:users?|requests?)", "large_scale"),
        (r"real[- ]time|low[- ]latency", "realtime"),
        (r"high\s+availability|fault[- ]toleran", "high_availability"),
        (r"open[- ]source\s+contribution", "open_source"),
        (r"a/b\s+test|experimentation\s+platform", "experimentation"),
        (r"published\s+(?:paper|research)|arxiv|conference", "research_output"),
        (r"deployed\s+(?:to\s+)?(?:production|users)", "deployed"),
        (r"end[- ]to[- ]end|ownership|own(?:ed|ing)\s+the", "ownership"),
        (r"startup|early[- ]stage|founding\s+team", "startup_mindset"),
        (r"github|open[- ]source|side\s+project", "github_active"),
        (r"lead(?:ing)?\s+(?:a\s+)?team|mentoring|mentorship", "leadership"),
        (r"cross[- ]functional|stakeholder|product\s+manager", "cross_functional"),
    ]
    for pattern, label in _pos_signal_patterns:
        if re.search(pattern, text):
            signals.append(label)
    return signals


def _extract_negative_signals(jd_text: str) -> list:
    """Extract negative/disqualifying signals from JD text."""
    text = jd_text.lower()
    signals = []
    for pattern in _NEGATIVE_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            signals.append(m.group(0).strip())
    return signals


def parse_jd_profile(jd_text: str, job_domain: str = "", skill_vocabulary=None) -> dict:
    """
    Parse a Job Description into a structured profile used for dynamic scoring.

    Returns:
    {
        "role_title": str,
        "seniority": str | None,
        "primary_domains": list[str],          # e.g. ["ai", "backend"]
        "domain_scores": dict,                 # e.g. {"ai": 0.87, "backend": 0.42}
        "must_have_skills": list[str],
        "nice_to_have_skills": list[str],
        "tools_and_technologies": list[str],
        "responsibilities": list[str],
        "positive_signals": list[str],
        "negative_signals": list[str],
        "disqualifiers": list[str],
        "experience_min": int | None,
        "experience_max": int | None,
        "work_mode": str,
        "location_preferences": list[str],
        "company_preferences": list[str],
        "availability_preferences": list[str],
        "evaluation_keywords": list[str],
        "domain_confidence": float,
        "_sections": dict,                     # raw sections for debug
    }
    """
    sections = _extract_jd_sections(jd_text)
    full_lower = jd_text.lower()

    # ── Domain detection ──
    domain_scores = detect_job_type_multi(job_domain, jd_text)
    primary_domains = [d for d, s in domain_scores.items() if s >= 0.25]
    if not primary_domains:
        primary_domains = list(domain_scores.keys())[:1] if domain_scores else ["general"]
    domain_confidence = max(domain_scores.values()) if domain_scores else 0.0

    # ── Role title extraction ──
    role_title = ""
    title_match = re.search(
        r"(?:position|role|job\s+title|we.re\s+hiring\s+(?:a|an))[\s:–-]+([A-Za-z /&]+)",
        jd_text, re.IGNORECASE
    )
    if title_match:
        role_title = title_match.group(1).strip()
    if not role_title and job_domain:
        role_title = job_domain

    # ── Experience requirements ──
    exp = parse_experience_requirements(jd_text)
    seniority = exp["seniority"]

    # ── Skills extraction ──
    # "requirements" section only for must-have (not full JD to avoid mixing)
    req_text    = sections.get("requirements", "")
    # Fall back to full text only if the requirements section wasn't detected
    if len(req_text.strip()) < 50:
        req_text = sections.get("full", "")
    nth_text    = sections.get("nice_to_have", "")
    resp_text   = sections.get("responsibilities", "")
    neg_text    = sections.get("negative", "")

    must_have_skills     = _extract_skills_from_text(req_text, skill_vocabulary)
    nice_to_have_skills  = _extract_skills_from_text(nth_text, skill_vocabulary)
    # Subtract must-have from nice-to-have to avoid inflation
    nice_set = set(nice_to_have_skills) - set(must_have_skills)
    nice_to_have_skills = sorted(nice_set)

    # Tools/tech: skills that appear in JD but aren't obviously "must have" or "nice to have"
    all_jd_skills = _extract_skills_from_text(full_lower, skill_vocabulary)
    tools_and_technologies = sorted(set(all_jd_skills) - set(must_have_skills) - nice_set)

    # ── Responsibilities ──
    responsibilities = []
    for line in resp_text.split("."):
        line = line.strip()
        if len(line) > 20:
            responsibilities.append(line[:200])
    responsibilities = responsibilities[:10]

    # ── Positive & negative signals ──
    positive_signals  = _extract_positive_signals(jd_text)
    negative_signals  = _extract_negative_signals(jd_text)

    # ── Disqualifiers: explicitly stated ──
    disqualifiers = []
    if neg_text:
        for sent in re.split(r'[.;\n]', neg_text):
            sent = sent.strip()
            if len(sent) > 10:
                disqualifiers.append(sent[:200])
    disqualifiers = disqualifiers[:5]

    # ── Work mode ──
    work_mode = "flexible"
    for mode, patterns in _WORK_MODE_PATTERNS.items():
        if any(re.search(p, full_lower) for p in patterns):
            work_mode = mode
            break

    # ── Location ──
    location_preferences = []
    loc_match = re.findall(
        r"(?:based\s+in|location|city|office)\s*[:\-–]?\s*([A-Za-z ,]+?)(?:\.|,|\n|$)",
        jd_text, re.IGNORECASE
    )
    location_preferences = [m.strip() for m in loc_match[:3] if len(m.strip()) > 2]

    # ── Availability ──
    availability_preferences = []
    for pat in _AVAILABILITY_PATTERNS:
        m = re.search(pat, full_lower)
        if m:
            availability_preferences.append(m.group(0))

    # ── Evaluation keywords ──
    # All meaningful words in the JD after removing stopwords (quick proxy)
    _stopwords = {
        "and", "or", "the", "a", "an", "in", "of", "to", "for", "with",
        "is", "are", "will", "be", "we", "you", "have", "has", "on", "at",
        "by", "this", "our", "your", "their", "as", "that", "it", "not",
        "but", "from", "should", "can", "who", "what", "when", "where",
        "which", "how", "if", "do", "does", "did", "been", "was", "were",
        "any", "all", "more", "other", "than", "such", "about", "through",
    }
    words = re.findall(r'\b[a-z][a-z\-+#.]{2,}\b', full_lower)
    freq = defaultdict(int)
    for w in words:
        if w not in _stopwords:
            freq[w] += 1
    evaluation_keywords = [w for w, _ in sorted(freq.items(), key=lambda x: -x[1])[:40]]

    return {
        "role_title": role_title,
        "seniority": seniority,
        "primary_domains": primary_domains,
        "domain_scores": domain_scores,
        "must_have_skills": must_have_skills,
        "nice_to_have_skills": nice_to_have_skills,
        "tools_and_technologies": tools_and_technologies,
        "responsibilities": responsibilities,
        "positive_signals": positive_signals,
        "negative_signals": negative_signals,
        "disqualifiers": disqualifiers,
        "experience_min": exp["min_years"],
        "experience_max": exp["max_years"],
        "work_mode": work_mode,
        "location_preferences": location_preferences,
        "company_preferences": [],
        "availability_preferences": availability_preferences,
        "evaluation_keywords": evaluation_keywords,
        "domain_confidence": round(domain_confidence, 3),
        "_sections": {k: v[:500] for k, v in sections.items()},  # truncated for debug
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. DYNAMIC JD SKILL EXTRACTION  (replaces extract_jd_skills)
# ─────────────────────────────────────────────────────────────────────────────

def extract_jd_skills_v2(jd_text: str, skill_vocabulary, jd_profile: dict) -> dict:
    """
    Separate JD skills into three tiers based on evidence from jd_profile.

    Returns:
        {
            "explicit_required": list[str],    # Directly stated in JD
            "inferred_domain":   list[str],    # Implied by domain, NOT in JD
            "nice_to_have":      list[str],    # Bonus skills only
            "all_skills":        list[str],    # Union for backward compatibility
        }
    """
    explicit = set(jd_profile.get("must_have_skills", []))
    nice = set(jd_profile.get("nice_to_have_skills", []))
    tools = set(jd_profile.get("tools_and_technologies", []))

    # explicit = direct + tools (both pulled from JD text directly)
    explicit |= tools

    # Inferred domain skills: from seed taxonomy for each primary domain,
    # but ONLY if NOT in the JD text (pure inference, clearly labelled)
    jd_lower = jd_text.lower()
    inferred = set()
    for domain in jd_profile.get("primary_domains", []):
        seed_kws = _DOMAIN_SEED.get(domain, {}).get("keywords", [])
        for kw in seed_kws:
            if kw not in jd_lower and kw not in explicit:
                inferred.add(kw)

    # Limit inferred to a sensible number to avoid denominator inflation
    inferred = set(list(sorted(inferred))[:15])

    # Subtract overlap
    nice -= explicit
    inferred -= explicit
    inferred -= nice

    all_skills = list(explicit | nice)  # inferred NOT in all_skills by default

    return {
        "explicit_required": sorted(explicit),
        "inferred_domain":   sorted(inferred),
        "nice_to_have":      sorted(nice),
        "all_skills":        all_skills,  # used for backward-compatible skill_match
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. DYNAMIC SCORING WEIGHTS
# ─────────────────────────────────────────────────────────────────────────────

_BASE_WEIGHTS = {
    "skill_alignment":     0.18,
    "sem_w":               0.10,
    "project_relevance_w": 0.12,
    "evidence_w":          0.22,
    "project_quality_w":   0.18,
    "credibility_score":   0.12,
    "role_alignment":      0.16,
    "experience_fit_w":    0.06,
    "career_score":        0.02,
    "company_context":     0.01,
    "title_fit":           0.02,
    "signal_score":        0.01,
}

def build_dynamic_weights(jd_profile: dict) -> dict:
    """
    Adapt base scoring weights to JD emphasis signals.

    Rules (all additive adjustments, then re-normalised):
    - If JD emphasises production deployment → boost project_quality_w, evidence_w
    - If JD emphasises availability/urgency → boost signal_score
    - If JD emphasises certifications → boost evidence_w (certs are evidence)
    - If JD has disqualifiers/negatives → adds penalty_weight field
    - If JD confidence is low → revert toward flat weights
    - If JD stresses must-have skills → boost skill_alignment
    - All weights remain bounded [0.01, 0.35] so no single signal dominates.
    """
    w = dict(_BASE_WEIGHTS)
    ps = set(jd_profile.get("positive_signals", []))
    ns = jd_profile.get("negative_signals", [])
    conf = jd_profile.get("domain_confidence", 0.5)
    must_have_count = len(jd_profile.get("must_have_skills", []))
    has_certs = any(
        re.search(r"certif|degree|phd|master", line, re.IGNORECASE)
        for line in jd_profile.get("evaluation_keywords", [])
    )
    has_disqualifiers = bool(jd_profile.get("disqualifiers"))

    # ── Production deployment emphasis ──
    if "production_grade" in ps or "deployed" in ps or "ownership" in ps:
        w["project_quality_w"] += 0.04
        w["evidence_w"] += 0.03
        w["skill_alignment"] -= 0.02
        w["sem_w"] -= 0.02

    # ── Scale / availability emphasis ──
    if "large_scale" in ps or "realtime" in ps or "high_availability" in ps:
        w["project_quality_w"] += 0.02
        w["project_relevance_w"] += 0.02

    # ── Availability signals ──
    if jd_profile.get("availability_preferences"):
        w["signal_score"] += 0.02
        w["experience_fit_w"] -= 0.01

    # ── Certification emphasis ──
    if has_certs:
        w["evidence_w"] += 0.02
        w["credibility_score"] += 0.01

    # ── Must-have skills emphasis ──
    if must_have_count >= 8:
        w["skill_alignment"] += 0.03
        w["sem_w"] -= 0.01

    # ── Negative signals / disqualifiers ──
    # Reserve space for a penalty weight that will be applied in hybrid score
    if has_disqualifiers or ns:
        w["_penalty_weight"] = 0.08  # used by apply_dynamic_negative_signals
    else:
        w["_penalty_weight"] = 0.0

    # ── Low domain confidence → flatten toward balanced weights ──
    if conf < 0.30:
        flat = 1.0 / len(_BASE_WEIGHTS)
        blend = 0.5  # 50% toward flat
        for k in _BASE_WEIGHTS:
            w[k] = round(w[k] * (1 - blend) + flat * blend, 4)

    # ── Clamp all weights ──
    for k in _BASE_WEIGHTS:
        w[k] = max(0.01, min(0.35, w[k]))

    # ── Normalise (base weights sum to ~1.20; preserve that) ──
    base_sum = sum(_BASE_WEIGHTS.values())
    current_sum = sum(w[k] for k in _BASE_WEIGHTS)
    if current_sum > 0:
        factor = base_sum / current_sum
        for k in _BASE_WEIGHTS:
            w[k] = round(w[k] * factor, 4)

    return w


# ─────────────────────────────────────────────────────────────────────────────
# 6. DYNAMIC ROLE ALIGNMENT  (replaces hardcoded _ROLE_SIGNALS lookup)
# ─────────────────────────────────────────────────────────────────────────────

def compute_role_alignment_dynamic(candidate: dict, jd_profile: dict) -> float:
    """
    Compute role alignment using jd_profile rather than static _ROLE_SIGNALS dicts.

    Strong positive signals come from:
    - JD role title / responsibilities matching candidate titles/headlines
    - JD must-have skills appearing in candidate work descriptions
    - JD positive signals (production, leadership, etc.) matching candidate evidence

    Negative signals come from:
    - JD negative_signals matching candidate evidence
    - JD disqualifiers matching candidate profile

    Returns a score in [0.0, 1.0].
    """

    def _safe_lower(v):
        return str(v or "").lower().strip()

    profile = candidate.get("profile", {})
    text_parts = [
        _safe_lower(profile.get("current_title", "")),
        _safe_lower(profile.get("headline", "")),
        _safe_lower(profile.get("summary", "")),
    ]
    for job in candidate.get("career_history", [])[:5]:
        text_parts.append(_safe_lower(job.get("title", "")))
        text_parts.append(_safe_lower(job.get("description", "")))
    for proj in candidate.get("projects", []):
        text_parts.append(_safe_lower(proj.get("description", "")))
    full_text = " ".join(text_parts)

    score = 0.0

    # ── Positive: JD domain title signals ──
    for domain in jd_profile.get("primary_domains", []):
        seed = _DOMAIN_SEED.get(domain, {})
        title_hits = sum(1 for ts in seed.get("title_signals", []) if ts in full_text)
        score += min(title_hits * 0.15, 0.45)

    # ── Positive: JD must-have skills in candidate evidence ──
    must_skills = jd_profile.get("must_have_skills", [])
    if must_skills:
        skill_hits = sum(1 for s in must_skills if s in full_text)
        score += min(skill_hits / max(len(must_skills), 1) * 0.30, 0.30)

    # ── Positive: JD positive signals matching candidate text ──
    _pos_signal_to_keyword = {
        "production_grade": ["production", "deployed", "prod "],
        "large_scale": ["scale", "million", "billion"],
        "realtime": ["real-time", "realtime", "low-latency"],
        "ownership": ["owned", "ownership", "end-to-end"],
        "startup_mindset": ["startup", "founding", "early-stage"],
        "github_active": ["github", "open source", "side project"],
        "leadership": ["led team", "lead", "mentor", "managed"],
    }
    pos_sigs = jd_profile.get("positive_signals", [])
    for sig in pos_sigs:
        kws = _pos_signal_to_keyword.get(sig, [])
        if any(kw in full_text for kw in kws):
            score += 0.04

    # ── Negative: JD negative signals penalise candidate ──
    neg_sigs = jd_profile.get("negative_signals", [])
    for sig in neg_sigs:
        # Check if candidate text contains evidence that matches the "bad" pattern
        sig_kws = sig.lower().split()
        if any(kw in full_text for kw in sig_kws if len(kw) > 4):
            score -= 0.05

    # ── Negative: JD disqualifiers ──
    for dq in jd_profile.get("disqualifiers", []):
        dq_kws = [w for w in dq.lower().split() if len(w) > 4]
        if dq_kws and sum(1 for kw in dq_kws if kw in full_text) >= 2:
            score -= 0.10

    # ── Negative: candidate in clearly unrelated domain ──
    # Use domain seed keywords to check if candidate's domain is opposite
    primary_domains = jd_profile.get("primary_domains", ["general"])
    # Collect keywords for non-primary domains only
    opposite_domain_kws = []
    for dom, seed in _DOMAIN_SEED.items():
        if dom not in primary_domains and dom != "general":
            opposite_domain_kws.extend(seed.get("title_signals", []))
    opp_hits = sum(
        1 for kw in opposite_domain_kws
        if kw in _safe_lower(profile.get("current_title", "") + " " +
                             profile.get("headline", ""))
    )
    if opp_hits >= 2:
        score -= 0.12

    return max(0.0, min(1.0, score))


# ─────────────────────────────────────────────────────────────────────────────
# 7. DYNAMIC NEGATIVE SIGNAL PENALTIES
# ─────────────────────────────────────────────────────────────────────────────

def apply_dynamic_negative_signals(
    candidate: dict,
    jd_profile: dict,
    hybrid_score: float,
    penalty_weight: float = 0.08,
) -> tuple:
    """
    Apply JD-derived negative signal penalties to hybrid_score.

    Returns (adjusted_score, list_of_triggered_negatives).
    """
    if not jd_profile.get("negative_signals") and not jd_profile.get("disqualifiers"):
        return hybrid_score, []

    def _safe_lower(v):
        return str(v or "").lower().strip()

    profile = candidate.get("profile", {})
    career_history = candidate.get("career_history", [])

    full_text = " ".join([
        _safe_lower(profile.get("summary", "")),
        _safe_lower(profile.get("current_title", "")),
        _safe_lower(profile.get("headline", "")),
    ] + [
        _safe_lower(j.get("description", "") + " " + j.get("title", ""))
        for j in career_history[:4]
    ])

    triggered = []
    total_penalty = 0.0

    # ── Negative signal patterns → candidate evidence checks ──
    _neg_checks = [
        # Pattern in neg_signals       Candidate indicator           Penalty
        ("pure research",         lambda t: "research" in t and "production" not in t,  0.12),
        ("consulting",            lambda t: "consulting" in t or "freelance" in t,       0.06),
        ("tutorial",              lambda t: "tutorial" in t or "udemy" in t,             0.06),
        ("job hopper",            None,  0.0),  # handled separately below
        ("production",            lambda t: "production" not in t,                       0.08),
        ("not active",            None,  0.0),  # handled via signal_score
        ("computer vision without nlp",
                                  lambda t: "computer vision" in t and "nlp" not in t,  0.10),
        ("academic",              lambda t: re.search(r'\bphd\b|\bresearch\b', t) is not None
                                           and "industry" not in t,                      0.08),
    ]

    neg_sigs_text = " ".join(s.lower() for s in jd_profile.get("negative_signals", []))
    for signal_fragment, candidate_check, penalty in _neg_checks:
        if signal_fragment not in neg_sigs_text:
            continue
        if candidate_check and candidate_check(full_text):
            triggered.append(f"JD excludes '{signal_fragment}' pattern — detected in candidate profile")
            total_penalty += penalty

    # ── Job hopper detection ──
    if "job hopper" in neg_sigs_text or "frequent change" in neg_sigs_text:
        job_durations = []
        for job in career_history:
            dur = job.get("duration_months", 0) or 0
            job_durations.append(dur)
        if len(job_durations) >= 3:
            short_stints = sum(1 for d in job_durations if 0 < d < 12)
            if short_stints >= 2:
                triggered.append(f"JD excludes job-hoppers — {short_stints} roles < 12 months detected")
                total_penalty += 0.10

    # ── Disqualifiers: broader text match ──
    for dq in jd_profile.get("disqualifiers", []):
        dq_kws = [w for w in re.findall(r'\b[a-z]{4,}\b', dq.lower())
                  if w not in {"must", "have", "should", "that", "with", "from"}]
        match_count = sum(1 for kw in dq_kws if kw in full_text)
        if dq_kws and match_count / len(dq_kws) >= 0.50:
            triggered.append(f"Possible disqualifier match: {dq[:80]}")
            total_penalty += 0.07

    if not triggered:
        return hybrid_score, []

    # Cap total penalty at penalty_weight so it can't dominate
    total_penalty = min(total_penalty, penalty_weight)
    adjusted = max(0.0, hybrid_score - total_penalty)
    return adjusted, triggered


# ─────────────────────────────────────────────────────────────────────────────
# 8. DYNAMIC CAREER KEYWORDS  (replaces hardcoded career_keywords_for_job)
# ─────────────────────────────────────────────────────────────────────────────

def career_keywords_dynamic(jd_profile: dict) -> list:
    """
    Build career keyword list dynamically from jd_profile instead of
    relying purely on hardcoded per-domain lists.

    Falls back to domain seed if jd_profile is thin.

    Only technical terms, frameworks, tools, and recognized engineering
    concepts are returned.  Generic English words (verbs, pronouns,
    common nouns) are explicitly blocked so they never surface in the
    "Relevant career experience includes …" explanation.
    """
    # Blocklist: generic English words that must never appear as career
    # keywords.  These are the terms that leaked in after the integration
    # of ranking_dynamic.py with ranking.py.
    _GENERIC_BLOCKLIST = {
        # Action / filler verbs
        "actually", "work", "worked", "working", "developed", "develop",
        "using", "used", "use", "with", "through", "responsible",
        "involved", "build", "built", "building", "create", "created",
        "design", "designed", "support", "manage", "managed", "lead",
        "leads", "leading", "ensure", "ensuring", "deliver", "delivering",
        "maintain", "maintaining", "provide", "providing", "define",
        "collaborate", "collaborating", "implement", "implementing",
        "drive", "driving", "review", "reviews", "reviewing",
        # Generic nouns that are not technologies
        "candidate", "experience", "project", "projects", "role", "roles",
        "team", "teams", "system", "systems", "solution", "solutions",
        "feature", "features", "product", "products", "service", "services",
        "process", "processes", "tool", "tools", "data", "model", "models",
        "skill", "skills", "knowledge", "ability", "understanding",
        "background", "area", "areas", "field", "domain", "stack",
        "level", "years", "work", "tasks", "task", "goal", "goals",
        "requirement", "requirements", "best", "good", "strong", "solid",
        "hands", "plus", "well", "also", "etc", "including", "such",
        "like", "other", "need", "needs", "must", "will", "able",
        "able", "across", "within", "based", "related", "focused",
        "relevant", "related", "expected", "preferred", "required",
        "real", "time", "high", "large", "complex", "modern", "various",
        "multiple", "technical", "engineering", "software", "application",
        "applications", "business", "company", "organization",
        "environment", "performance", "quality", "testing", "test",
        "code", "codebase", "standard", "standards", "practice",
        "practices", "approach", "approaches", "strategy", "contribute",
        "contribution", "impact", "results", "outcome", "outcomes",
        "value", "values", "cross", "functional", "internal", "external",
        "existing", "new", "current", "future", "key", "core", "main",
        "primary", "secondary", "senior", "junior", "lead", "principal",
    }

    kws = set()

    # From explicit JD skills (these come from structured extraction — safe)
    kws.update(jd_profile.get("must_have_skills", []))
    kws.update(jd_profile.get("nice_to_have_skills", []))
    kws.update(jd_profile.get("tools_and_technologies", [])[:10])

    # From evaluation keywords — apply blocklist before adding
    for kw in jd_profile.get("evaluation_keywords", [])[:20]:
        if kw.lower() not in _GENERIC_BLOCKLIST:
            kws.add(kw)

    # From positive signals (mapped to specific technical/context terms only)
    _signal_kw_map = {
        "production_grade": ["production", "deployed", "prod"],
        "large_scale": ["scale", "scalable", "millions"],
        "realtime": ["real-time", "low-latency"],
        "ownership": ["ownership"],
    }
    for sig in jd_profile.get("positive_signals", []):
        kws.update(_signal_kw_map.get(sig, []))

    # Supplement with domain seed keywords for primary domain
    for domain in jd_profile.get("primary_domains", []):
        seed_kws = _DOMAIN_SEED.get(domain, {}).get("keywords", [])
        kws.update(seed_kws[:10])

    # Final pass: remove very short tokens AND any generic blocklisted word
    kws = {k for k in kws if len(k) >= 3 and k.lower() not in _GENERIC_BLOCKLIST}
    return sorted(kws)


# ─────────────────────────────────────────────────────────────────────────────
# 9. DYNAMIC TITLE FIT  (replaces hardcoded compute_title_fit)
# ─────────────────────────────────────────────────────────────────────────────

def compute_title_fit_dynamic(candidate: dict, jd_profile: dict) -> float:
    """
    Score title fit using JD profile rather than hardcoded domain lists.
    Returns float in [-0.18, 0.12].
    """
    def _safe_lower(v):
        return str(v or "").lower().strip()

    profile = candidate.get("profile", {})
    text = _safe_lower(profile.get("current_title", "")) + " " + \
           _safe_lower(profile.get("headline", ""))

    positive_score = 0.0
    negative_score = 0.0

    # Positive: JD domain title signals
    for domain in jd_profile.get("primary_domains", []):
        seed = _DOMAIN_SEED.get(domain, {})
        for ts in seed.get("title_signals", []):
            if ts in text:
                positive_score += 0.06
                break  # one hit per domain is enough

    # Positive: JD role title in candidate title
    role_title = jd_profile.get("role_title", "").lower()
    if role_title and len(role_title) > 5:
        overlap_words = set(role_title.split()) & set(text.split())
        if len(overlap_words) >= 2:
            positive_score += 0.04

    # Negative: candidate in completely unrelated domain
    primary_domains = set(jd_profile.get("primary_domains", []))
    for dom, seed in _DOMAIN_SEED.items():
        if dom in primary_domains or dom == "general":
            continue
        for ts in seed.get("title_signals", []):
            if ts in text:
                negative_score += 0.06
                break

    score = min(positive_score, 0.12) - min(negative_score, 0.18)
    return max(-0.18, min(0.12, score))


# ─────────────────────────────────────────────────────────────────────────────
# 10. DEBUG BUNDLE BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_debug_bundle(
    jd_profile: dict,
    dynamic_weights: dict,
    matched_skills: list,
    jd_skills_v2: dict,
    triggered_positives: list,
    triggered_negatives: list,
    score_components: dict,
) -> dict:
    """
    Build an optional debug bundle that can be attached to result dicts
    under a 'debug' key without breaking frontend compatibility.
    """
    must_have_set = set(jd_profile.get("must_have_skills", []))
    nice_set = set(jd_profile.get("nice_to_have_skills", []))

    matched_must_have   = [s for s in matched_skills if s in must_have_set]
    matched_nice        = [s for s in matched_skills if s in nice_set]
    matched_other       = [s for s in matched_skills
                           if s not in must_have_set and s not in nice_set]

    return {
        "jd_profile_summary": {
            "role_title": jd_profile.get("role_title"),
            "seniority": jd_profile.get("seniority"),
            "primary_domains": jd_profile.get("primary_domains"),
            "domain_confidence": jd_profile.get("domain_confidence"),
            "experience_min": jd_profile.get("experience_min"),
            "experience_max": jd_profile.get("experience_max"),
        },
        "dynamic_weights": dynamic_weights,
        "matched_must_have_skills": matched_must_have,
        "matched_nice_to_have_skills": matched_nice,
        "matched_other_skills": matched_other,
        "triggered_positive_signals": triggered_positives,
        "triggered_negative_signals": triggered_negatives,
        "score_breakdown": score_components,
        "explicit_required_count": len(jd_skills_v2.get("explicit_required", [])),
        "inferred_domain_count": len(jd_skills_v2.get("inferred_domain", [])),
    }