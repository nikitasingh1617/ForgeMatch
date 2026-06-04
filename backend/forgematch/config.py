from dataclasses import dataclass, field


@dataclass(frozen=True)
class RankingWeights:
    semantic_match: float = 0.30
    skill_match: float = 0.15
    experience_match: float = 0.12
    title_match: float = 0.10
    behavioral_score: float = 0.10
    engagement_score: float = 0.08
    recruiter_interest: float = 0.07
    location_match: float = 0.03
    notice_period: float = 0.02
    quality_score: float = 0.08


@dataclass(frozen=True)
class RankingConfig:
    retrieve_k: int = 1000
    submission_k: int = 100
    embedding_dim: int = 512
    weights: RankingWeights = field(default_factory=RankingWeights)

