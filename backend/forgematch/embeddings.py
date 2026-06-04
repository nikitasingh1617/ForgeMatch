from __future__ import annotations

import hashlib
from typing import Iterable

import numpy as np

from .utils import norm_text, tokens


class LocalHashingEmbedder:
    def __init__(self, dim: int = 512):
        self.dim = dim

    def encode(self, texts: Iterable[str]) -> np.ndarray:
        if not isinstance(texts, list):
            texts = list(texts)
        vectors = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            for token in tokens(text):
                digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
                index = int.from_bytes(digest[:4], "little") % self.dim
                vectors[row, index] += 1.0 if digest[4] % 2 == 0 else -1.0
            norm = np.linalg.norm(vectors[row])
            if norm:
                vectors[row] /= norm
        return vectors


def build_profile_text(candidate: dict) -> str:
    return norm_text([
        candidate.get("name"),
        candidate.get("title"),
        candidate.get("summary"),
        candidate.get("skills"),
        candidate.get("companies"),
        candidate.get("projects"),
        candidate.get("raw_text"),
    ])

