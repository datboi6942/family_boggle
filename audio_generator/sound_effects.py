"""
Sound effects generator for Family Boggle game.
Creates ultra-satisfying, gamified sound effects inspired by premium mobile games.
"""

import numpy as np
from synth import (
    SAMPLE_RATE, sine_wave, square_wave, sawtooth_wave, triangle_wave,
    noise, pulse_wave, adsr_envelope, quick_envelope, pluck_envelope,
    low_pass_filter, high_pass_filter, delay, reverb, distortion, chorus,
    mix_tracks, normalize, fade_in, fade_out, save_wav, note_to_freq,
    midi_to_freq, concatenate, chord
)


def generate_letter_select() -> np.ndarray:
    """Ultra-satisfying pop sound when selecting a letter."""
    duration = 0.12

    # Main tone - bright and snappy
    freq = 1200
    wave = sine_wave(freq, duration, amplitude=0.35)
    wave += sine_wave(freq * 2, duration, amplitude=0.15)  # Octave
    wave += sine_wave(freq * 3, duration, amplitude=0.08)  # Fifth above

    # Add subtle sub bass thump for weight
    sub = sine_wave(150, 0.05, amplitude=0.25)
    sub *= np.exp(-30 * np.linspace(0, 0.05, len(sub), False))

    # Crisp attack transient
    click = noise(0.008, amplitude=0.4)
    click = high_pass_filter(click, cutoff=3000)
    click = low_pass_filter(click, cutoff=8000)

    # Snappy envelope
    env = adsr_envelope(duration, attack=0.001, decay=0.03, sustain=0.2, release=0.06)
    wave = wave[:len(env)] * env

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(click)] += click
    result[:len(sub)] += sub
    result[:len(wave)] += wave

    return normalize(fade_out(result, 0.02)) * 0.85


def generate_letter_chain() -> list:
    """Musical ascending tones that build excitement as chain grows."""
    sounds = []

    # Pentatonic scale for always-pleasant sounds
    # C, D, E, G, A pattern repeated up octaves
    scale_ratios = [1.0, 1.122, 1.26, 1.498, 1.682]  # Major pentatonic

    base_freq = 523.25  # C5

    for i in range(10):
        duration = 0.08 + (i * 0.005)  # Slightly longer as chain grows

        # Calculate frequency from pentatonic scale
        octave = i // 5
        scale_pos = i % 5
        freq = base_freq * scale_ratios[scale_pos] * (2 ** octave)

        # Richer tone with harmonics
        wave = sine_wave(freq, duration, amplitude=0.3)
        wave += triangle_wave(freq * 2, duration, amplitude=0.12)
        wave += sine_wave(freq * 3, duration, amplitude=0.06)

        # Add subtle "pluck" character
        pluck = noise(0.005, amplitude=0.15)
        pluck = high_pass_filter(pluck, cutoff=4000)

        # Envelope gets more sustain as chain grows (more satisfying)
        sustain = 0.3 + (i * 0.05)
        env = adsr_envelope(duration, attack=0.002, decay=0.02, sustain=sustain, release=0.03)
        wave = wave[:len(env)] * env

        result = np.zeros(len(wave))
        result[:len(pluck)] += pluck
        result += wave

        # Add subtle reverb on longer chains
        if i >= 5:
            result = reverb(result, room_size=0.2)

        # Increase volume slightly for longer chains (more rewarding)
        volume = 0.7 + (i * 0.03)
        sounds.append(normalize(result) * volume)

    return sounds


