"""Project high-dimensional paper vectors to 2D for the map.

UMAP gives the best cluster separation, but it's a heavy, sometimes-awkward dependency
(numba) on Windows — so it's optional and we fall back to a dependency-free PCA (NumPy SVD).
Either way the output is min-max scaled to a fixed [0, 100] box the frontend can fit.
"""

from __future__ import annotations

import numpy as np


def _pca_2d(vectors: np.ndarray) -> np.ndarray:
    centered = vectors - vectors.mean(axis=0, keepdims=True)
    # Top-2 right singular vectors → first two principal components.
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    return centered @ vt[:2].T


def _scale(coords: np.ndarray, lo: float = 0.0, hi: float = 100.0) -> np.ndarray:
    out = coords.astype(float).copy()
    for axis in range(out.shape[1]):
        col = out[:, axis]
        span = col.max() - col.min()
        out[:, axis] = (col - col.min()) / span * (hi - lo) + lo if span > 1e-9 else (hi + lo) / 2
    return out


def _tsne_2d(vectors: np.ndarray) -> np.ndarray:
    from sklearn.manifold import TSNE

    n = vectors.shape[0]
    tsne = TSNE(
        n_components=2,
        perplexity=min(30, max(5, (n - 1) // 3)),
        init="pca",
        learning_rate="auto",
        random_state=42,
    )
    return np.asarray(tsne.fit_transform(vectors))


def project_2d(vectors: np.ndarray) -> np.ndarray:
    """Return an (N, 2) array of map coordinates.

    Preference: UMAP (best separation, optional dep) → t-SNE (scikit-learn, gives the
    separated-islands look) → PCA (always available). PCA alone tends to collapse the corpus
    into a central blob, so it's only the last resort / tiny-N path.
    """
    n = vectors.shape[0]
    if n == 0:
        return np.zeros((0, 2))
    if n < 6:
        coords = _pca_2d(vectors) if n >= 2 else np.zeros((n, 2))
        return _scale(coords) if n >= 2 else coords

    try:
        import umap  # type: ignore

        coords = np.asarray(
            umap.UMAP(
                n_components=2, metric="cosine", n_neighbors=min(15, n - 1),
                min_dist=0.12, random_state=42,
            ).fit_transform(vectors)
        )
    except Exception:
        try:
            coords = _tsne_2d(vectors)
        except Exception:
            coords = _pca_2d(vectors)
    return _scale(coords)
