"""Original score for the Polar promotion film (numpy only).

75 BPM, 16 bars (51.2 s), in D major. The cue points are the same bars and beats
that promo.js uses for its cuts, so every hit lands on a picture event:

  0.55 s   pole star ignites            ping + low swell
  12.8 s   genres appear, one per beat  rising "Polar motif" (D F# A B D)
  19.2 s   tagline                      impact, pulse begins
  26.4 s   values, one per beat         accents
  33.6 s   milestones, one per beat     the motif again
  38.4 s   logo                         impact, letter sparkles, light sweep
  44.8 s   call to action               plagal close, fade

Usage: python3 promo/music.py [out.wav]   (default promo/build/score.wav)
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
BEAT = 0.8
BAR = BEAT * 4
DURATION = BAR * 16
LENGTH = int((DURATION + 0.4) * SR)
rng = np.random.default_rng(20261008)


def bar(n, beat=0.0):
    """Start time of bar n (1-indexed) plus a beat offset."""
    return (n - 1) * BAR + beat * BEAT


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {name: i for i, name in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def n(name):
    """'F#5' -> MIDI number."""
    return NOTE[name[:-1]] + 12 * (int(name[-1]) + 1)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, LENGTH))

    def add(self, t0, sig, pan=0.5, gain=1.0):
        fade = min(sig.shape[-1], int(0.03 * SR))
        sig = sig.copy()
        sig[..., -fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2  # no clicks at cut-offs
        if sig.ndim == 1:
            sig = np.stack([sig * np.cos(pan * np.pi / 2), sig * np.sin(pan * np.pi / 2)]) * np.sqrt(2)
        i = int(round(t0 * SR))
        j = min(LENGTH, i + sig.shape[1])
        if j > i:
            self.x[:, i:j] += sig[:, : j - i] * gain


def fft_filter(x, gain_of_freq):
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(spec * gain_of_freq(freqs), len(x))


def lowpass(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def highpass(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- instruments

TABLE = 4096


def saw_table(f, fc):
    """One cycle of a band-limited, softly low-passed sawtooth for fundamental f."""
    harmonics = int(min(SR / 2 / f, 80))
    k = np.arange(1, harmonics + 1)
    weights = (1 / k) / np.sqrt(1 + (k * f / fc) ** 4)
    phase = np.arange(TABLE) / TABLE
    table = (weights[:, None] * np.sin(2 * np.pi * k[:, None] * phase[None, :])).sum(0)
    return table / np.abs(table).max()


def osc(table, f, t, phase=0.0):
    pos = ((f * t + phase) % 1.0) * TABLE
    i = pos.astype(int)
    frac = pos - i
    return table[i] * (1 - frac) + table[(i + 1) % TABLE] * frac


def pad_note(midi, length, fc0, fc1, attack=1.6, release=2.4):
    f = mtof(midi)
    total = length + release
    t = np.arange(int(total * SR)) / SR
    env = smoothstep(t / attack) * np.where(t < length, 1.0, np.cos(np.clip((t - length) / release, 0, 1) * np.pi / 2) ** 2)
    k = smoothstep(t / max(length, 1e-3))
    out = np.zeros((2, len(t)))
    for detune, pan in ((-7, 0.2), (0, 0.5), (7, 0.8)):
        ff = f * 2 ** (detune / 1200)
        ph = rng.random()
        s = osc(saw_table(ff, fc0), ff, t, ph) * (1 - k) + osc(saw_table(ff, fc1), ff, t, ph) * k
        s *= 1 + 0.07 * np.sin(2 * np.pi * (0.09 + 0.05 * rng.random()) * t + rng.random() * 6.28)
        out[0] += s * np.cos(pan * np.pi / 2)
        out[1] += s * np.sin(pan * np.pi / 2)
    return out * env / 3


def bell(midi, decay=None, bright=1.0):
    f = mtof(midi)
    decay = decay or float(np.clip(2.3 * (440 / f) ** 0.35, 0.6, 3.0))
    t = np.arange(int(decay * 6 * SR)) / SR
    index = bright * min(1.0, (760 / f) ** 0.6) * (1.7 * np.exp(-t / 0.16) + 0.22)
    y = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * 3.5 * f * t))
    y += 0.3 * np.sin(2 * np.pi * 2 * f * t + 0.6 * index * np.sin(2 * np.pi * f * t)) * np.exp(-t / (decay * 0.3))
    y += 0.12 * np.sin(2 * np.pi * 4.07 * f * t) * np.exp(-t / (decay * 0.12))
    return y * (1 - np.exp(-t / 0.002)) * np.exp(-t / decay)


def sub(midi, length, attack=2.5, release=2.5):
    f = mtof(midi)
    t = np.arange(int((length + release) * SR)) / SR
    env = smoothstep(t / attack) * np.where(t < length, 1.0, np.cos(np.clip((t - length) / release, 0, 1) * np.pi / 2) ** 2)
    return (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)) * env


def kick():
    t = np.arange(int(1.4 * SR)) / SR
    freq = 44 + 78 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.27) * (1 - np.exp(-t / 0.0015))
    click = fft_filter(rng.standard_normal(len(t)), lowpass(2500)) * np.exp(-t / 0.004) * 0.12
    return body + click


def shaker():
    t = np.arange(int(0.12 * SR)) / SR
    return fft_filter(rng.standard_normal(len(t)), highpass(6500, 3)) * np.exp(-t / 0.028) * (1 - np.exp(-t / 0.004))


def impact():
    t = np.arange(int(6.5 * SR)) / SR
    freq = 40 + 52 * np.exp(-t / 0.2)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 1.3) * (1 - np.exp(-t / 0.003))
    body = fft_filter(rng.standard_normal(len(t)), lowpass(220, 3)) * np.exp(-t / 0.4) * 0.9
    air = fft_filter(rng.standard_normal(len(t)), highpass(3500)) * np.exp(-t / 1.1) * 0.06
    return boom + body + air


def swept_noise(length, f_start, f_end, width_oct=0.9):
    """Noise through a band-pass whose centre glides exponentially (STFT overlap-add)."""
    size, hop = 2048, 512
    count = int(length * SR)
    x = rng.standard_normal(count + size)
    win = np.hanning(size)
    out = np.zeros_like(x)
    norm = np.zeros_like(x)
    freqs = np.fft.rfftfreq(size, 1 / SR)
    for start in range(0, count, hop):
        centre = f_start * (f_end / f_start) ** min(1.0, (start + size / 2) / count)
        gain = np.exp(-0.5 * ((np.log2(freqs + 1) - np.log2(centre)) / width_oct) ** 2)
        out[start:start + size] += np.fft.irfft(np.fft.rfft(x[start:start + size] * win) * gain, size) * win
        norm[start:start + size] += win ** 2
    return (out / np.maximum(norm, 1e-3))[:count]


def riser(length):
    t = np.arange(int(length * SR)) / SR
    swell = swept_noise(length, 350, 7000) * (t / length) ** 2.4
    glide = np.sin(2 * np.pi * np.cumsum(220 * 8 ** (t / length)) / SR) * (t / length) ** 3 * 0.12
    return swell * 0.5 + glide


def whoosh(length):
    t = np.arange(int(length * SR)) / SR
    shape = np.sin(np.pi * t / length) ** 2
    return swept_noise(length, 500, 2600, 1.2) * shape


def reverse_swell(length):
    t = np.arange(int(length * SR)) / SR
    tail = fft_filter(rng.standard_normal(len(t)), lambda f: highpass(1800)(f) * lowpass(9000)(f)) * np.exp(-t / (length * 0.35))
    return tail[::-1]


def reverb_ir(seconds=4.2):
    count = int(seconds * SR)
    t = np.arange(count) / SR
    ir = np.zeros((2, count))
    for ch in range(2):
        noise = rng.standard_normal(count)
        low = fft_filter(noise, lowpass(700))
        mid = fft_filter(noise, lambda f: highpass(700)(f) * lowpass(3500)(f))
        high = fft_filter(noise, highpass(3500))
        ir[ch] = low * np.exp(-t / 0.8) + mid * np.exp(-t / 0.58) + high * np.exp(-t / 0.3)
    ir *= smoothstep(t / 0.012)
    ir = np.concatenate([np.zeros((2, int(0.028 * SR))), ir], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def convolve(dry, ir):
    size = 1 << int(np.ceil(np.log2(dry.shape[1] + ir.shape[1])))
    out = np.zeros_like(dry)
    for ch in range(2):
        wet = np.fft.irfft(np.fft.rfft(dry[ch], size) * np.fft.rfft(ir[ch], size), size)
        out[ch] = wet[: dry.shape[1]]
    return out


# ---------------------------------------------------------------- score

def compose():
    pads, bells, drums, fx, low = Bus(), Bus(), Bus(), Bus(), Bus()

    # Harmony: (start, end, root, pad voicing, cutoff from, cutoff to, level).
    # Roots sit in the low bus as sines; the pads stay above them to keep the low end clean.
    chords = [
        (0.2, bar(3), 'D2', ['A2', 'D3', 'E3', 'A3'], 450, 700, 0.42),
        (bar(3), bar(5), 'B1', ['F#2', 'D3', 'A3', 'C#4'], 650, 900, 0.62),
        (bar(5), bar(7), 'G1', ['B2', 'D3', 'F#3', 'A3'], 800, 1700, 0.68),
        (bar(7), bar(9), 'D2', ['A2', 'F#3', 'C#4', 'E4'], 2300, 1700, 0.8),
        (bar(9), bar(11), 'B1', ['A2', 'D3', 'E3', 'F#3', 'A3'], 1700, 1500, 0.72),
        (bar(11), bar(13), 'G1', ['B2', 'D3', 'F#3', 'A3'], 1200, 2000, 0.7),
        (bar(13), bar(15), 'D2', ['A2', 'F#3', 'C#4', 'E4', 'A4'], 2800, 1400, 0.85),
        (bar(15), bar(16), 'G1', ['B2', 'D3', 'F#3', 'A3', 'E4'], 1300, 1100, 0.66),
        (bar(16), DURATION + 0.4, 'D2', ['A2', 'F#3', 'C#4', 'E4'], 1100, 800, 0.62),
    ]
    for start, end, root, notes, fc0, fc1, level in chords:
        for name in notes:
            pads.add(start - 0.15, pad_note(n(name), end - start, fc0, fc1), gain=level * 0.26)
        low.add(start - 0.1, sub(n(root) + 12, end - start, attack=1.2, release=1.6), gain=level * 0.065)
        low.add(start - 0.1, sub(n(root), end - start, attack=1.2, release=1.6), gain=level * 0.045)

    def ping(t, name, vel, pan=None, decay=None, bright=1.0):
        pan = 0.5 + (rng.random() - 0.5) * 0.7 if pan is None else pan
        bells.add(t, bell(n(name), decay, bright), pan=pan, gain=vel * 0.3)

    # Ignition of the pole star
    fx.add(0.0, reverse_swell(0.55), gain=0.05)
    ping(0.55, 'D6', 0.85, 0.5, 3.2)
    ping(0.57, 'A6', 0.45, 0.62, 2.6)
    ping(0.6, 'D5', 0.4, 0.4, 3.5, 0.6)

    # Sparse stars in bars 3–4
    for i, (name, vel) in enumerate([('B4', .3), ('F#5', .26), ('D5', .2), ('A5', .26), ('C#6', .2), ('F#5', .24), ('E5', .2), ('B5', .26)]):
        ping(bar(3, i), name, vel)

    # Polar motif: one bell per genre
    motif = ['D5', 'F#5', 'A5', 'B5', 'D6']
    for i, name in enumerate(motif):
        ping(bar(5, i), name, 0.62, 0.3 + 0.1 * i)
    # gathering arpeggio into the impact
    run = ['B4', 'D5', 'F#5', 'A5', 'B5', 'D6', 'F#6', 'A6']
    for i in range(8):
        ping(bar(6, 1) + i * BEAT / 2, run[i % len(run)], 0.16 + 0.03 * i)

    # Ostinato under the tagline and the values
    patterns = {
        7: ['D5', 'A5', 'E5', 'F#5', 'A5', 'C#6', 'A5', 'E5'],
        8: ['D5', 'A5', 'E5', 'F#5', 'A5', 'E6', 'C#6', 'A5'],
        9: ['B4', 'F#5', 'D5', 'E5', 'F#5', 'A5', 'F#5', 'D5'],
        10: ['B4', 'F#5', 'D5', 'E5', 'F#5', 'B5', 'A5', 'F#5'],
    }
    for b, notes in patterns.items():
        for i, name in enumerate(notes):
            ping(bar(b) + i * BEAT / 2, name, 0.17 if i % 2 else 0.22)
    for i, name in enumerate(['B5', 'D6', 'F#6']):
        ping(bar(9, 1 + i), name, 0.5, 0.35 + 0.15 * i)
    for i, name in enumerate(['G4', 'D5', 'B4', 'F#5']):
        ping(bar(11, i), name, 0.2)

    # Milestones: the motif returns
    for i, name in enumerate(motif):
        ping(bar(11, 2) + i * BEAT, name, 0.58, 0.3 + 0.1 * i)

    # Logo: letters sparkle, then the light sweep shimmers
    for i, name in enumerate(['A5', 'B5', 'D6', 'E6', 'F#6']):
        ping(39.95 + i * 0.09, name, 0.24, 0.35 + 0.075 * i, 1.6)
    for i, name in enumerate(['F#6', 'A6', 'C#7', 'E7']):
        ping(42.1 + i * 0.11, name, 0.13, 0.3 + 0.13 * i, 2.2, 0.7)
    fx.add(42.0, whoosh(1.4) * 0.5, gain=0.05)

    # Closing motif, falling home
    for i, name in enumerate(['D6', 'B5', 'A5', 'F#5']):
        ping(bar(15, 1 + i), name, 0.42, 0.65 - 0.1 * i)
    ping(bar(16), 'D5', 0.45, 0.5, 3.4)
    ping(bar(16), 'A5', 0.2, 0.6, 3.0)

    # Pulse
    kicks = [bar(7, 2), bar(8, 0), bar(8, 2)] + [bar(b, i) for b in (9, 10) for i in range(4)] + [bar(11, 0), bar(11, 2), bar(12, 0)]
    duck = np.zeros(LENGTH)
    tt = np.arange(int(0.6 * SR)) / SR
    for k in kicks:
        drums.add(k, kick(), gain=0.42)
        i = int(k * SR)
        j = min(LENGTH, i + len(tt))
        duck[i:j] += np.exp(-tt / 0.22)[: j - i] * (1 - np.exp(-tt / 0.01))[: j - i]
    for b in (9, 10):
        for i in range(4):
            drums.add(bar(b, i + 0.5), shaker(), pan=0.62, gain=0.06)

    # Risers, impacts, camera moves
    fx.add(bar(7) - 1.6, riser(1.6), gain=0.3)
    fx.add(bar(7) - 0.9, reverse_swell(0.9), gain=0.07)
    fx.add(bar(13) - 1.6, riser(1.6), gain=0.3)
    fx.add(bar(13) - 0.9, reverse_swell(0.9), gain=0.07)
    low.add(bar(7), impact(), gain=0.55)
    low.add(bar(13), impact(), gain=0.6)
    low.add(0.55, impact() * np.exp(-np.arange(int(6.5 * SR)) / SR / 0.8), gain=0.08)
    fx.add(31.6, whoosh(2.0), gain=0.08)
    fx.add(bar(15) - 0.2, whoosh(1.6), gain=0.06)

    pads.x = np.stack([fft_filter(ch, highpass(110, 2)) for ch in pads.x]) * (1 - 0.28 * np.clip(duck, 0, 1))
    # Dynamic arc: a quiet night that swells into the tagline and the logo.
    arc_db = np.interp(np.arange(LENGTH) / SR,
                       [0, bar(3), bar(5), bar(7) - 0.8, bar(7) - 0.01, bar(7), bar(11), bar(13) - 0.01, bar(13), bar(15), DURATION],
                       [-10, -8, -5.5, -3.5, -3.5, 0, -0.5, -1.5, 0.5, -1.5, -2.5])
    arc = 10 ** (arc_db / 20)
    pads.x *= arc
    bells.x *= arc
    return pads, bells, drums, fx, low


def master(buses):
    pads, bells, drums, fx, low = buses
    ir = reverb_ir()
    send = pads.x * 0.45 + bells.x * 0.75 + drums.x * 0.08 + fx.x * 0.5 + low.x * 0.3
    wet = convolve(send, ir)
    mix = pads.x + bells.x * 0.9 + drums.x + fx.x + low.x + wet * 0.55
    air = lambda f: highpass(36, 4)(f) * (1 + 0.4 / (1 + (6000 / np.maximum(f, 1)) ** 2))
    mix = np.stack([fft_filter(ch, air) for ch in mix])
    # fades
    t = np.arange(LENGTH) / SR
    mix *= smoothstep(t / 0.05)
    mix *= np.cos(np.clip((t - 49.6) / (DURATION - 49.6), 0, 1) * np.pi / 2) ** 2
    # soft limiter: the loudest transients ride into a gentle tanh knee
    mix /= np.percentile(np.abs(mix), 99.995)
    mix = np.tanh(mix * 0.9) / np.tanh(0.9)
    mix /= np.abs(mix).max()
    return mix * 10 ** (-1.0 / 20)


def write_wav(path, x):
    x = x[:, : int(DURATION * SR)]
    pcm = np.clip(np.round(x.T * (2 ** 23 - 1)), -(2 ** 23), 2 ** 23 - 1).astype('<i4')
    raw = pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw)


if __name__ == '__main__':
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / 'build' / 'score.wav'
    out.parent.mkdir(parents=True, exist_ok=True)
    write_wav(out, master(compose()))
    print(out)