def generate_word_valid() -> np.ndarray:
    """Extremely satisfying celebration sound for valid words."""
    duration = 0.55

    # Epic rising arpeggio - C major 7th
    notes = [
        (523.25, 0.08),   # C5
        (659.25, 0.08),   # E5
        (783.99, 0.08),   # G5
        (987.77, 0.08),   # B5
        (1046.50, 0.20),  # C6 (hold)
    ]

    result = np.zeros(int(SAMPLE_RATE * duration))

    # Main arpeggio with rich synth sound
    pos = 0
    for freq, note_dur in notes:
        # Layered synth sound
        note = sawtooth_wave(freq, note_dur * 1.5, amplitude=0.18)
        note += sawtooth_wave(freq * 1.002, note_dur * 1.5, amplitude=0.12)  # Detune
        note += pulse_wave(freq, note_dur * 1.5, duty=0.3, amplitude=0.1)
        note += sine_wave(freq, note_dur * 1.5, amplitude=0.12)

        env = adsr_envelope(note_dur * 1.5, attack=0.003, decay=0.04, sustain=0.7, release=0.12)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=4000)

        end = min(pos + len(note), len(result))
        result[pos:end] += note[:end-pos]
        pos += int(note_dur * SAMPLE_RATE)

    # Bright sparkle burst
    sparkle = noise(0.2, amplitude=0.15)
    sparkle = high_pass_filter(sparkle, cutoff=6000)
    sparkle = low_pass_filter(sparkle, cutoff=12000)
    t_sparkle = np.linspace(0, 0.2, len(sparkle), False)
    sparkle *= np.exp(-8 * t_sparkle)
    result[:len(sparkle)] += sparkle

    # Satisfying "ding" bell tone
    ding_freq = 2093.00  # C7
    ding = sine_wave(ding_freq, 0.3, amplitude=0.12)
    ding += sine_wave(ding_freq * 2, 0.3, amplitude=0.05)
    ding *= pluck_envelope(0.3)
    start_ding = int(0.15 * SAMPLE_RATE)
    result[start_ding:start_ding+len(ding)] += ding

    # Sub bass punch for weight
    sub = sine_wave(130, 0.1, amplitude=0.2)
    sub *= np.exp(-20 * np.linspace(0, 0.1, len(sub), False))
    result[:len(sub)] += sub

    result = chorus(result, depth=0.002, rate=2.0)
    result = reverb(result, room_size=0.35)
    return normalize(fade_out(result, 0.08)) * 0.9


def generate_word_invalid() -> np.ndarray:
    """Gentle but clear 'nope' sound - not harsh."""
    duration = 0.25

    # Two-note descending minor second (classic "wrong" interval)
    freq1, freq2 = 400, 350

    # First note
    note1 = sine_wave(freq1, 0.1, amplitude=0.25)
    note1 += triangle_wave(freq1, 0.1, amplitude=0.1)
    env1 = adsr_envelope(0.1, attack=0.005, decay=0.03, sustain=0.5, release=0.04)
    note1 = note1[:len(env1)] * env1

    # Second note (lower)
    note2 = sine_wave(freq2, 0.12, amplitude=0.25)
    note2 += triangle_wave(freq2, 0.12, amplitude=0.1)
    env2 = adsr_envelope(0.12, attack=0.005, decay=0.03, sustain=0.4, release=0.06)
    note2 = note2[:len(env2)] * env2

    # Soft low thump
    thump = sine_wave(100, 0.08, amplitude=0.15)
    thump *= np.exp(-25 * np.linspace(0, 0.08, len(thump), False))

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(thump)] += thump
    result[:len(note1)] += note1
    result[int(0.08 * SAMPLE_RATE):int(0.08 * SAMPLE_RATE)+len(note2)] += note2

    result = low_pass_filter(result, cutoff=2500)
    return normalize(fade_out(result, 0.03)) * 0.75


def generate_word_already_found() -> np.ndarray:
    """Soft notification - already got this one."""
    duration = 0.22

    # Gentle two-note pattern
    freq1, freq2 = 550, 440

    note1 = sine_wave(freq1, 0.08, amplitude=0.2)
    note1 += triangle_wave(freq1 * 2, 0.08, amplitude=0.08)
    note1 *= quick_envelope(0.08, attack=0.003, release=0.03)

    note2 = sine_wave(freq2, 0.1, amplitude=0.2)
    note2 += triangle_wave(freq2 * 2, 0.1, amplitude=0.08)
    note2 *= quick_envelope(0.1, attack=0.003, release=0.04)

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(note1)] = note1
    result[int(0.07 * SAMPLE_RATE):int(0.07 * SAMPLE_RATE)+len(note2)] += note2

    result = low_pass_filter(result, cutoff=3000)
    return normalize(result) * 0.65


