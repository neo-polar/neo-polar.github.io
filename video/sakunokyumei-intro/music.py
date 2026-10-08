"""朔之玖溟 チャンネル紹介動画の BGM（オリジナル・numpy だけで合成）

    python3 music.py      -> build/music.wav（48 kHz / ステレオ / -16 LUFS）

ピアノ・パッド・鐘・波の音を、scene.html の場面の切り替わりに合わせて鳴らします。
既存の楽曲や音源素材は使っていないので、YouTube の著作権表示の心配はありません。
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000
DURATION = 82.0
N = int(SR * DURATION)
BUILD = Path(__file__).resolve().parent / 'build'
rng = np.random.default_rng(2008)
t_all = np.arange(N) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def place(bus, start, signal):
    """signal（ステレオ）を bus の start 秒の位置に足し込む"""
    i = int(start * SR)
    if i >= N:
        return
    j = min(N, i + signal.shape[1])
    bus[:, i:j] += signal[:, : j - i]


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def pan(mono, p):
    """p = -1（左）〜 1（右）の等パワー定位"""
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)])


def fft_filter(x, lo=None, hi=None, tilt=0.0):
    """周波数領域で帯域を整える（lo/hi はなだらかな肩、tilt は 1/f^tilt）"""
    spec = np.fft.rfft(x, axis=-1)
    f = np.fft.rfftfreq(x.shape[-1], 1 / SR)
    gain = np.ones_like(f)
    if lo:
        gain *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi:
        gain *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if tilt:
        gain *= (np.maximum(f, 20) / 20) ** (-tilt / 2)
    return np.fft.irfft(spec * gain, n=x.shape[-1], axis=-1)


# ---------------------------------------------------------------- 和声
# (開始秒, ベース, パッドの構成音)  場面: 0 / 7 / 13.8 / 23.8 / 39 / 46.6 / 56 / 66.6 / 73.6
CHORDS = [
    (0.0, 38, [57, 62, 64, 65]),     # Dm9
    (7.0, 34, [58, 62, 65, 69]),     # B♭maj7
    (13.8, 41, [57, 60, 64, 67]),    # Fmaj9
    (18.8, 36, [55, 60, 62, 64]),    # C(add9)
    (23.8, 38, [57, 62, 64, 65]),    # Dm9
    (31.4, 43, [58, 62, 65, 69]),    # Gm9
    (39.0, 34, [58, 62, 65, 69]),    # B♭maj7
    (42.8, 33, [57, 62, 64, 69]),    # Asus4
    (44.7, 33, [57, 61, 64, 69]),    # A
    (46.6, 38, [57, 62, 64, 65]),    # Dm(add9)
    (51.3, 34, [58, 62, 65, 69]),    # B♭maj7
    (56.0, 41, [57, 60, 65, 67]),    # F(add9)
    (61.3, 40, [55, 60, 64, 67]),    # C/E
    (66.6, 43, [58, 62, 65, 69]),    # Gm9
    (70.1, 33, [57, 62, 64, 69]),    # Asus4
    (71.9, 33, [57, 61, 64, 69]),    # A
    (73.6, 38, [57, 62, 64, 66]),    # D(add9)
]

# 場面ごとの音量・明るさ（映像の構成に合わせる）
LEVELS = [  # (秒, パッド, 明るさ, 波)
    (0.0, 0.0, 1.6, 0.0),
    (0.2, 0.7, 2.0, 0.9),
    (7.0, 0.8, 2.6, 0.8),
    (13.8, 0.8, 2.8, 0.55),
    (23.8, 0.62, 2.2, 0.4),
    (39.0, 0.55, 1.9, 0.3),
    (46.6, 0.75, 2.6, 0.55),
    (56.0, 0.85, 3.2, 0.4),
    (66.6, 0.9, 3.4, 0.6),
    (73.6, 1.0, 3.6, 0.9),
    (82.0, 1.0, 3.6, 0.9),
]


def level_curve(index):
    # 各時刻から約1.5秒かけて次の値へ移る
    out = np.full(N, float(LEVELS[0][index]))
    for prev, key in zip(LEVELS, LEVELS[1:]):
        i0 = int(key[0] * SR)
        out[i0:] = prev[index] + (key[index] - prev[index]) * smoothstep((t_all[i0:] - key[0]) / 1.5)
    return out


pad_level = level_curve(1)
brightness = level_curve(2)
sea_level = level_curve(3)


# ---------------------------------------------------------------- 楽器
def pad_note(midi, length, attack=2.4, release=3.0):
    n = int((length + release) * SR)
    tt = np.arange(n) / SR
    env = smoothstep(tt / attack) * (1 - smoothstep((tt - length) / release))
    out = np.zeros((2, n))
    for cents, p in ((-7, -0.6), (0, 0.0), (7, 0.6)):
        f = hz(midi) * 2 ** (cents / 1200)
        phase = rng.uniform(0, 2 * np.pi)
        lfo = 1 + 0.12 * np.sin(2 * np.pi * rng.uniform(0.08, 0.2) * tt + rng.uniform(0, 6.28))
        mono = np.zeros(n)
        for h in range(1, 9):
            if f * h > 9000:
                break
            mono += np.sin(2 * np.pi * f * h * tt + phase * h) / h * np.exp(-(h - 1) / 2.8)
        out += pan(mono * lfo, p)
    return out * env / 3


def piano(midi, velocity=0.6, length=4.5):
    n = int(length * SR)
    tt = np.arange(n) / SR
    f0 = hz(midi)
    mono = np.zeros(n)
    for k in range(1, 9):
        fk = f0 * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 12000:
            break
        tau = 2.6 / (1 + 0.7 * (k - 1)) * (1.2 if midi < 64 else 0.9)
        mono += np.sin(2 * np.pi * fk * tt) * np.exp(-tt / tau) / k ** 1.15
    mono *= 1 - np.exp(-tt / 0.004)
    hammer = fft_filter(rng.standard_normal(int(0.02 * SR)), lo=300, hi=2500) * np.exp(-np.arange(int(0.02 * SR)) / SR / 0.004)
    mono[: hammer.size] += hammer * 0.04
    mono *= 1 - smoothstep((tt - (length - 0.4)) / 0.4)
    return pan(mono * velocity * 0.32, (midi - 66) / 30)


def bell(midi, velocity=0.5, length=6.0):
    n = int(length * SR)
    tt = np.arange(n) / SR
    f = hz(midi)
    index = 1.6 * np.exp(-tt / 1.2)
    mono = np.sin(2 * np.pi * f * tt + index * np.sin(2 * np.pi * f * 3.5 * tt))
    mono *= np.exp(-tt / 1.9) * (1 - np.exp(-tt / 0.003))
    return pan(mono * velocity * 0.12, 0.25)


def sub_hit(f=44.0, length=4.0):
    n = int(length * SR)
    tt = np.arange(n) / SR
    mono = np.sin(2 * np.pi * f * tt * (1 + 0.15 * np.exp(-tt / 0.25))) * np.exp(-tt / 1.3) * (1 - np.exp(-tt / 0.03))
    return pan(mono * 0.35, 0)


def riser(end, length=1.8):
    n = int(length * SR)
    tt = np.arange(n) / SR
    noise = fft_filter(rng.standard_normal((2, n)), lo=1800, hi=9000)
    env = (tt / length) ** 3 * (1 - smoothstep((tt - length + 0.06) / 0.06))
    return noise * env * 0.05, end - length


# ---------------------------------------------------------------- 配置
pad_bus = np.zeros((2, N))
piano_bus = np.zeros((2, N))
fx_bus = np.zeros((2, N))

for i, (start, bass, notes) in enumerate(CHORDS):
    end = CHORDS[i + 1][0] if i + 1 < len(CHORDS) else DURATION
    length = end - start + 0.4
    attack = 3.2 if i == 0 else 1.6
    for m in notes:
        place(pad_bus, start, pad_note(m, length, attack=attack) * 0.16)
    place(pad_bus, start, pad_note(bass, length, attack=attack, release=3.4) * 0.26)

# パッドの明るさと場面ごとの音量
bright = np.clip((brightness - 1.6) / 2.0, 0, 1)
pad_hi = fft_filter(pad_bus, lo=900)
pad_bus = (pad_bus - pad_hi * (1 - bright) * 0.8) * pad_level

# ピアノ：オープニングでは名前の4文字が現れる瞬間に1音ずつ
for k, m in enumerate([69, 74, 76, 81]):
    place(piano_bus, 2.9 + k * 0.28, piano(m, 0.55 + 0.05 * k, 6.0))

# 各場面の分散和音（文字を読む場面では音数を減らす）
ARPS = [  # (開始, 終了, 間隔, 音域を上げる半音, 強さ)
    (7.4, 13.4, 0.72, 12, 0.42),
    (14.3, 23.4, 0.66, 12, 0.40),
    (24.6, 38.4, 1.1, 12, 0.32),
    (39.6, 46.0, 1.3, 12, 0.30),
    (47.2, 55.6, 0.62, 12, 0.40),
    (56.6, 66.2, 0.5, 12, 0.38),
    (67.0, 73.2, 0.62, 12, 0.42),
    (74.4, 80.4, 0.72, 12, 0.40),
]
PATTERN = [0, 2, 3, 1, 3, 2]
arp_rng = np.random.default_rng(9)
for start, stop, step, up, vel in ARPS:
    t = start
    k = 0
    while t < stop:
        chord = [c for c in CHORDS if c[0] <= t + 0.05][-1]
        notes = sorted(chord[2])
        m = notes[PATTERN[k % len(PATTERN)]] + up
        if k % 6 == 5:
            m += 12 if notes[1] + up + 12 < 96 else 0
        accent = 1.0 if k % 6 == 0 else 0.8
        place(piano_bus, t + arp_rng.uniform(-0.015, 0.015), piano(m, vel * accent * arp_rng.uniform(0.85, 1.05)))
        k += 1
        t += step * (1.6 if k % 6 == 0 else 1.0)

# 場面の頭の鐘、表紙とエンドカードの低音
for t, m in [(3.0, 86), (7.6, 82), (14.3, 84), (24.2, 81), (39.4, 82), (47.0, 86), (56.4, 84), (67.0, 82), (74.2, 86)]:
    place(fx_bus, t, bell(m, 0.5))
place(fx_bus, 2.9, sub_hit(43.65))
place(fx_bus, 74.2, sub_hit(43.65))
sig, at = riser(2.9)
place(fx_bus, at, sig)
sig, at = riser(74.2, 1.4)
place(fx_bus, at, sig)

# 波（溟）：ゆっくり寄せては返すノイズ
sea = fft_filter(rng.standard_normal((2, N)), lo=110, hi=1400, tilt=0.6)
sea /= np.max(np.abs(sea))
swell = 0.35 + 0.65 * np.sin(np.pi * ((t_all / 7.3) % 1)) ** 2
swell2 = 0.5 + 0.5 * np.sin(2 * np.pi * t_all / 11.0 + 1.3)
sea *= (swell * (0.7 + 0.3 * swell2)) * sea_level * 0.11
spray = fft_filter(rng.standard_normal((2, N)), lo=2500, hi=9000)
spray /= np.max(np.abs(spray))
sea += spray * np.sin(np.pi * ((t_all / 7.3) % 1)) ** 6 * sea_level * 0.012


# ---------------------------------------------------------------- 残響とマスター
def reverb(x, seconds=3.6, damp=5000):
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    ir = fft_filter(rng.standard_normal((2, n)), hi=damp) * np.exp(-tt / (seconds / 6.9))
    ir[:, : int(0.012 * SR)] = 0  # 初期反射までの間
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
    y = np.fft.irfft(np.fft.rfft(x, size, axis=1) * np.fft.rfft(ir, size, axis=1), size, axis=1)
    return y[:, : x.shape[1]]


send = pad_bus * 0.5 + piano_bus * 0.55 + fx_bus * 0.7
mix = pad_bus + piano_bus + fx_bus * 0.9 + sea + reverb(send) * 0.55
mix = fft_filter(mix, lo=38)
mix *= smoothstep(t_all / 0.6) * (1 - smoothstep((t_all - 80.3) / 1.7))
mix /= np.max(np.abs(mix)) / 0.89
mix = np.tanh(mix * 1.1) / np.tanh(1.1)


def write_wav(path, x):
    pcm = np.clip(x + (rng.random(x.shape) - rng.random(x.shape)) / 32768, -1, 1)
    data = (pcm.T * 32767).astype('<i2').tobytes()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


BUILD.mkdir(exist_ok=True)
raw = BUILD / 'music_raw.wav'
out = BUILD / 'music.wav'
write_wav(raw, mix)

# ラウドネスを -16 LUFS / True Peak -1.5 dBTP にそろえる（ffmpeg loudnorm の2パス）
target = 'I=-16:TP=-1.5:LRA=11'
probe = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(raw), '-af', f'loudnorm={target}:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True, check=True).stderr
m = json.loads(probe[probe.rindex('{'):probe.rindex('}') + 1])
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af',
                f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
                f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
                '-ar', str(SR), '-c:a', 'pcm_s16le', str(out)], check=True)
print(f"wrote {out.relative_to(Path.cwd()) if out.is_relative_to(Path.cwd()) else out}  (input {m['input_i']} LUFS -> -16 LUFS)")
