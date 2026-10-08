"""Generate the hero's celestial-instrument SVGs into images/ (deterministic).

Run: python3 scripts/make_sky.py   (optionally pass another output directory)
"""
import math
import random
import sys
from pathlib import Path

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'images'
C = 320  # centre of the 640 x 640 artboard
rng = random.Random(20261008)


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def polar(r, deg):
    a = math.radians(deg - 90)
    return C + r * math.cos(a), C + r * math.sin(a)


# ---------- Rotating sky chart: declination circles, hour lines, stars, constellations.
chart = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="none">',
         '<!-- Southern sky around the celestial pole; rotated slowly by CSS. -->']
chart.append('<g stroke="#c8eef6">')
for r, op, dash in [(65, .2, ''), (130, .16, '1 5'), (195, .16, ''), (260, .24, '')]:
    d = f' stroke-dasharray="{dash}"' if dash else ''
    chart.append(f'<circle cx="{C}" cy="{C}" r="{r}" stroke-opacity="{op}" stroke-width=".8"{d}/>')
paths = []
for k in range(24):
    deg = k * 15
    inner = 22 if k % 6 == 0 else (65 if k % 2 == 0 else 130)
    x1, y1 = polar(inner, deg)
    x2, y2 = polar(260, deg)
    paths.append(f'M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}')
chart.append(f'<path d="{"".join(paths)}" stroke-opacity=".1" stroke-width=".7"/>')
chart.append('</g>')

# Field stars: uniform over the disc, three magnitudes, drawn as zero-length round strokes.
groups = {1.1: [], 1.8: [], 2.7: []}
for _ in range(190):
    r = 268 * math.sqrt(rng.random())
    if r < 26:
        continue
    x, y = polar(r, rng.random() * 360)
    m = rng.random()
    size = 2.7 if m > .93 else 1.8 if m > .7 else 1.1
    groups[size].append(f'M{round(x)} {round(y)}h0')
for size, op in [(1.1, .55), (1.8, .75), (2.7, .95)]:
    chart.append(f'<path d="{"".join(groups[size])}" stroke="#eafcff" stroke-opacity="{op}" '
                 f'stroke-width="{size}" stroke-linecap="round"/>')


def constellation(points, lines, label_pos=None):
    out = []
    seg = ''.join(f'M{f(points[a][0])} {f(points[a][1])}L{f(points[b][0])} {f(points[b][1])}' for a, b in lines)
    out.append(f'<path d="{seg}" stroke="#a4dfeb" stroke-opacity=".55" stroke-width=".9"/>')
    for x, y, s in points:
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{s * 2.6}" fill="#a4dfeb" fill-opacity=".14"/>')
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{s}" fill="#f2feff"/>')
    return out


def place(shape, r, deg, scale, turn):
    cx, cy = polar(r, deg)
    t = math.radians(turn)
    return [(cx + scale * (x * math.cos(t) - y * math.sin(t)), cy + scale * (x * math.sin(t) + y * math.cos(t)), s)
            for x, y, s in shape]


# Crux (Southern Cross) with the two Pointers.
crux = [(0, -46, 2.1), (0, 40, 2.6), (-24, -2, 2.2), (20, -14, 1.5), (-78, 58, 2.6), (-110, 38, 2.4)]
chart += constellation(place(crux, 150, 214, .95, -18), [(0, 1), (2, 3), (4, 5)])
# Triangulum Australe.
tri = [(0, -30, 2.2), (34, 22, 1.9), (-30, 20, 1.9)]
chart += constellation(place(tri, 178, 92, 1, 12), [(0, 1), (1, 2), (2, 0)])
# Octans, near the pole.
octans = [(0, 0, 1.4), (30, 18, 1.6), (62, 4, 1.3)]
chart += constellation(place(octans, 100, 330, 1, 0), [(0, 1), (1, 2)])
chart.append('</svg>')

# ---------- Fixed instrument dial: frame rings, degree ticks and hour labels.
dial = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="none">',
        '<!-- Fixed outer dial of the star chart. -->', '<g stroke="#d6f2f8">']