def generate_powerup_earned() -> np.ndarray:
    """Epic 'achievement unlocked' sound - extremely satisfying."""
    duration = 0.75

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Rising sweep with rich harmonics
    freq_sweep = 250 + 800 * (t / duration) ** 1.5

    wave = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        wave[i] = 0.25 * np.sin(phase)
        wave[i] += 0.12 * np.sin(phase * 2)
        wave[i] += 0.06 * np.sin(phase * 3)
        phase += 2 * np.pi * freq_sweep[i] / SAMPLE_RATE

    # Add pulsing for excitement
    pulse_mod = 1 + 0.2 * np.sin(2 * np.pi * 12 * t)
    wave *= pulse_mod

    env = adsr_envelope(duration, attack=0.02, decay=0.1, sustain=0.8, release=0.15)
    wave = wave[:len(env)] * env

    # Bright sparkle cascade
    sparkle = noise(0.35, amplitude=0.2)
    sparkle = high_pass_filter(sparkle, cutoff=5000)
    sparkle = low_pass_filter(sparkle, cutoff=14000)
    t_sparkle = np.linspace(0, 0.35, len(sparkle), False)
    sparkle *= (t_sparkle / 0.35) * np.exp(-4 * t_sparkle)  # Builds then fades

    # Epic final chord - major with added 9th
    chord_start = int(0.4 * SAMPLE_RATE)
    chord_freqs = [523.25, 659.25, 783.99, 1174.66]  # C, E, G, D (add9)
    chord_dur = 0.35

    chord_wave = np.zeros(int(SAMPLE_RATE * chord_dur))
    for freq in chord_freqs:
        tone = sawtooth_wave(freq, chord_dur, amplitude=0.1)
        tone += sine_wave(freq, chord_dur, amplitude=0.08)
        chord_env = adsr_envelope(chord_dur, attack=0.01, decay=0.1, sustain=0.6, release=0.15)
        tone = tone[:len(chord_env)] * chord_env
        chord_wave += tone

    chord_wave = low_pass_filter(chord_wave, cutoff=4000)

    # Combine everything
    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(wave)] = wave
    result[:len(sparkle)] += sparkle
    result[chord_start:chord_start+len(chord_wave)] += chord_wave

    # Final ding
    ding = sine_wave(1567.98, 0.2, amplitude=0.15)  # G6
    ding += sine_wave(1567.98 * 2, 0.2, amplitude=0.06)
    ding *= pluck_envelope(0.2)
    ding_start = int(0.45 * SAMPLE_RATE)
    result[ding_start:ding_start+len(ding)] += ding

    result = chorus(result, depth=0.003, rate=1.5)
    result = reverb(result, room_size=0.4)
    return normalize(result) * 0.92


