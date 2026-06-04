from __future__ import annotations

import numpy as np


class VectorIndex:
    def __init__(self, vectors: np.ndarray):
        self.vectors = vectors.astype(np.float32)
        self.faiss_index = None
        try:
            import faiss

            self.faiss_index = faiss.IndexFlatIP(self.vectors.shape[1])
            self.faiss_index.add(self.vectors)
        except Exception:
            self.faiss_index = None

    @property
    def faiss_status(self) -> str:
        return "ready" if self.faiss_index is not None else "numpy-fallback"

    def search(self, query: np.ndarray, top_k: int) -> tuple[np.ndarray, np.ndarray]:
        if query.ndim == 1:
            query = query.reshape(1, -1)
        top_k = min(top_k, len(self.vectors))
        if self.faiss_index is not None:
            scores, indices = self.faiss_index.search(query.astype(np.float32), top_k)
            return indices[0], scores[0]
        scores = self.vectors @ query[0]
        indices = np.argsort(-scores)[:top_k]
        return indices, scores[indices]