dial.append(f'<circle cx="{C}" cy="{C}" r="288" stroke-opacity=".38" stroke-width=".9"/>')
dial.append(f'<circle cx="{C}" cy="{C}" r="276" stroke-opacity=".18" stroke-width=".7"/>')
for r, w, count, mark, op in [(282, 6, 180, .7, .34), (281, 8, 36, 1.1, .6)]:
    circumference = 2 * math.pi * r
    step = circumference / count
    dial.append(f'<circle cx="{C}" cy="{C}" r="{r}" stroke-opacity="{op}" stroke-width="{w}" '
                f'stroke-dasharray="{mark} {f(step - mark)}" transform="rotate(-90.1 {C} {C})"/>')
dial.append('</g>')
dial.append('<g fill="#d6f2f8" fill-opacity=".6" font-family="Georgia, \'Times New Roman\', serif" '
            'font-size="10" letter-spacing="1.5" text-anchor="middle">')
for k in range(12):
    x, y = polar(304, k * 30)
    dial.append(f'<text x="{f(x)}" y="{f(y + 3.5)}">{k * 2}h</text>')
dial.append('</g>')
# Cardinal cross-hairs just inside the frame.
dial.append('<path d="M320 34v16M320 590v16M34 320h16M590 320h16" stroke="#eafcff" stroke-opacity=".7" stroke-width="1"/>')
dial.append('</svg>')

# ---------- Aurora: soft ribbons, blurred once inside the image.
aurora = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" fill="none">
<!-- Soft aurora ribbons; the blur is rendered once, motion is CSS transform only. -->
<defs>
<linearGradient id="a" x1="40" y1="0" x2="760" y2="0" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#5fe3c4" stop-opacity="0"/><stop offset=".28" stop-color="#5fe3c4" stop-opacity=".55"/>
<stop offset=".58" stop-color="#49c6d6" stop-opacity=".42"/><stop offset=".86" stop-color="#8fa4f4" stop-opacity=".2"/>
<stop offset="1" stop-color="#8fa4f4" stop-opacity="0"/></linearGradient>
<linearGradient id="b" x1="80" y1="0" x2="720" y2="0" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#7cf0d2" stop-opacity="0"/><stop offset=".45" stop-color="#7cf0d2" stop-opacity=".5"/>
<stop offset="1" stop-color="#7cf0d2" stop-opacity="0"/></linearGradient>
<filter id="s" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="t" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
<g filter="url(#s)">
<path d="M40 250C180 150 300 290 430 200S650 120 760 170" stroke="url(#a)" stroke-width="70" stroke-linecap="round"/>
<path d="M90 300C230 240 340 330 470 260S660 210 740 240" stroke="url(#a)" stroke-width="40" stroke-linecap="round" opacity=".6"/>
</g>
<path d="M80 236C210 150 310 268 440 190S640 118 730 156" stroke="url(#b)" stroke-width="3" filter="url(#t)"/>
</svg>
'''

# ---------- Pole star: tapered rays, short diagonals, bright core.
star = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<!-- The pole star: long tapered rays, short diagonals and a bright core. -->
<defs>
<radialGradient id="g" cx="100" cy="100" r="96" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#d9f8ff"/><stop offset="1" stop-color="#8ad8ea" stop-opacity=".2"/></radialGradient>
<radialGradient id="c" cx="100" cy="100" r="16" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>
<path d="M100 4 104.5 95.5 196 100 104.5 104.5 100 196 95.5 104.5 4 100 95.5 95.5Z" fill="url(#g)"/>
{diagonals}
<circle cx="100" cy="100" r="16" fill="url(#c)"/>
</svg>
'''

def star_path(tip, waist, offset):
    pts = []
    for k in range(8):
        ang = math.radians(offset + k * 45 - 90)
        r = tip if k % 2 == 0 else waist
        pts.append(f'{f(100 + r * math.cos(ang))} {f(100 + r * math.sin(ang))}')
    return 'M' + ' '.join(pts) + 'Z'


star = star.replace('{diagonals}', f'<path d="{star_path(44, 3.2, 45)}" fill="#e6fbff" fill-opacity=".6"/>')
(OUT / 'polar-sky-chart.svg').write_text('\n'.join(chart) + '\n')
(OUT / 'polar-sky-dial.svg').write_text('\n'.join(dial) + '\n')
(OUT / 'polar-aurora.svg').write_text(aurora)
(OUT / 'polar-pole-star.svg').write_text(star)
for name in ['polar-sky-chart.svg', 'polar-sky-dial.svg', 'polar-aurora.svg', 'polar-pole-star.svg']:
    print(name, (OUT / name).stat().st_size)