def generate_powerup_freeze() -> np.ndarray:
    """Magical ice/freeze sound - crystalline and satisfying."""
    duration = 0.7

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Crystalline shimmer
    shimmer = noise(duration, amplitude=0.25)
    shimmer = high_pass_filter(shimmer, cutoff=4000)
    shimmer = low_pass_filter(shimmer, cutoff=12000)

    # Multiple crystalline tones (like ice forming)
    crystal_freqs = [2400, 3200, 4000, 4800, 5600]
    for i, freq in enumerate(crystal_freqs):
        tone = sine_wave(freq, duration * 0.8, amplitude=0.08)
        delay_samples = int(i * 0.04 * SAMPLE_RATE)
        tone_env = np.exp(-4 * np.linspace(0, duration * 0.8, len(tone), False))
        tone *= tone_env
        if delay_samples + len(tone) < len(shimmer):
            shimmer[delay_samples:delay_samples+len(tone)] += tone

    # Sweeping "whoosh" down
    whoosh_freq = 2000 * np.exp(-4 * t) + 200
    whoosh = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        whoosh[i] = 0.15 * np.sin(phase)
        phase += 2 * np.pi * whoosh_freq[i] / SAMPLE_RATE
    whoosh *= adsr_envelope(duration, attack=0.03, decay=0.2, sustain=0.4, release=0.3)

    # Deep magical sub tone
    sub = sine_wave(80, duration * 0.5, amplitude=0.2)
    sub *= adsr_envelope(duration * 0.5, attack=0.05, decay=0.1, sustain=0.5, release=0.2)

    result = shimmer + whoosh
    result[:len(sub)] += sub

    result = reverb(result, room_size=0.5)

    env = adsr_envelope(duration, attack=0.03, decay=0.15, sustain=0.6, release=0.25)
    result = result[:len(env)] * env

    return normalize(fade_out(result, 0.1)) * 0.88


def generate_powerup_bomb() -> np.ndarray:
    """Explosive impact - powerful but satisfying."""
    duration = 0.55

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Deep boom with pitch drop
    freq = 120 * np.exp(-8 * t) + 35
    boom = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        boom[i] = np.sin(phase)
        boom[i] += 0.5 * np.sin(phase * 0.5)  # Sub harmonic
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE
    boom *= 0.45 * np.exp(-5 * t)

    # Initial burst/crack
    burst = noise(0.06, amplitude=0.5)
    burst = low_pass_filter(burst, cutoff=4000)
    burst = high_pass_filter(burst, cutoff=200)
    burst *= np.exp(-30 * np.linspace(0, 0.06, len(burst), False))

    # Secondary debris sound
    debris = noise(0.3, amplitude=0.2)
    debris = low_pass_filter(debris, cutoff=2500)
    debris = high_pass_filter(debris, cutoff=400)
    debris *= np.exp(-8 * np.linspace(0, 0.3, len(debris), False))
    debris_start = int(0.04 * SAMPLE_RATE)

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(burst)] = burst
    result[:len(boom)] += boom
    result[debris_start:debris_start+len(debris)] += debris

    # Add impact "thud"
    thud = sine_wave(60, 0.15, amplitude=0.35)
    thud *= np.exp(-15 * np.linspace(0, 0.15, len(thud), False))
    result[:len(thud)] += thud

    result = distortion(result, drive=1.4)
    result = low_pass_filter(result, cutoff=4000)

    return normalize(result) * 0.9


def generate_powerup_shuffle() -> np.ndarray:
    """Whooshing card shuffle - magical and satisfying."""
    duration = 0.55

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Whooshing filtered noise
    whoosh = noise(duration, amplitude=0.35)
    whoosh = low_pass_filter(whoosh, cutoff=4000)
    whoosh = high_pass_filter(whoosh, cutoff=300)

    # Add movement with amplitude modulation
    mod = np.sin(np.pi * t / duration) ** 0.5  # Peaks in middle
    whoosh *= mod

    # Rhythmic "cards" sounds
    num_clicks = 8
    for i in range(num_clicks):
        pos = int((i / num_clicks) * 0.8 * len(whoosh))
        click = noise(0.015, amplitude=0.25)
        click = high_pass_filter(click, cutoff=2000)
        click = low_pass_filter(click, cutoff=8000)
        click *= np.exp(-40 * np.linspace(0, 0.015, len(click), False))
        end = min(pos + len(click), len(whoosh))
        whoosh[pos:end] += click[:end-pos]

    # Rising magical tone
    magic_freq = 400 + 400 * (t / duration)
    magic = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        magic[i] = 0.12 * np.sin(phase)
        magic[i] += 0.06 * np.sin(phase * 1.5)
        phase += 2 * np.pi * magic_freq[i] / SAMPLE_RATE
    magic *= adsr_envelope(duration, attack=0.05, decay=0.1, sustain=0.5, release=0.2)

    result = whoosh + magic

    # Final "settle" tone
    settle = sine_wave(800, 0.1, amplitude=0.15)
    settle += sine_wave(1200, 0.1, amplitude=0.08)
    settle *= pluck_envelope(0.1)
    settle_pos = int(0.42 * SAMPLE_RATE)
    result[settle_pos:settle_pos+len(settle)] += settle

    result = reverb(result, room_size=0.3)
    return normalize(result) * 0.85


