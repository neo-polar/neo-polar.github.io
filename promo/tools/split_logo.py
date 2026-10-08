"""Split images/Polar_logo.png into white, separately animatable parts.

Writes promo/assets/logo-{bar-top,bar-bottom,dot,ring,P,O,L,A,R}.png. Every part keeps
the full 1870×446 crop, so the parts line up when drawn at the same position. Also
prints the ellipse fitted to the ring, which promo.js uses as LOGO.ring.

Usage: python3 promo/tools/split_logo.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'images' / 'Polar_logo.png'
OUT = ROOT / 'promo' / 'assets'
CROP = (150, 136, 2020, 582)  # x0, y0, x1, y1 around the artwork


def label(mask):
    """4-connected component labels, numbered in scanline order."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    count = 0
    for y in range(h):
        for x in np.nonzero(mask[y] & (labels[y] == 0))[0]:
            if labels[y, x]:
                continue
            count += 1
            labels[y, x] = count
            queue = deque([(y, x)])
            while queue:
                cy, cx = queue.popleft()
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = count
                        queue.append((ny, nx))
    return labels


def main():
    alpha = np.array(Image.open(SOURCE))[..., 3].astype(np.float32) / 255
    labels = label(alpha > 0.5)
    # name the large components by position: mark parts on the left, letters left to right
    sizes = np.bincount(labels.ravel())
    big = [k for k in range(1, len(sizes)) if sizes[k] > 1000]
    boxes = {}
    for k in big:
        ys, xs = np.nonzero(labels == k)
        boxes[k] = (xs.min(), xs.max(), ys.min(), ys.max())
    mark = sorted((k for k in big if boxes[k][0] < 620), key=lambda k: boxes[k][2])
    letters = sorted((k for k in big if boxes[k][0] >= 620), key=lambda k: boxes[k][0])
    widest = max(mark, key=lambda k: boxes[k][1] - boxes[k][0])
    bars = sorted((k for k in mark if k != widest and boxes[k][1] - boxes[k][0] < 115 and boxes[k][0] < 300), key=lambda k: boxes[k][2])
    dot = next(k for k in mark if k not in bars and k != widest)
    names = {bars[0]: 'bar-top', bars[1]: 'bar-bottom', dot: 'dot', widest: 'ring'}
    names.update(zip(letters, 'POLAR'))

    # let each part keep its own anti-aliased edge pixels
    grown = labels.copy()
    for _ in range(6):
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted = np.roll(grown, (dy, dx), axis=(0, 1))
            fill = (grown == 0) & (shifted > 0) & (alpha > 0.004)
            grown[fill] = shifted[fill]

    x0, y0, x1, y1 = CROP
    OUT.mkdir(parents=True, exist_ok=True)
    for k, name in names.items():
        part = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        part[..., :3] = 255
        part[..., 3] = np.round(alpha[y0:y1, x0:x1] * (grown[y0:y1, x0:x1] == k) * 255).astype(np.uint8)
        Image.fromarray(part).save(OUT / f'logo-{name}.png', optimize=True)

    # ellipse through the ring (weighted algebraic conic fit), in crop coordinates
    ys, xs = np.nonzero(labels == widest)
    weights = alpha[labels == widest]
    xs = xs - x0 + 0.5
    ys = ys - y0 + 0.5
    design = np.stack([xs * xs, xs * ys, ys * ys, xs, ys, np.ones_like(xs)], 1) * np.sqrt(weights)[:, None]
    a, b, c, d, e, f = np.linalg.svd(design, full_matrices=False)[2][-1]
    quad = np.array([[a, b / 2], [b / 2, c]])
    centre = np.linalg.solve(2 * quad, [-d, -e])
    const = f + (d * centre[0] + e * centre[1]) / 2
    values, vectors = np.linalg.eigh(quad)
    axes = np.sqrt(-const / values)
    major = np.argmax(axes)
    angle = np.degrees(np.arctan2(vectors[1, major], vectors[0, major]))
    print(f'ring: cx={centre[0]:.3f} cy={centre[1]:.3f} rx={axes.max():.3f} ry={axes.min():.3f} angle={angle:.4f}')


if __name__ == '__main__':
    main()