def generate_powerup_lock() -> np.ndarray:
    """Protective shield activation - powerful and reassuring."""
    duration = 0.55

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Rising protective tone
    freq = 350 + 250 * (t / duration)
    wave = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        wave[i] = 0.2 * np.sin(phase)
        wave[i] += 0.12 * np.sin(phase * 1.5)  # Perfect fifth
        wave[i] += 0.08 * np.sin(phase * 2)    # Octave
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Metallic shimmer
    shimmer = noise(duration, amplitude=0.12)
    shimmer = high_pass_filter(shimmer, cutoff=5000)
    shimmer = low_pass_filter(shimmer, cutoff=12000)
    shimmer *= adsr_envelope(duration, attack=0.1, decay=0.2, sustain=0.4, release=0.2)

    # Initial "lock engaging" click
    click = noise(0.025, amplitude=0.4)
    click = low_pass_filter(click, cutoff=4000)
    click = high_pass_filter(click, cutoff=800)
    click *= np.exp(-50 * np.linspace(0, 0.025, len(click), False))

    # Resonant "shield up" ping
    ping_freq = 1400
    ping = sine_wave(ping_freq, 0.2, amplitude=0.18)
    ping += sine_wave(ping_freq * 2, 0.2, amplitude=0.08)
    ping += sine_wave(ping_freq * 1.5, 0.2, amplitude=0.06)
    ping *= pluck_envelope(0.2)
    ping_start = int(0.06 * SAMPLE_RATE)

    # Deep confirmation tone
    confirm = sine_wave(200, 0.15, amplitude=0.15)
    confirm += sine_wave(300, 0.15, amplitude=0.1)
    confirm *= adsr_envelope(0.15, attack=0.01, decay=0.05, sustain=0.5, release=0.08)

    result = wave + shimmer
    result[:len(click)] += click
    result[ping_start:ping_start+len(ping)] += ping
    result[:len(confirm)] += confirm

    env = adsr_envelope(duration, attack=0.02, decay=0.1, sustain=0.7, release=0.15)
    result = result[:len(env)] * env

    result = reverb(result, room_size=0.35)
    return normalize(fade_out(result, 0.06)) * 0.88


def generate_timer_tick() -> np.ndarray:
    """Subtle, satisfying tick."""
    duration = 0.06

    freq = 1400
    wave = sine_wave(freq, duration, amplitude=0.18)
    wave += sine_wave(freq * 2, duration, amplitude=0.06)

    # Crisp click
    click = noise(0.008, amplitude=0.12)
    click = high_pass_filter(click, cutoff=3000)

    env = quick_envelope(duration, attack=0.001, release=0.025)
    wave = wave[:len(env)] * env

    result = np.zeros(len(wave))
    result[:len(click)] += click
    result += wave

    return normalize(result) * 0.5


def generate_timer_warning() -> np.ndarray:
    """Urgent but not annoying warning beep."""
    duration = 0.18

    # Two-tone for urgency
    freq1, freq2 = 880, 1100

    note1 = sine_wave(freq1, 0.08, amplitude=0.25)
    note1 += triangle_wave(freq1, 0.08, amplitude=0.1)
    note1 *= quick_envelope(0.08, attack=0.003, release=0.03)

    note2 = sine_wave(freq2, 0.08, amplitude=0.25)
    note2 += triangle_wave(freq2, 0.08, amplitude=0.1)
    note2 *= quick_envelope(0.08, attack=0.003, release=0.03)

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(note1)] = note1
    result[int(0.08 * SAMPLE_RATE):int(0.08 * SAMPLE_RATE)+len(note2)] += note2

    result = low_pass_filter(result, cutoff=3500)
    return normalize(result) * 0.7


def generate_game_start() -> np.ndarray:
    """Epic game starting fanfare."""
    duration = 0.9

    # Ascending power chord arpeggio
    notes = [
        (130.81, 0.12),   # C3
        (164.81, 0.12),   # E3
        (196.00, 0.12),   # G3
        (261.63, 0.25),   # C4
        (329.63, 0.30),   # E4 (final)
    ]

    result = np.zeros(int(SAMPLE_RATE * duration))
    pos = 0

    for i, (freq, note_dur) in enumerate(notes):
        # Rich layered synth
        note = sawtooth_wave(freq, note_dur * 1.3, amplitude=0.18)
        note += sawtooth_wave(freq * 1.003, note_dur * 1.3, amplitude=0.12)
        note += sawtooth_wave(freq * 1.5, note_dur * 1.3, amplitude=0.12)  # Fifth
        note += sine_wave(freq, note_dur * 1.3, amplitude=0.1)
        note += sine_wave(freq * 2, note_dur * 1.3, amplitude=0.06)

        env = adsr_envelope(note_dur * 1.3, attack=0.008, decay=0.06, sustain=0.7, release=0.12)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=3000 + i * 500)

        end = min(pos + len(note), len(result))
        result[pos:end] += note[:end-pos]
        pos += int(note_dur * SAMPLE_RATE)

    # Sparkle on final note
    sparkle = noise(0.25, amplitude=0.12)
    sparkle = high_pass_filter(sparkle, cutoff=6000)
    sparkle *= pluck_envelope(0.25)
    sparkle_start = int(0.5 * SAMPLE_RATE)
    result[sparkle_start:sparkle_start+len(sparkle)] += sparkle

    # Sub bass punch
    sub = sine_wave(65, 0.2, amplitude=0.25)
    sub *= np.exp(-12 * np.linspace(0, 0.2, len(sub), False))
    result[:len(sub)] += sub

    result = reverb(result, room_size=0.35)
    return normalize(result) * 0.9


def generate_countdown_beep() -> np.ndarray:
    """Countdown beep (3, 2, 1) - anticipation building."""
    duration = 0.22

    freq = 700
    wave = sine_wave(freq, duration, amplitude=0.3)
    wave += sine_wave(freq * 2, duration, amplitude=0.12)
    wave += triangle_wave(freq, duration, amplitude=0.1)

    env = adsr_envelope(duration, attack=0.005, decay=0.05, sustain=0.6, release=0.1)
    wave = wave[:len(env)] * env

    # Subtle sub pulse
    sub = sine_wave(100, 0.08, amplitude=0.15)
    sub *= np.exp(-20 * np.linspace(0, 0.08, len(sub), False))

    result = np.zeros(len(wave))
    result[:len(sub)] += sub
    result += wave

    return normalize(result) * 0.75


def generate_countdown_go() -> np.ndarray:
    """Epic 'GO!' sound - launches the game."""
    duration = 0.5

    # Rising chord burst
    freqs = [523.25, 659.25, 783.99, 1046.50]  # C major

    result = np.zeros(int(SAMPLE_RATE * duration))

    for freq in freqs:
        note = sawtooth_wave(freq, duration * 0.8, amplitude=0.15)
        note += sine_wave(freq, duration * 0.8, amplitude=0.1)
        note += pulse_wave(freq, duration * 0.8, duty=0.3, amplitude=0.08)

        env = adsr_envelope(duration * 0.8, attack=0.008, decay=0.08, sustain=0.6, release=0.2)
        note = note[:len(env)] * env
        result[:len(note)] += note

    result = low_pass_filter(result, cutoff=5000)

    # Impact punch
    punch = sine_wave(80, 0.1, amplitude=0.3)
    punch *= np.exp(-18 * np.linspace(0, 0.1, len(punch), False))
    result[:len(punch)] += punch

    # High sparkle
    sparkle = noise(0.15, amplitude=0.15)
    sparkle = high_pass_filter(sparkle, cutoff=6000)
    sparkle *= pluck_envelope(0.15)
    result[:len(sparkle)] += sparkle

    result = reverb(result, room_size=0.25)
    return normalize(result) * 0.88


def generate_game_end() -> np.ndarray:
    """Game over - satisfying conclusion."""
    duration = 1.1

    # Resolving descending arpeggio
    notes = [
        (783.99, 0.15),   # G5
        (659.25, 0.15),   # E5
        (523.25, 0.15),   # C5
        (392.00, 0.20),   # G4
        (261.63, 0.40),   # C4 (resolve)
    ]

    result = np.zeros(int(SAMPLE_RATE * duration))
    pos = 0

    for freq, note_dur in notes:
        note = sawtooth_wave(freq, note_dur * 1.2, amplitude=0.18)
        note += sine_wave(freq, note_dur * 1.2, amplitude=0.12)
        note += triangle_wave(freq * 0.5, note_dur * 1.2, amplitude=0.08)

        env = adsr_envelope(note_dur * 1.2, attack=0.01, decay=0.08, sustain=0.6, release=0.15)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=2500)

        end = min(pos + len(note), len(result))
        result[pos:end] += note[:end-pos]
        pos += int(note_dur * SAMPLE_RATE)

    # Final resolution chord
    chord_start = int(0.65 * SAMPLE_RATE)
    chord_dur = 0.45
    chord_freqs = [130.81, 164.81, 196.00, 261.63]  # C major

    for freq in chord_freqs:
        tone = sine_wave(freq, chord_dur, amplitude=0.1)
        tone += sawtooth_wave(freq, chord_dur, amplitude=0.06)
        chord_env = adsr_envelope(chord_dur, attack=0.02, decay=0.1, sustain=0.5, release=0.25)
        tone = tone[:len(chord_env)] * chord_env
        result[chord_start:chord_start+len(tone)] += tone

    result = reverb(result, room_size=0.45)
    return normalize(fade_out(result, 0.25)) * 0.85


def generate_victory_fanfare() -> np.ndarray:
    """Victory celebration sound for winner."""
    duration = 1.2

    # Triumphant ascending fanfare
    notes = [
        (261.63, 0.12),   # C4
        (329.63, 0.12),   # E4
        (392.00, 0.12),   # G4
        (523.25, 0.15),   # C5
        (659.25, 0.15),   # E5
        (783.99, 0.50),   # G5 (hold)
    ]

    result = np.zeros(int(SAMPLE_RATE * duration))
    pos = 0

    for freq, note_dur in notes:
        # Bright, triumphant synth
        note = sawtooth_wave(freq, note_dur * 1.3, amplitude=0.16)
        note += sawtooth_wave(freq * 1.002, note_dur * 1.3, amplitude=0.1)
        note += pulse_wave(freq, note_dur * 1.3, duty=0.25, amplitude=0.1)
        note += sine_wave(freq * 1.5, note_dur * 1.3, amplitude=0.08)

        env = adsr_envelope(note_dur * 1.3, attack=0.006, decay=0.05, sustain=0.75, release=0.12)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=4500)

        end = min(pos + len(note), len(result))
        result[pos:end] += note[:end-pos]
        pos += int(note_dur * SAMPLE_RATE)

    # Sparkle cascade
    sparkle = noise(0.4, amplitude=0.18)
    sparkle = high_pass_filter(sparkle, cutoff=5000)
    t_sparkle = np.linspace(0, 0.4, len(sparkle), False)
    sparkle *= np.sin(np.pi * t_sparkle / 0.4)
    sparkle_start = int(0.4 * SAMPLE_RATE)
    result[sparkle_start:sparkle_start+len(sparkle)] += sparkle

    # Triumphant sub
    sub = sine_wave(65, 0.25, amplitude=0.22)
    sub *= adsr_envelope(0.25, attack=0.02, decay=0.08, sustain=0.6, release=0.1)
    result[:len(sub)] += sub

    result = chorus(result, depth=0.003, rate=1.5)
    result = reverb(result, room_size=0.4)
    return normalize(result) * 0.92


def generate_confetti_burst() -> np.ndarray:
    """Confetti/celebration burst sound."""
    duration = 0.6

    # High sparkly burst
    sparkle = noise(duration, amplitude=0.3)
    sparkle = high_pass_filter(sparkle, cutoff=4000)
    sparkle = low_pass_filter(sparkle, cutoff=14000)

    t = np.linspace(0, duration, len(sparkle), False)
    sparkle *= np.exp(-5 * t)

    # Multiple bright tones
    for freq in [1800, 2200, 2800, 3400]:
        tone = sine_wave(freq, 0.15, amplitude=0.08)
        tone *= pluck_envelope(0.15)
        start = int(np.random.uniform(0, 0.1) * SAMPLE_RATE)
        if start + len(tone) < len(sparkle):
            sparkle[start:start+len(tone)] += tone

    # Soft impact
    impact = sine_wave(200, 0.1, amplitude=0.15)
    impact *= np.exp(-20 * np.linspace(0, 0.1, len(impact), False))
    sparkle[:len(impact)] += impact

    sparkle = reverb(sparkle, room_size=0.4)
    return normalize(sparkle) * 0.8


def generate_all_effects(output_dir: str = "output/sfx"):
    """Generate all sound effects and save them."""
    import os
    os.makedirs(output_dir, exist_ok=True)

    print("Generating enhanced sound effects...")

    # Basic interactions
    save_wav(generate_letter_select(), f"{output_dir}/letter_select.wav")

    # Letter chain sounds (1-10)
    chain_sounds = generate_letter_chain()
    for i, sound in enumerate(chain_sounds):
        save_wav(sound, f"{output_dir}/letter_chain_{i+1}.wav")

    # Word feedback
    save_wav(generate_word_valid(), f"{output_dir}/word_valid.wav")
    save_wav(generate_word_invalid(), f"{output_dir}/word_invalid.wav")
    save_wav(generate_word_already_found(), f"{output_dir}/word_already_found.wav")

    # Powerups
    save_wav(generate_powerup_earned(), f"{output_dir}/powerup_earned.wav")
    save_wav(generate_powerup_freeze(), f"{output_dir}/powerup_freeze.wav")
    save_wav(generate_powerup_bomb(), f"{output_dir}/powerup_bomb.wav")
    save_wav(generate_powerup_shuffle(), f"{output_dir}/powerup_shuffle.wav")
    save_wav(generate_powerup_lock(), f"{output_dir}/powerup_lock.wav")

    # Timer
    save_wav(generate_timer_tick(), f"{output_dir}/timer_tick.wav")
    save_wav(generate_timer_warning(), f"{output_dir}/timer_warning.wav")

    # Game state
    save_wav(generate_game_start(), f"{output_dir}/game_start.wav")
    save_wav(generate_countdown_beep(), f"{output_dir}/countdown_beep.wav")
    save_wav(generate_countdown_go(), f"{output_dir}/countdown_go.wav")
    save_wav(generate_game_end(), f"{output_dir}/game_end.wav")

    # Celebration
    save_wav(generate_victory_fanfare(), f"{output_dir}/victory_fanfare.wav")
    save_wav(generate_confetti_burst(), f"{output_dir}/confetti_burst.wav")

    print(f"All enhanced sound effects saved to {output_dir}/")


if __name__ == "__main__":
    generate_all_effects()
