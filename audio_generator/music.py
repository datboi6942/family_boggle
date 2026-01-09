"""
Background music generator for Family Boggle.
Creates electronic, synthy, upbeat, fast-paced music tracks.
"""

import numpy as np
from synth import (
    SAMPLE_RATE, sine_wave, square_wave, sawtooth_wave, triangle_wave,
    noise, pulse_wave, adsr_envelope, quick_envelope, pluck_envelope,
    low_pass_filter, high_pass_filter, delay, reverb, distortion, chorus,
    mix_tracks, normalize, fade_in, fade_out, save_wav, note_to_freq,
    midi_to_freq, concatenate, chord, arpeggiate, loop
)


# Musical constants
BPM = 140  # Fast-paced tempo
BEAT_DURATION = 60 / BPM  # Duration of one beat in seconds
BAR_DURATION = BEAT_DURATION * 4  # 4 beats per bar


def generate_kick_drum() -> np.ndarray:
    """Generate an electronic kick drum."""
    duration = 0.2

    # Pitch envelope - starts high, drops quickly
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    freq = 150 * np.exp(-30 * t) + 50

    # Generate with pitch modulation
    kick = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        kick[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Add click transient
    click = noise(0.01, amplitude=0.5)
    click = low_pass_filter(click, cutoff=3000)

    kick[:len(click)] += click
    kick *= np.exp(-8 * t)  # Amplitude decay

    kick = low_pass_filter(kick, cutoff=200)
    kick = distortion(kick, drive=1.2)

    return normalize(kick) * 0.8


def generate_snare() -> np.ndarray:
    """Generate an electronic snare."""
    duration = 0.15

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Tonal component
    tone = sine_wave(200, duration, amplitude=0.4)
    tone *= np.exp(-20 * t)

    # Noise component
    noise_part = noise(duration, amplitude=0.5)
    noise_part = high_pass_filter(noise_part, cutoff=2000)
    noise_part = low_pass_filter(noise_part, cutoff=8000)
    noise_part *= np.exp(-15 * t)

    snare = tone + noise_part
    return normalize(snare) * 0.6


def generate_hihat_closed() -> np.ndarray:
    """Generate a closed hi-hat."""
    duration = 0.05

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    hat = noise(duration, amplitude=0.4)
    hat = high_pass_filter(hat, cutoff=7000)
    hat *= np.exp(-40 * t)

    return normalize(hat) * 0.4


def generate_hihat_open() -> np.ndarray:
    """Generate an open hi-hat."""
    duration = 0.2

    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    hat = noise(duration, amplitude=0.4)
    hat = high_pass_filter(hat, cutoff=6000)
    hat *= np.exp(-8 * t)

    return normalize(hat) * 0.35


def generate_drum_pattern(bars: int = 4) -> np.ndarray:
    """Generate a drum pattern for the specified number of bars."""
    total_duration = bars * BAR_DURATION
    result = np.zeros(int(SAMPLE_RATE * total_duration))

    kick = generate_kick_drum()
    snare = generate_snare()
    hihat_c = generate_hihat_closed()
    hihat_o = generate_hihat_open()

    sixteenth = BEAT_DURATION / 4

    for bar in range(bars):
        bar_start = bar * BAR_DURATION

        # Kick pattern: 1, 1.5, 3 (of each bar)
        kick_times = [0, 0.5 * BEAT_DURATION, 2 * BEAT_DURATION]
        for t in kick_times:
            pos = int((bar_start + t) * SAMPLE_RATE)
            end = min(pos + len(kick), len(result))
            result[pos:end] += kick[:end-pos]

        # Snare on beats 2 and 4
        snare_times = [BEAT_DURATION, 3 * BEAT_DURATION]
        for t in snare_times:
            pos = int((bar_start + t) * SAMPLE_RATE)
            end = min(pos + len(snare), len(result))
            result[pos:end] += snare[:end-pos]

        # Hi-hats on every 8th note, open on offbeats
        for i in range(8):
            t = i * (BEAT_DURATION / 2)
            pos = int((bar_start + t) * SAMPLE_RATE)
            hat = hihat_o if i % 2 == 1 else hihat_c
            end = min(pos + len(hat), len(result))
            result[pos:end] += hat[:end-pos]

    return np.clip(result, -1, 1)


def generate_bass_line(bars: int = 4, root: float = 130.81) -> np.ndarray:
    """Generate a synth bass line."""
    total_duration = bars * BAR_DURATION
    result = np.zeros(int(SAMPLE_RATE * total_duration))

    # Bass pattern: root, octave up, fifth patterns
    # C minor vibes for that electronic feel
    notes_per_bar = [
        [root, root * 2, root * 1.5, root],  # C, C+oct, G, C
        [root * 0.89, root * 0.89 * 2, root * 1.5, root * 0.89],  # Bb pattern
        [root * 0.79, root * 0.79 * 2, root * 1.19, root * 0.79],  # Ab pattern
        [root * 0.75, root * 1.5, root, root * 0.75],  # G pattern
    ]

    eighth = BEAT_DURATION / 2

    for bar in range(bars):
        bar_start = bar * BAR_DURATION
        pattern = notes_per_bar[bar % len(notes_per_bar)]

        # Play 8th notes
        for i in range(8):
            t = i * eighth
            freq = pattern[i % len(pattern)]

            pos = int((bar_start + t) * SAMPLE_RATE)

            # Synth bass sound
            note_dur = eighth * 0.9
            note = sawtooth_wave(freq, note_dur, amplitude=0.35)
            note += square_wave(freq, note_dur, amplitude=0.15)
            note += sine_wave(freq * 0.5, note_dur, amplitude=0.2)  # Sub bass

            env = adsr_envelope(note_dur, attack=0.005, decay=0.05, sustain=0.6, release=0.05)
            note = note[:len(env)] * env
            note = low_pass_filter(note, cutoff=800)
            note = distortion(note, drive=1.1)

            end = min(pos + len(note), len(result))
            result[pos:end] += note[:end-pos]

    return np.clip(result, -1, 1)


def generate_arp_synth(bars: int = 4, root: float = 523.25) -> np.ndarray:
    """Generate an arpeggiated synth lead."""
    total_duration = bars * BAR_DURATION
    result = np.zeros(int(SAMPLE_RATE * total_duration))

    # Arpeggio notes (minor 7th chord)
    arp_intervals = [1, 1.19, 1.5, 1.78, 2]  # root, m3, 5, m7, octave

    sixteenth = BEAT_DURATION / 4

    for bar in range(bars):
        bar_start = bar * BAR_DURATION

        # Shift root for chord progression
        bar_root = root * [1, 0.89, 0.79, 0.75][bar % 4]

        for i in range(16):  # 16th notes
            t = i * sixteenth
            freq = bar_root * arp_intervals[i % len(arp_intervals)]

            pos = int((bar_start + t) * SAMPLE_RATE)
            note_dur = sixteenth * 0.8

            # Bright synth arp
            note = sawtooth_wave(freq, note_dur, amplitude=0.15)
            note += pulse_wave(freq, note_dur, duty=0.3, amplitude=0.1)

            env = adsr_envelope(note_dur, attack=0.005, decay=0.02, sustain=0.5, release=0.03)
            note = note[:len(env)] * env
            note = low_pass_filter(note, cutoff=4000)

            end = min(pos + len(note), len(result))
            result[pos:end] += note[:end-pos]

    # Add delay effect
    result = delay(result, delay_time=sixteenth * 3, feedback=0.3)

    return np.clip(result, -1, 1) * 0.6


def generate_pad(bars: int = 4, root: float = 261.63) -> np.ndarray:
    """Generate atmospheric pad."""
    total_duration = bars * BAR_DURATION
    result = np.zeros(int(SAMPLE_RATE * total_duration))

    # Chord progression: Cm - Bb - Ab - G
    chords = [
        [root, root * 1.19, root * 1.5],  # Cm
        [root * 0.89, root * 0.89 * 1.26, root * 0.89 * 1.5],  # Bb
        [root * 0.79, root * 0.79 * 1.26, root * 0.79 * 1.5],  # Ab
        [root * 0.75, root * 0.75 * 1.26, root * 0.75 * 1.5],  # G
    ]

    for bar in range(bars):
        bar_start = bar * BAR_DURATION
        chord_freqs = chords[bar % len(chords)]

        pos = int(bar_start * SAMPLE_RATE)

        # Lush pad sound
        pad = np.zeros(int(SAMPLE_RATE * BAR_DURATION))
        for freq in chord_freqs:
            tone = sawtooth_wave(freq, BAR_DURATION, amplitude=0.08)
            tone += sawtooth_wave(freq * 1.003, BAR_DURATION, amplitude=0.06)  # Detune
            tone += sine_wave(freq, BAR_DURATION, amplitude=0.05)
            pad += tone

        # Smooth envelope
        env = adsr_envelope(BAR_DURATION, attack=0.2, decay=0.3, sustain=0.6, release=0.4)
        pad = pad * env
        pad = low_pass_filter(pad, cutoff=2000)
        pad = chorus(pad, depth=0.003, rate=0.8)

        end = min(pos + len(pad), len(result))
        result[pos:end] += pad[:end-pos]

    return np.clip(result, -1, 1) * 0.5


def generate_fx_riser(duration: float = 4.0) -> np.ndarray:
    """Generate a riser/build-up effect."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Rising noise
    riser = noise(duration, amplitude=0.3)
    riser = high_pass_filter(riser, cutoff=500)

    # Increase intensity over time
    riser *= t / duration

    # Add rising pitch sweep
    freq = 100 + 1000 * (t / duration) ** 2
    sweep = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        sweep[i] = 0.15 * np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    riser += sweep * (t / duration)

    return normalize(riser)


def generate_blue_monday_kick() -> np.ndarray:
    """Generate an Oberheim DMX style kick - that iconic 80s thump."""
    duration = 0.35
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # DMX kick: starts at higher pitch, drops fast - very punchy
    freq = 200 * np.exp(-40 * t) + 40
    kick = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        kick[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Add second harmonic for that DMX body
    phase2 = 0
    for i in range(len(t)):
        kick[i] += 0.3 * np.sin(phase2)
        phase2 += 2 * np.pi * (freq[i] * 2) / SAMPLE_RATE

    # Sharp transient click
    click_len = int(0.008 * SAMPLE_RATE)
    click = noise(0.008, amplitude=0.5)
    click = high_pass_filter(click, cutoff=1000)
    click = low_pass_filter(click, cutoff=4000)
    kick[:click_len] += click[:click_len]

    # Tight amplitude envelope
    kick *= np.exp(-10 * t)
    kick = low_pass_filter(kick, cutoff=150)

    return normalize(kick) * 0.95


def generate_blue_monday_snare() -> np.ndarray:
    """Generate DMX style snare - crisp, electronic, punchy."""
    duration = 0.22
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Tonal body - two tones for that DMX character
    tone1 = sine_wave(190, duration, amplitude=0.4)
    tone2 = sine_wave(280, duration, amplitude=0.2)
    tone = (tone1 + tone2) * np.exp(-20 * t)

    # Crisp noise burst - the "snap"
    noise_part = noise(duration, amplitude=0.6)
    noise_part = high_pass_filter(noise_part, cutoff=2000)
    noise_part = low_pass_filter(noise_part, cutoff=8000)
    noise_part *= np.exp(-15 * t)

    snare = tone + noise_part
    return normalize(snare) * 0.7


def generate_blue_monday_hihat() -> np.ndarray:
    """Generate that crisp, metallic DMX hi-hat."""
    duration = 0.08
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Metallic ring - multiple high frequencies
    hat = noise(duration, amplitude=0.5)

    # Add metallic tones
    hat += sine_wave(8000, duration, amplitude=0.15)
    hat += sine_wave(10000, duration, amplitude=0.1)
    hat += sine_wave(12500, duration, amplitude=0.08)

    hat = high_pass_filter(hat, cutoff=6000)
    hat = low_pass_filter(hat, cutoff=14000)
    hat *= np.exp(-50 * t)

    return normalize(hat) * 0.45


def generate_blue_monday_bass_note(freq: float, duration: float) -> np.ndarray:
    """Generate that iconic squelchy Moog-style bass sound."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    # Multiple detuned sawtooth oscillators for thickness
    bass = np.zeros(num_samples)

    # Main oscillators - slightly detuned for fatness
    osc1 = sawtooth_wave(freq, duration, amplitude=0.4)
    osc2 = sawtooth_wave(freq * 1.005, duration, amplitude=0.35)
    osc3 = sawtooth_wave(freq * 0.995, duration, amplitude=0.35)

    # Sub oscillator (square wave one octave down)
    sub = square_wave(freq * 0.5, duration, amplitude=0.3)

    bass = osc1 + osc2 + osc3 + sub

    # THE KEY: Filter envelope that sweeps down (the "squelch")
    # Simulate resonant filter by boosting around cutoff
    filter_start = 3000
    filter_end = 400
    filter_decay = 12

    # Apply time-varying filter by processing in chunks
    chunk_size = 512
    filtered_bass = np.zeros(num_samples)

    for i in range(0, num_samples, chunk_size):
        chunk_end = min(i + chunk_size, num_samples)
        chunk = bass[i:chunk_end]
        chunk_time = i / SAMPLE_RATE

        # Calculate cutoff at this time
        cutoff = filter_end + (filter_start - filter_end) * np.exp(-filter_decay * chunk_time)
        cutoff = max(cutoff, filter_end)

        # Apply filter
        if len(chunk) > 0:
            filtered_chunk = low_pass_filter(chunk, cutoff=cutoff)
            filtered_bass[i:chunk_end] = filtered_chunk[:chunk_end - i]

    bass = filtered_bass

    # Add some resonance simulation - boost at filter frequency
    resonance = sine_wave(800, duration, amplitude=0.15)
    resonance *= np.exp(-10 * t)
    bass += resonance

    # Punchy amplitude envelope
    env = adsr_envelope(duration, attack=0.003, decay=0.08, sustain=0.7, release=0.05)
    bass = bass[:len(env)] * env

    # Light saturation for warmth
    bass = np.tanh(bass * 1.5) * 0.8

    return bass


def generate_blue_monday_synth_stab(freqs: list, duration: float) -> np.ndarray:
    """Generate bright, cutting New Order style synth stabs."""
    num_samples = int(SAMPLE_RATE * duration)
    result = np.zeros(num_samples)
    t = np.linspace(0, duration, num_samples, False)

    for freq in freqs:
        # Bright sawtooth
        tone = sawtooth_wave(freq, duration, amplitude=0.15)
        # Add pulse for bite
        tone += pulse_wave(freq, duration, duty=0.25, amplitude=0.1)
        # Slight detune for width
        tone += sawtooth_wave(freq * 1.003, duration, amplitude=0.08)
        result += tone

    # Very snappy envelope
    env = adsr_envelope(duration, attack=0.001, decay=0.1, sustain=0.15, release=0.08)
    result = result[:len(env)] * env

    # Bright filter
    result = low_pass_filter(result, cutoff=6000)

    # Stereo-ish chorus
    result = chorus(result, depth=0.003, rate=2.0)

    return result


def generate_blue_monday_string_pad(freqs: list, duration: float) -> np.ndarray:
    """Generate that shimmery 80s string synth pad."""
    num_samples = int(SAMPLE_RATE * duration)
    result = np.zeros(num_samples)

    for freq in freqs:
        # Multiple detuned saws for string ensemble effect
        tone = sawtooth_wave(freq, duration, amplitude=0.06)
        tone += sawtooth_wave(freq * 1.004, duration, amplitude=0.05)
        tone += sawtooth_wave(freq * 0.996, duration, amplitude=0.05)
        tone += sawtooth_wave(freq * 1.008, duration, amplitude=0.03)
        result += tone

    # Slow attack for pad feel
    env = adsr_envelope(duration, attack=0.3, decay=0.2, sustain=0.6, release=0.4)
    result = result[:len(env)] * env

    # Warm filter
    result = low_pass_filter(result, cutoff=3000)

    # Rich chorus for shimmer
    result = chorus(result, depth=0.004, rate=0.5)

    return result


def generate_blue_monday_clap() -> np.ndarray:
    """Generate that iconic 80s electronic clap."""
    duration = 0.15
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Multiple noise bursts for clap texture
    clap = np.zeros(len(t))

    # Layer multiple short bursts
    for offset in [0, 0.01, 0.02, 0.025]:
        burst_start = int(offset * SAMPLE_RATE)
        burst_len = int(0.03 * SAMPLE_RATE)
        if burst_start + burst_len < len(clap):
            burst = noise(0.03, amplitude=0.4)
            burst = high_pass_filter(burst, cutoff=1000)
            burst = low_pass_filter(burst, cutoff=6000)
            clap[burst_start:burst_start + len(burst)] += burst

    clap *= np.exp(-20 * t)
    return normalize(clap) * 0.55


def generate_blue_monday_tom(freq: float = 100) -> np.ndarray:
    """Generate electronic tom drum."""
    duration = 0.25
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Pitch drops
    pitch = freq * np.exp(-15 * t) + freq * 0.5
    tom = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        tom[i] = np.sin(phase)
        phase += 2 * np.pi * pitch[i] / SAMPLE_RATE

    tom *= np.exp(-12 * t)
    tom = low_pass_filter(tom, cutoff=300)

    return normalize(tom) * 0.6


def generate_blue_monday_arp_note(freq: float, duration: float) -> np.ndarray:
    """Generate arpeggiated synth note - that shimmery New Order arp."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    # Bright, glassy sound
    note = pulse_wave(freq, duration, duty=0.3, amplitude=0.2)
    note += sawtooth_wave(freq, duration, amplitude=0.15)
    note += triangle_wave(freq * 2, duration, amplitude=0.08)  # Octave shimmer

    # Quick, plucky envelope
    env = adsr_envelope(duration, attack=0.002, decay=0.08, sustain=0.3, release=0.05)
    note = note[:len(env)] * env

    note = low_pass_filter(note, cutoff=4500)

    return note


def generate_blue_monday_lead(freq: float, duration: float) -> np.ndarray:
    """Generate that singing synth lead sound."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    # PWM-style lead
    lead = pulse_wave(freq, duration, duty=0.4, amplitude=0.25)
    lead += pulse_wave(freq * 1.002, duration, duty=0.35, amplitude=0.2)
    lead += sawtooth_wave(freq * 0.998, duration, amplitude=0.15)

    # Smooth envelope
    env = adsr_envelope(duration, attack=0.02, decay=0.1, sustain=0.7, release=0.15)
    lead = lead[:len(env)] * env

    lead = low_pass_filter(lead, cutoff=3500)
    lead = chorus(lead, depth=0.003, rate=1.2)

    return lead


def generate_blue_monday_perc_hit() -> np.ndarray:
    """Generate percussion hit - like cowbell/woodblock."""
    duration = 0.1
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # High metallic tone
    hit = sine_wave(800, duration, amplitude=0.3)
    hit += sine_wave(1200, duration, amplitude=0.2)
    hit += sine_wave(2400, duration, amplitude=0.1)

    hit *= np.exp(-30 * t)

    return normalize(hit) * 0.35


def generate_sweep_riser(duration: float, start_freq: float = 200, end_freq: float = 2000) -> np.ndarray:
    """Generate a sweep riser for transitions."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    # Exponential frequency sweep
    freq = start_freq * (end_freq / start_freq) ** (t / duration)

    riser = np.zeros(num_samples)
    phase = 0
    for i in range(num_samples):
        riser[i] = 0.15 * np.sin(phase)
        riser[i] += 0.08 * np.sin(phase * 2)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Add filtered noise sweep
    noise_sweep = noise(duration, amplitude=0.12)
    noise_sweep = high_pass_filter(noise_sweep, cutoff=1000)
    noise_sweep *= (t / duration)  # Fade in

    riser += noise_sweep
    riser *= (t / duration) ** 1.2  # Build intensity

    return riser


def generate_sub_drop(duration: float = 0.3) -> np.ndarray:
    """Generate a satisfying sub bass drop hit."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Pitch dropping sub
    freq = 80 * np.exp(-8 * t) + 30
    drop = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        drop[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    drop *= np.exp(-6 * t)
    drop = low_pass_filter(drop, cutoff=100)

    return normalize(drop) * 0.6


def generate_fx_hit() -> np.ndarray:
    """Generate an impact/transition hit."""
    duration = 0.4
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Layered impact
    hit = sine_wave(60, duration, amplitude=0.4)
    hit += noise(duration, amplitude=0.3)
    hit = low_pass_filter(hit, cutoff=2000)
    hit *= np.exp(-8 * t)

    # Add high crack
    crack = noise(0.02, amplitude=0.5)
    crack = high_pass_filter(crack, cutoff=3000)
    hit[:len(crack)] += crack

    return normalize(hit) * 0.7


def generate_gameplay_loop(duration_seconds: float = 60) -> np.ndarray:
    """Generate sophisticated gameplay music with progressive builds and rich layers."""
    # Blue Monday tempo: ~130 BPM
    bm_bpm = 130
    beat_dur = 60 / bm_bpm
    bar_dur = beat_dur * 4
    section_duration = 4 * bar_dur
    num_sections = int(np.ceil(duration_seconds / section_duration))

    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    # Generate all drum sounds - authentic DMX style
    kick = generate_blue_monday_kick()
    snare = generate_blue_monday_snare()
    hihat = generate_blue_monday_hihat()
    clap = generate_blue_monday_clap()
    tom_low = generate_blue_monday_tom(80)
    tom_mid = generate_blue_monday_tom(120)
    tom_high = generate_blue_monday_tom(160)
    perc = generate_blue_monday_perc_hit()

    sixteenth = beat_dur / 4
    eighth = beat_dur / 2

    # THE ICONIC BLUE MONDAY BASS RIFF
    d_root = 73.42  # D2
    bass_pattern = [
        # Bar 1: Driving D groove with jumps
        (d_root, sixteenth), (d_root, sixteenth), (d_root, sixteenth), (d_root, sixteenth),
        (d_root, sixteenth), (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root, sixteenth),
        (d_root, sixteenth), (d_root, sixteenth), (d_root, sixteenth), (d_root * 1.5, sixteenth),
        (d_root, sixteenth), (d_root, sixteenth), (d_root * 2, sixteenth), (d_root * 1.5, sixteenth),
        # Bar 2: Movement to C
        (d_root, sixteenth), (d_root, sixteenth), (d_root, sixteenth), (d_root, sixteenth),
        (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root, sixteenth), (d_root, sixteenth),
        (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root, sixteenth),
        (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth), (d_root * 0.89, sixteenth), (d_root, sixteenth),
        # Bar 3: Bb section
        (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth),
        (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89 * 1.5, sixteenth), (d_root * 0.89, sixteenth),
        (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth),
        (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth), (d_root * 0.89, sixteenth), (d_root, sixteenth),
        # Bar 4: A section and build
        (d_root * 0.67, sixteenth), (d_root * 0.67, sixteenth), (d_root * 0.67, sixteenth), (d_root * 0.67, sixteenth),
        (d_root * 0.67, sixteenth), (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth),
        (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth),
        (d_root, sixteenth), (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root * 2, sixteenth),
    ]

    # Synth stab chords (Dm, C, Bb, A)
    dm_chord = [293.66, 349.23, 440.00]
    c_chord = [261.63, 329.63, 392.00]
    bb_chord = [233.08, 293.66, 349.23]
    a_chord = [220.00, 277.18, 329.63]

    # Pad chords (higher voicing)
    dm_pad = [587.33, 698.46, 880.00]
    c_pad = [523.25, 659.25, 783.99]
    bb_pad = [466.16, 587.33, 698.46]
    a_pad = [440.00, 554.37, 659.25]

    # Arpeggio notes for each chord
    dm_arp = [293.66, 349.23, 440.00, 587.33, 440.00, 349.23]
    c_arp = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]
    bb_arp = [233.08, 293.66, 349.23, 466.16, 349.23, 293.66]
    a_arp = [220.00, 277.18, 329.63, 440.00, 329.63, 277.18]

    # Lead melody (simple but catchy)
    lead_melody = [
        (587.33, eighth), (0, eighth), (523.25, eighth), (587.33, eighth),
        (698.46, beat_dur), (587.33, eighth), (523.25, eighth),
        (466.16, beat_dur), (440.00, eighth), (466.16, eighth),
        (523.25, beat_dur), (0, beat_dur),
    ]

    for section in range(num_sections):
        section_start = section * section_duration

        # ===== DRUMS =====
        for bar in range(4):
            bar_start = section_start + bar * bar_dur

            # Kick - four on floor with variations
            kick_times = [0, 1, 2, 3]
            if bar % 2 == 1:
                kick_times = [0, 0.75, 1.5, 2, 3, 3.5]
            for beat in kick_times:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(kick) < len(result):
                    result[pos:pos + len(kick)] += kick * 0.9

            # Snare on 2 and 4
            for beat in [1, 3]:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(snare) < len(result):
                    result[pos:pos + len(snare)] += snare * 0.75

            # Clap layered with snare
            for beat in [1, 3]:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(clap) < len(result):
                    result[pos:pos + len(clap)] += clap * 0.5

            # Hi-hats - 16th note pattern
            for i in range(16):
                t = bar_start + i * sixteenth
                pos = int(t * SAMPLE_RATE)
                if i % 4 == 0:
                    vol = 0.5
                elif i % 2 == 0:
                    vol = 0.35
                else:
                    vol = 0.25
                if pos + len(hihat) < len(result):
                    result[pos:pos + len(hihat)] += hihat * vol

            # Percussion hits on offbeats
            for i in [2, 6, 10, 14]:
                t = bar_start + i * sixteenth
                pos = int(t * SAMPLE_RATE)
                if pos + len(perc) < len(result):
                    result[pos:pos + len(perc)] += perc * 0.3

            # Tom fills on bar 4
            if bar == 3:
                tom_times = [(3.0, tom_high), (3.25, tom_mid), (3.5, tom_low), (3.75, tom_low)]
                for beat, tom in tom_times:
                    t = bar_start + beat * beat_dur
                    pos = int(t * SAMPLE_RATE)
                    if pos + len(tom) < len(result):
                        result[pos:pos + len(tom)] += tom * 0.5

        # ===== BASS RIFF =====
        bass_time = section_start
        for freq, dur in bass_pattern:
            pos = int(bass_time * SAMPLE_RATE)
            note = generate_blue_monday_bass_note(freq, dur * 0.85)
            if pos + len(note) < len(result):
                result[pos:pos + len(note)] += note * 0.55
            bass_time += dur

        # ===== SYNTH STABS =====
        stab_chords = [dm_chord, c_chord, bb_chord, a_chord]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur

            # Stab on beat 1
            pos = int(bar_start * SAMPLE_RATE)
            stab = generate_blue_monday_synth_stab(stab_chords[bar], beat_dur * 0.6)
            if pos + len(stab) < len(result):
                result[pos:pos + len(stab)] += stab * 0.45

            # Stab on "and" of 2
            pos2 = int((bar_start + 1.5 * beat_dur) * SAMPLE_RATE)
            stab2 = generate_blue_monday_synth_stab(stab_chords[bar], beat_dur * 0.4)
            if pos2 + len(stab2) < len(result):
                result[pos2:pos2 + len(stab2)] += stab2 * 0.35

            # Stab on beat 4
            pos3 = int((bar_start + 3 * beat_dur) * SAMPLE_RATE)
            stab3 = generate_blue_monday_synth_stab(stab_chords[bar], beat_dur * 0.5)
            if pos3 + len(stab3) < len(result):
                result[pos3:pos3 + len(stab3)] += stab3 * 0.35

        # ===== ARPEGGIOS =====
        arp_patterns = [dm_arp, c_arp, bb_arp, a_arp]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            arp = arp_patterns[bar]

            # 16th note arpeggios
            for i in range(16):
                t = bar_start + i * sixteenth
                pos = int(t * SAMPLE_RATE)
                freq = arp[i % len(arp)]
                note = generate_blue_monday_arp_note(freq, sixteenth * 0.8)
                if pos + len(note) < len(result):
                    result[pos:pos + len(note)] += note * 0.25

        # ===== STRING PADS =====
        pad_chords = [dm_pad, c_pad, bb_pad, a_pad]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            pos = int(bar_start * SAMPLE_RATE)

            pad = generate_blue_monday_string_pad(pad_chords[bar], bar_dur)
            end = min(pos + len(pad), len(result))
            if end > pos:
                result[pos:end] += pad[:end - pos] * 0.25

        # ===== LEAD MELODY (every other section) =====
        if section % 2 == 1:
            lead_time = section_start
            for freq, dur in lead_melody:
                if freq > 0:
                    pos = int(lead_time * SAMPLE_RATE)
                    note = generate_blue_monday_lead(freq, dur * 0.9)
                    if pos + len(note) < len(result):
                        result[pos:pos + len(note)] += note * 0.35
                lead_time += dur

        # ===== TRANSITION EFFECTS (between sections) =====
        # Add riser before even-numbered sections for build-up feel
        if section > 0 and section % 2 == 0:
            riser_dur = bar_dur
            riser_start = section_start - riser_dur
            if riser_start >= 0:
                pos = int(riser_start * SAMPLE_RATE)
                riser = generate_sweep_riser(riser_dur, 300, 1500)
                if pos + len(riser) < len(result):
                    result[pos:pos + len(riser)] += riser * 0.35

        # Add sub drop on beat 1 of every 4th section for impact
        if section % 4 == 0 and section > 0:
            pos = int(section_start * SAMPLE_RATE)
            drop = generate_sub_drop(0.4)
            if pos + len(drop) < len(result):
                result[pos:pos + len(drop)] += drop * 0.5

        # ===== COUNTER MELODY (sections 3, 7, 11...) =====
        if section % 4 == 3:
            counter_melody = [
                (440.00, eighth), (0, eighth), (392.00, eighth), (440.00, eighth),
                (523.25, beat_dur), (440.00, eighth), (392.00, eighth),
                (349.23, beat_dur), (0, beat_dur),
            ]
            counter_time = section_start + 2 * bar_dur
            for freq, dur in counter_melody:
                if freq > 0:
                    pos = int(counter_time * SAMPLE_RATE)
                    note = generate_blue_monday_lead(freq * 0.5, dur * 0.85)
                    if pos + len(note) < len(result):
                        result[pos:pos + len(note)] += note * 0.25
                counter_time += dur

        # ===== ENERGY BUILD (intensity increases with section) =====
        # Subtle volume boost for later sections
        section_boost = 1.0 + (section / num_sections) * 0.15
        section_end = int(min((section + 1) * section_duration, duration_seconds) * SAMPLE_RATE)
        section_start_samples = int(section_start * SAMPLE_RATE)
        result[section_start_samples:section_end] *= min(section_boost, 1.15)

    # Add delay effect to the whole mix for that 80s feel
    delayed = delay(result, delay_time=beat_dur * 0.75, feedback=0.2)
    result = result * 0.85 + delayed * 0.15

    # Master processing
    result = np.clip(result, -1, 1)
    result = low_pass_filter(result, cutoff=15000)
    result = normalize(result, target_db=-3)
    result = fade_in(result, 0.1)
    result = fade_out(result, 0.1)

    return result


def generate_lobby_kick() -> np.ndarray:
    """Generate a punchy lobby kick drum."""
    duration = 0.15
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Higher pitch, punchier kick
    freq = 180 * np.exp(-35 * t) + 55
    kick = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        kick[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Sharp click transient
    click = noise(0.008, amplitude=0.6)
    click = low_pass_filter(click, cutoff=4000)
    kick[:len(click)] += click
    kick *= np.exp(-10 * t)
    kick = distortion(kick, drive=1.3)

    return normalize(kick) * 0.85


def generate_lobby_synth_stab(freq: float, duration: float) -> np.ndarray:
    """Generate a punchy synth stab for the lobby."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Detuned saws for fat sound
    stab = sawtooth_wave(freq, duration, amplitude=0.3)
    stab += sawtooth_wave(freq * 1.005, duration, amplitude=0.25)
    stab += sawtooth_wave(freq * 0.995, duration, amplitude=0.25)
    stab += square_wave(freq * 0.5, duration, amplitude=0.15)  # Sub octave

    # Punchy envelope
    env = adsr_envelope(duration, attack=0.005, decay=0.08, sustain=0.3, release=0.1)
    stab = stab[:len(env)] * env

    # Filter sweep down
    stab = low_pass_filter(stab, cutoff=3500)

    return stab


def generate_lobby_arp_note(freq: float, duration: float) -> np.ndarray:
    """Generate sparkly arpeggio note for lobby."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    note = pulse_wave(freq, duration, duty=0.25, amplitude=0.2)
    note += sawtooth_wave(freq, duration, amplitude=0.15)
    note += sine_wave(freq * 2, duration, amplitude=0.1)  # Sparkle

    env = adsr_envelope(duration, attack=0.002, decay=0.05, sustain=0.4, release=0.03)
    note = note[:len(env)] * env
    note = low_pass_filter(note, cutoff=5000)

    return note


def generate_lobby_pad(freqs: list, duration: float) -> np.ndarray:
    """Generate warm pad for lobby."""
    num_samples = int(SAMPLE_RATE * duration)
    result = np.zeros(num_samples)

    for freq in freqs:
        tone = sawtooth_wave(freq, duration, amplitude=0.08)
        tone += sawtooth_wave(freq * 1.005, duration, amplitude=0.06)
        tone += triangle_wave(freq, duration, amplitude=0.04)
        result += tone

    env = adsr_envelope(duration, attack=0.2, decay=0.15, sustain=0.6, release=0.3)
    result = result[:len(env)] * env
    result = low_pass_filter(result, cutoff=2500)
    result = chorus(result, depth=0.004, rate=0.7)

    return result


def generate_lobby_lead(freq: float, duration: float) -> np.ndarray:
    """Generate catchy lead synth for lobby."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    lead = pulse_wave(freq, duration, duty=0.35, amplitude=0.3)
    lead += sawtooth_wave(freq * 1.002, duration, amplitude=0.2)
    lead += sine_wave(freq * 2, duration, amplitude=0.1)

    env = adsr_envelope(duration, attack=0.01, decay=0.08, sustain=0.6, release=0.1)
    lead = lead[:len(env)] * env
    lead = low_pass_filter(lead, cutoff=4000)

    return lead


def generate_cinematic_sub_bass(freq: float, duration: float) -> np.ndarray:
    """Generate deep, rumbling sub bass for cinematic tension."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    # Pure sub bass with slight movement
    sub = sine_wave(freq, duration, amplitude=0.6)
    sub += sine_wave(freq * 0.5, duration, amplitude=0.3)  # Even deeper sub

    # Add slight saturation for presence
    sub = np.tanh(sub * 1.3) * 0.9

    # Slow amplitude modulation for movement
    mod = 1 + 0.1 * np.sin(2 * np.pi * 0.25 * t)
    sub *= mod

    # Smooth envelope
    env = adsr_envelope(duration, attack=0.1, decay=0.2, sustain=0.8, release=0.3)
    sub = sub[:len(env)] * env

    return low_pass_filter(sub, cutoff=120)


def generate_dark_pad(freqs: list, duration: float) -> np.ndarray:
    """Generate dark, atmospheric pad with subtle movement."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)
    result = np.zeros(num_samples)

    for freq in freqs:
        # Multiple detuned oscillators for width
        tone = sawtooth_wave(freq, duration, amplitude=0.06)
        tone += sawtooth_wave(freq * 1.003, duration, amplitude=0.05)
        tone += sawtooth_wave(freq * 0.997, duration, amplitude=0.05)
        tone += triangle_wave(freq * 0.5, duration, amplitude=0.04)  # Sub octave

        result += tone

    # Dark filter with slow movement
    result = low_pass_filter(result, cutoff=1800)

    # Slow envelope
    env = adsr_envelope(duration, attack=0.4, decay=0.3, sustain=0.6, release=0.5)
    result = result[:len(env)] * env

    # Add depth with chorus
    result = chorus(result, depth=0.004, rate=0.3)

    return result


def generate_tension_riser(duration: float, start_freq: float = 80, end_freq: float = 400) -> np.ndarray:
    """Generate a tension-building riser element."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    # Exponential frequency sweep
    freq = start_freq * (end_freq / start_freq) ** (t / duration)

    # Generate with pitch sweep
    riser = np.zeros(num_samples)
    phase = 0
    for i in range(num_samples):
        riser[i] = 0.3 * np.sin(phase)
        riser[i] += 0.15 * np.sin(phase * 2)  # Harmonic
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Add noise layer
    noise_layer = noise(duration, amplitude=0.15)
    noise_layer = high_pass_filter(noise_layer, cutoff=2000)
    noise_layer *= t / duration  # Fade in

    riser += noise_layer

    # Intensity envelope
    riser *= (t / duration) ** 1.5

    return riser


def generate_industrial_hit() -> np.ndarray:
    """Generate an industrial/metallic percussion hit."""
    duration = 0.3
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Metallic body
    hit = sine_wave(120, duration, amplitude=0.4)
    hit += sine_wave(180, duration, amplitude=0.25)
    hit += sine_wave(350, duration, amplitude=0.15)

    # Noise burst
    noise_hit = noise(duration, amplitude=0.4)
    noise_hit = high_pass_filter(noise_hit, cutoff=1500)
    noise_hit = low_pass_filter(noise_hit, cutoff=6000)

    hit += noise_hit

    # Sharp decay
    hit *= np.exp(-12 * t)

    # Add sub thump
    thump = sine_wave(50, 0.15, amplitude=0.5)
    thump *= np.exp(-15 * np.linspace(0, 0.15, len(thump), False))
    hit[:len(thump)] += thump

    return normalize(hit) * 0.7


def generate_cinematic_kick() -> np.ndarray:
    """Generate a deep, cinematic kick drum."""
    duration = 0.4
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Very deep pitch sweep
    freq = 100 * np.exp(-25 * t) + 35
    kick = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        kick[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Add sub layer
    sub = sine_wave(35, duration, amplitude=0.4)
    sub *= np.exp(-8 * t)
    kick += sub

    # Punchy transient
    click = noise(0.015, amplitude=0.5)
    click = low_pass_filter(click, cutoff=3000)
    kick[:len(click)] += click

    kick *= np.exp(-6 * t)
    kick = low_pass_filter(kick, cutoff=180)

    return normalize(kick) * 0.9


def generate_dark_stab(freqs: list, duration: float) -> np.ndarray:
    """Generate dark, filtered synth stab."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)
    result = np.zeros(num_samples)

    for freq in freqs:
        tone = sawtooth_wave(freq, duration, amplitude=0.2)
        tone += square_wave(freq, duration, amplitude=0.1)
        tone += sawtooth_wave(freq * 1.005, duration, amplitude=0.12)
        result += tone

    # Filter envelope - sweep down for dark feel
    # Apply in chunks for time-varying filter
    chunk_size = 512
    filtered = np.zeros(num_samples)
    for i in range(0, num_samples, chunk_size):
        chunk_end = min(i + chunk_size, num_samples)
        chunk = result[i:chunk_end]
        chunk_time = i / SAMPLE_RATE
        cutoff = 3000 * np.exp(-8 * chunk_time) + 500
        if len(chunk) > 0:
            filtered[i:chunk_end] = low_pass_filter(chunk, cutoff=cutoff)[:chunk_end - i]

    result = filtered

    # Sharp envelope
    env = adsr_envelope(duration, attack=0.005, decay=0.15, sustain=0.2, release=0.1)
    result = result[:len(env)] * env

    return result


def generate_menu_music(duration_seconds: float = 60) -> np.ndarray:
    """Generate dark, cinematic menu music - military/action game style.

    Inspired by tension-building, atmospheric electronic music with:
    - Deep, pulsing sub bass
    - Dark atmospheric pads
    - Industrial percussion
    - Tension-building elements
    - Minor key, ominous feel
    """
    # Slower, more ominous tempo
    bpm = 95
    beat_dur = 60 / bpm
    bar_dur = beat_dur * 4
    section_duration = 8 * bar_dur  # Longer sections for development
    num_sections = int(np.ceil(duration_seconds / section_duration))

    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    # Generate percussion
    kick = generate_cinematic_kick()
    industrial = generate_industrial_hit()
    hihat = generate_hihat_closed()

    sixteenth = beat_dur / 4
    eighth = beat_dur / 2

    # D minor - dark and ominous
    root = 73.42  # D2

    # Dark chord progression: Dm - Bb - Gm - A (tension)
    dm_chord = [146.83, 174.61, 220.00]  # D3, F3, A3
    bb_chord = [116.54, 146.83, 174.61]  # Bb2, D3, F3
    gm_chord = [98.00, 116.54, 146.83]   # G2, Bb2, D3
    a_chord = [110.00, 138.59, 164.81]   # A2, C#3, E3 (dominant for tension)

    # Higher pad voicings for atmosphere
    dm_pad = [293.66, 349.23, 440.00]
    bb_pad = [233.08, 293.66, 349.23]
    gm_pad = [196.00, 233.08, 293.66]
    a_pad = [220.00, 277.18, 329.63]

    for section in range(num_sections):
        section_start = section * section_duration
        section_intensity = min(1.0, 0.6 + section * 0.1)  # Build intensity

        # ===== SUB BASS PULSE =====
        bass_pattern = [
            (root, 2), (root, 1), (root * 1.5, 1),
            (root * 0.79, 2), (root * 0.79, 1), (root, 1),  # Bb
            (root * 0.67, 2), (root * 0.67, 1), (root * 0.79, 1),  # G
            (root * 0.75, 2), (root * 0.75, 2),  # A - tension hold
        ]

        bass_time = section_start
        for freq, beats in bass_pattern:
            dur = beats * beat_dur
            pos = int(bass_time * SAMPLE_RATE)
            sub = generate_cinematic_sub_bass(freq, dur)
            if pos + len(sub) < len(result):
                result[pos:pos + len(sub)] += sub * 0.5 * section_intensity
            bass_time += dur

        # ===== CINEMATIC DRUMS =====
        for bar in range(8):
            bar_start = section_start + bar * bar_dur

            # Sparse, heavy kicks - half notes mostly
            kick_pattern = [0, 2] if bar % 2 == 0 else [0, 1.5, 3]
            for beat in kick_pattern:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(kick) < len(result):
                    result[pos:pos + len(kick)] += kick * 0.8 * section_intensity

            # Industrial hits on offbeats (sparse)
            if bar % 2 == 1:
                for beat in [1, 3]:
                    t = bar_start + beat * beat_dur
                    pos = int(t * SAMPLE_RATE)
                    if pos + len(industrial) < len(result):
                        result[pos:pos + len(industrial)] += industrial * 0.5 * section_intensity

            # Subtle hi-hats (only in later sections)
            if section >= 1:
                for i in range(8):
                    t = bar_start + i * eighth
                    pos = int(t * SAMPLE_RATE)
                    vol = 0.2 if i % 2 == 0 else 0.12
                    if pos + len(hihat) < len(result):
                        result[pos:pos + len(hihat)] += hihat * vol * section_intensity

        # ===== DARK PADS =====
        pad_progression = [dm_pad, dm_pad, bb_pad, bb_pad, gm_pad, gm_pad, a_pad, a_pad]
        for bar in range(8):
            bar_start = section_start + bar * bar_dur
            pos = int(bar_start * SAMPLE_RATE)
            pad = generate_dark_pad(pad_progression[bar], bar_dur)
            end = min(pos + len(pad), len(result))
            if end > pos:
                result[pos:end] += pad[:end - pos] * 0.35

        # ===== DARK STABS (sparse, rhythmic) =====
        stab_chords = [dm_chord, dm_chord, bb_chord, bb_chord, gm_chord, gm_chord, a_chord, a_chord]
        for bar in range(8):
            bar_start = section_start + bar * bar_dur
            # Stab on beat 1 of each bar
            pos = int(bar_start * SAMPLE_RATE)
            stab = generate_dark_stab(stab_chords[bar], beat_dur)
            if pos + len(stab) < len(result):
                result[pos:pos + len(stab)] += stab * 0.4 * section_intensity

            # Extra stab on "and" of 3 (syncopation)
            if bar % 2 == 0:
                pos2 = int((bar_start + 2.5 * beat_dur) * SAMPLE_RATE)
                stab2 = generate_dark_stab(stab_chords[bar], beat_dur * 0.5)
                if pos2 + len(stab2) < len(result):
                    result[pos2:pos2 + len(stab2)] += stab2 * 0.25 * section_intensity

        # ===== TENSION RISERS (at end of sections) =====
        if section < num_sections - 1:
            riser_start = section_start + 7 * bar_dur
            pos = int(riser_start * SAMPLE_RATE)
            riser = generate_tension_riser(bar_dur)
            if pos + len(riser) < len(result):
                result[pos:pos + len(riser)] += riser * 0.3

    # Add dark reverb
    result = reverb(result, room_size=0.6)

    # Subtle delay for depth
    delayed = delay(result, delay_time=beat_dur * 0.75, feedback=0.2)
    result = result * 0.85 + delayed * 0.15

    # Master processing
    result = np.clip(result, -1, 1)
    result = low_pass_filter(result, cutoff=14000)
    result = normalize(result, target_db=-4)
    result = fade_in(result, 0.5)
    result = fade_out(result, 1.0)

    return result


def generate_warm_pad(freqs: list, duration: float) -> np.ndarray:
    """Generate warm, lush pad for summary screen."""
    num_samples = int(SAMPLE_RATE * duration)
    result = np.zeros(num_samples)

    for freq in freqs:
        # Warm detuned oscillators
        tone = triangle_wave(freq, duration, amplitude=0.08)
        tone += sine_wave(freq, duration, amplitude=0.06)
        tone += sawtooth_wave(freq * 1.002, duration, amplitude=0.04)
        tone += sawtooth_wave(freq * 0.998, duration, amplitude=0.04)
        result += tone

    # Warm filter
    result = low_pass_filter(result, cutoff=3000)

    # Smooth envelope
    env = adsr_envelope(duration, attack=0.3, decay=0.2, sustain=0.7, release=0.4)
    result = result[:len(env)] * env

    # Lush chorus
    result = chorus(result, depth=0.003, rate=0.5)

    return result


def generate_pluck_note(freq: float, duration: float) -> np.ndarray:
    """Generate a soft pluck/bell sound."""
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, False)

    # Soft bell-like tone
    note = sine_wave(freq, duration, amplitude=0.2)
    note += sine_wave(freq * 2, duration, amplitude=0.08)
    note += sine_wave(freq * 3, duration, amplitude=0.03)
    note += triangle_wave(freq, duration, amplitude=0.1)

    # Pluck envelope
    env = np.exp(-4 * t)
    note *= env

    return note


def generate_soft_kick() -> np.ndarray:
    """Generate a soft, mellow kick for summary."""
    duration = 0.2
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    freq = 80 * np.exp(-20 * t) + 50
    kick = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        kick[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    kick *= np.exp(-10 * t)
    kick = low_pass_filter(kick, cutoff=150)

    return normalize(kick) * 0.5


def generate_brush_hit() -> np.ndarray:
    """Generate soft brush/shaker percussion."""
    duration = 0.1
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    brush = noise(duration, amplitude=0.25)
    brush = high_pass_filter(brush, cutoff=4000)
    brush = low_pass_filter(brush, cutoff=10000)
    brush *= np.exp(-25 * t)

    return normalize(brush) * 0.3


def generate_summary_music(duration_seconds: float = 60) -> np.ndarray:
    """Generate pleasant, chill summary music - sophisticated and not repetitive.

    Features:
    - Warm, evolving pad harmonies
    - Soft melodic elements that vary
    - Gentle percussion
    - Multiple sections with different feels
    - Suitable for repeated listening
    """
    bpm = 85  # Relaxed tempo
    beat_dur = 60 / bpm
    bar_dur = beat_dur * 4
    section_duration = 8 * bar_dur  # Long sections
    num_sections = int(np.ceil(duration_seconds / section_duration))

    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    eighth = beat_dur / 2
    sixteenth = beat_dur / 4

    # Generate soft percussion
    soft_kick = generate_soft_kick()
    brush = generate_brush_hit()

    # Rich chord progressions in different sections
    # Section A: C major feel - warm and triumphant
    c_pad = [261.63, 329.63, 392.00]  # C E G
    am_pad = [220.00, 261.63, 329.63]  # A C E
    f_pad = [174.61, 220.00, 261.63]  # F A C
    g_pad = [196.00, 246.94, 293.66]  # G B D

    # Section B: More colorful - add 7ths and 9ths
    cmaj7_pad = [261.63, 329.63, 392.00, 493.88]  # C E G B
    fmaj7_pad = [174.61, 220.00, 261.63, 329.63]  # F A C E
    dm7_pad = [146.83, 174.61, 220.00, 261.63]  # D F A C
    em7_pad = [164.81, 196.00, 246.94, 293.66]  # E G B D

    # Multiple melody variations
    melody_a = [
        (523.25, 1), (659.25, 0.5), (587.33, 0.5),
        (523.25, 1), (493.88, 1),
        (440.00, 0.5), (493.88, 0.5), (523.25, 2),
    ]

    melody_b = [
        (659.25, 0.5), (698.46, 0.5), (783.99, 1),
        (659.25, 1), (587.33, 0.5), (523.25, 0.5),
        (587.33, 2), (0, 1),
    ]

    melody_c = [
        (783.99, 0.5), (698.46, 0.5), (659.25, 0.5), (587.33, 0.5),
        (523.25, 2), (587.33, 1),
        (523.25, 1), (493.88, 1),
    ]

    # Arpeggio patterns
    c_arp = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]
    f_arp = [174.61, 220.00, 261.63, 349.23, 261.63, 220.00]
    g_arp = [196.00, 246.94, 293.66, 392.00, 293.66, 246.94]
    am_arp = [220.00, 261.63, 329.63, 440.00, 329.63, 261.63]

    melodies = [melody_a, melody_b, melody_c]

    for section in range(num_sections):
        section_start = section * section_duration
        section_type = section % 3  # Varies the feel

        # ===== WARM PADS =====
        if section_type == 0:
            pad_progression = [c_pad, am_pad, f_pad, g_pad, c_pad, am_pad, f_pad, g_pad]
        elif section_type == 1:
            pad_progression = [cmaj7_pad, fmaj7_pad, dm7_pad, g_pad, cmaj7_pad, em7_pad, fmaj7_pad, g_pad]
        else:
            pad_progression = [f_pad, c_pad, dm7_pad, am_pad, f_pad, g_pad, c_pad, c_pad]

        for bar in range(8):
            bar_start = section_start + bar * bar_dur
            pos = int(bar_start * SAMPLE_RATE)
            pad = generate_warm_pad(pad_progression[bar], bar_dur)
            end = min(pos + len(pad), len(result))
            if end > pos:
                result[pos:end] += pad[:end - pos] * 0.3

        # ===== SOFT PERCUSSION (every other section) =====
        if section % 2 == 1:
            for bar in range(8):
                bar_start = section_start + bar * bar_dur

                # Soft kick on 1 and 3
                for beat in [0, 2]:
                    t = bar_start + beat * beat_dur
                    pos = int(t * SAMPLE_RATE)
                    if pos + len(soft_kick) < len(result):
                        result[pos:pos + len(soft_kick)] += soft_kick * 0.6

                # Brush on offbeats
                for i in range(8):
                    t = bar_start + i * eighth
                    pos = int(t * SAMPLE_RATE)
                    vol = 0.4 if i % 2 == 1 else 0.25
                    if pos + len(brush) < len(result):
                        result[pos:pos + len(brush)] += brush * vol

        # ===== MELODIC PLUCKS =====
        melody = melodies[section % len(melodies)]
        melody_start = section_start + bar_dur  # Start after first bar
        melody_time = melody_start

        for freq, beats in melody:
            if freq > 0:
                pos = int(melody_time * SAMPLE_RATE)
                dur = beats * beat_dur
                note = generate_pluck_note(freq, dur)
                if pos + len(note) < len(result):
                    result[pos:pos + len(note)] += note * 0.35
            melody_time += beats * beat_dur

        # ===== ARPEGGIOS (alternating sections) =====
        if section_type != 1:
            arp_progression = [c_arp, f_arp, am_arp, g_arp]
            for bar in range(4, 8):  # Second half of section
                bar_start = section_start + bar * bar_dur
                arp = arp_progression[(bar - 4) % len(arp_progression)]

                for i in range(12):  # Triplet feel
                    t = bar_start + i * (beat_dur / 3)
                    pos = int(t * SAMPLE_RATE)
                    freq = arp[i % len(arp)]
                    note = generate_pluck_note(freq * 2, beat_dur / 3)  # Higher octave
                    if pos + len(note) < len(result):
                        result[pos:pos + len(note)] += note * 0.15

        # ===== BASS NOTES (subtle) =====
        bass_notes = [130.81, 110.00, 87.31, 98.00]  # C, A, F, G
        for bar in range(8):
            bar_start = section_start + bar * bar_dur
            pos = int(bar_start * SAMPLE_RATE)

            bass_freq = bass_notes[bar % len(bass_notes)]
            bass = sine_wave(bass_freq, bar_dur * 0.8, amplitude=0.25)
            bass += sine_wave(bass_freq * 0.5, bar_dur * 0.8, amplitude=0.15)

            env = adsr_envelope(bar_dur * 0.8, attack=0.1, decay=0.2, sustain=0.6, release=0.3)
            bass = bass[:len(env)] * env
            bass = low_pass_filter(bass, cutoff=200)

            if pos + len(bass) < len(result):
                result[pos:pos + len(bass)] += bass * 0.35

    # Warm reverb
    result = reverb(result, room_size=0.5)

    # Master processing
    result = np.clip(result, -1, 1)
    result = low_pass_filter(result, cutoff=12000)
    result = normalize(result, target_db=-5)
    result = fade_in(result, 0.5)
    result = fade_out(result, 1.5)

    return result


def generate_gameplay_intense(duration_seconds: float = 90) -> np.ndarray:
    """Generate INTENSE Blue Monday style music - faster, more layers, higher energy!"""
    # Faster tempo for intensity!
    bm_bpm = 140  # Faster than normal 130
    beat_dur = 60 / bm_bpm
    bar_dur = beat_dur * 4
    section_duration = 4 * bar_dur
    num_sections = int(np.ceil(duration_seconds / section_duration))

    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    # Generate all drum sounds
    kick = generate_blue_monday_kick()
    snare = generate_blue_monday_snare()
    hihat = generate_blue_monday_hihat()
    clap = generate_blue_monday_clap()
    tom_low = generate_blue_monday_tom(80)
    tom_mid = generate_blue_monday_tom(120)
    tom_high = generate_blue_monday_tom(160)
    perc = generate_blue_monday_perc_hit()

    sixteenth = beat_dur / 4
    eighth = beat_dur / 2

    # More aggressive bass pattern
    d_root = 73.42 * 1.06  # Slightly higher key for tension
    bass_pattern = [
        # Relentless 16th note pattern
        (d_root, sixteenth), (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root, sixteenth),
        (d_root, sixteenth), (d_root * 2, sixteenth), (d_root * 1.5, sixteenth), (d_root, sixteenth),
        (d_root, sixteenth), (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root * 2, sixteenth),
        (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root * 2, sixteenth), (d_root * 1.5, sixteenth),
        # Bar 2 - movement
        (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89 * 1.5, sixteenth), (d_root * 0.89, sixteenth),
        (d_root * 0.89, sixteenth), (d_root * 0.89 * 2, sixteenth), (d_root * 0.89, sixteenth), (d_root, sixteenth),
        (d_root * 0.89, sixteenth), (d_root, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89 * 1.5, sixteenth),
        (d_root * 0.75, sixteenth), (d_root * 0.89, sixteenth), (d_root, sixteenth), (d_root * 1.5, sixteenth),
        # Bar 3-4 - intense build
        (d_root * 0.75, sixteenth), (d_root * 0.75, sixteenth), (d_root * 0.75 * 1.5, sixteenth), (d_root * 0.75, sixteenth),
        (d_root * 0.75, sixteenth), (d_root * 0.75 * 2, sixteenth), (d_root * 0.89, sixteenth), (d_root * 0.89, sixteenth),
        (d_root * 0.67, sixteenth), (d_root * 0.67, sixteenth), (d_root * 0.67 * 1.5, sixteenth), (d_root * 0.75, sixteenth),
        (d_root * 0.75, sixteenth), (d_root * 0.89, sixteenth), (d_root, sixteenth), (d_root * 2, sixteenth),
        # Bar 4 - climax
        (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root * 2, sixteenth), (d_root * 1.5, sixteenth),
        (d_root, sixteenth), (d_root * 2, sixteenth), (d_root * 1.5, sixteenth), (d_root, sixteenth),
        (d_root * 0.89, sixteenth), (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root * 2, sixteenth),
        (d_root, sixteenth), (d_root * 1.5, sixteenth), (d_root * 2, sixteenth), (d_root * 2.5, sixteenth),
    ]

    # Chords
    dm_chord = [293.66 * 1.06, 349.23 * 1.06, 440.00 * 1.06]
    c_chord = [261.63 * 1.06, 329.63 * 1.06, 392.00 * 1.06]
    bb_chord = [233.08 * 1.06, 293.66 * 1.06, 349.23 * 1.06]
    a_chord = [220.00 * 1.06, 277.18 * 1.06, 329.63 * 1.06]

    # Higher pad voicings
    dm_pad = [587.33 * 1.06, 698.46 * 1.06, 880.00 * 1.06]
    c_pad = [523.25 * 1.06, 659.25 * 1.06, 783.99 * 1.06]
    bb_pad = [466.16 * 1.06, 587.33 * 1.06, 698.46 * 1.06]
    a_pad = [440.00 * 1.06, 554.37 * 1.06, 659.25 * 1.06]

    # Fast arpeggios
    dm_arp = [293.66 * 1.06, 349.23 * 1.06, 440.00 * 1.06, 587.33 * 1.06, 698.46 * 1.06, 587.33 * 1.06, 440.00 * 1.06, 349.23 * 1.06]
    c_arp = [261.63 * 1.06, 329.63 * 1.06, 392.00 * 1.06, 523.25 * 1.06, 659.25 * 1.06, 523.25 * 1.06, 392.00 * 1.06, 329.63 * 1.06]
    bb_arp = [233.08 * 1.06, 293.66 * 1.06, 349.23 * 1.06, 466.16 * 1.06, 587.33 * 1.06, 466.16 * 1.06, 349.23 * 1.06, 293.66 * 1.06]
    a_arp = [220.00 * 1.06, 277.18 * 1.06, 329.63 * 1.06, 440.00 * 1.06, 554.37 * 1.06, 440.00 * 1.06, 329.63 * 1.06, 277.18 * 1.06]

    for section in range(num_sections):
        section_start = section * section_duration

        # ===== INTENSE DRUMS =====
        for bar in range(4):
            bar_start = section_start + bar * bar_dur

            # Double-time kick on every 8th note!
            for i in range(8):
                t = bar_start + i * eighth
                pos = int(t * SAMPLE_RATE)
                vol = 0.95 if i % 2 == 0 else 0.75
                if pos + len(kick) < len(result):
                    result[pos:pos + len(kick)] += kick * vol

            # Snares with extra hits
            snare_times = [1, 2.5, 3, 3.75] if bar % 2 == 0 else [1, 1.5, 3, 3.5]
            for beat in snare_times:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(snare) < len(result):
                    result[pos:pos + len(snare)] += snare * 0.8

            # Claps on every snare
            for beat in [1, 3]:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(clap) < len(result):
                    result[pos:pos + len(clap)] += clap * 0.6

            # CRAZY 16th note hi-hats
            for i in range(16):
                t = bar_start + i * sixteenth
                pos = int(t * SAMPLE_RATE)
                vol = 0.6 if i % 4 == 0 else (0.45 if i % 2 == 0 else 0.35)
                if pos + len(hihat) < len(result):
                    result[pos:pos + len(hihat)] += hihat * vol

            # Extra percussion everywhere
            for i in range(8):
                t = bar_start + i * eighth + sixteenth
                pos = int(t * SAMPLE_RATE)
                if pos + len(perc) < len(result):
                    result[pos:pos + len(perc)] += perc * 0.35

            # Tom rolls more frequently
            if bar >= 2:
                tom_times = [(2.5, tom_high), (2.75, tom_high), (3.0, tom_mid), (3.25, tom_mid), (3.5, tom_low), (3.75, tom_low)]
                for beat, tom in tom_times:
                    t = bar_start + beat * beat_dur
                    pos = int(t * SAMPLE_RATE)
                    if pos + len(tom) < len(result):
                        result[pos:pos + len(tom)] += tom * 0.55

        # ===== INTENSE BASS =====
        bass_time = section_start
        for freq, dur in bass_pattern:
            pos = int(bass_time * SAMPLE_RATE)
            note = generate_blue_monday_bass_note(freq, dur * 0.8)
            if pos + len(note) < len(result):
                result[pos:pos + len(note)] += note * 0.65
            bass_time += dur

        # ===== MORE SYNTH STABS =====
        stab_chords = [dm_chord, c_chord, bb_chord, a_chord]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            # Stabs on every beat
            for beat in range(4):
                pos = int((bar_start + beat * beat_dur) * SAMPLE_RATE)
                stab = generate_blue_monday_synth_stab(stab_chords[bar], beat_dur * 0.5)
                vol = 0.5 if beat in [0, 2] else 0.35
                if pos + len(stab) < len(result):
                    result[pos:pos + len(stab)] += stab * vol

            # Extra stabs on offbeats
            for beat in [0.5, 1.5, 2.5, 3.5]:
                pos = int((bar_start + beat * beat_dur) * SAMPLE_RATE)
                stab = generate_blue_monday_synth_stab(stab_chords[bar], beat_dur * 0.3)
                if pos + len(stab) < len(result):
                    result[pos:pos + len(stab)] += stab * 0.25

        # ===== FAST ARPEGGIOS =====
        arp_patterns = [dm_arp, c_arp, bb_arp, a_arp]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            arp = arp_patterns[bar]
            # 32nd note arpeggios for intensity!
            thirty_second = sixteenth / 2
            for i in range(32):
                t = bar_start + i * thirty_second
                pos = int(t * SAMPLE_RATE)
                freq = arp[i % len(arp)]
                note = generate_blue_monday_arp_note(freq, thirty_second * 0.7)
                if pos + len(note) < len(result):
                    result[pos:pos + len(note)] += note * 0.3

        # ===== INTENSE PADS =====
        pad_chords = [dm_pad, c_pad, bb_pad, a_pad]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            pos = int(bar_start * SAMPLE_RATE)
            pad = generate_blue_monday_string_pad(pad_chords[bar], bar_dur)
            end = min(pos + len(pad), len(result))
            if end > pos:
                result[pos:end] += pad[:end - pos] * 0.35

        # ===== LEAD MELODY EVERY SECTION =====
        lead_melody = [
            (587.33 * 1.06, sixteenth * 2), (698.46 * 1.06, sixteenth * 2),
            (587.33 * 1.06, sixteenth), (523.25 * 1.06, sixteenth), (587.33 * 1.06, sixteenth * 2),
            (698.46 * 1.06, sixteenth * 4), (587.33 * 1.06, sixteenth * 2), (523.25 * 1.06, sixteenth * 2),
        ]
        lead_time = section_start + bar_dur
        for freq, dur in lead_melody:
            pos = int(lead_time * SAMPLE_RATE)
            note = generate_blue_monday_lead(freq, dur * 0.85)
            if pos + len(note) < len(result):
                result[pos:pos + len(note)] += note * 0.4
            lead_time += dur

        # ===== INTENSE RISERS (every 2 sections) =====
        if section % 2 == 1 and section < num_sections - 1:
            riser_dur = bar_dur * 0.75
            riser_start = section_start + 3 * bar_dur + beat_dur
            pos = int(riser_start * SAMPLE_RATE)
            riser = generate_sweep_riser(riser_dur, 500, 3000)
            if pos + len(riser) < len(result):
                result[pos:pos + len(riser)] += riser * 0.4

        # ===== IMPACT DROPS (every 4 sections) =====
        if section % 4 == 0:
            pos = int(section_start * SAMPLE_RATE)
            drop = generate_sub_drop(0.5)
            if pos + len(drop) < len(result):
                result[pos:pos + len(drop)] += drop * 0.6

        # ===== EXTRA HIGH SYNTH STABS (urgent feel) =====
        high_stab_freqs = [dm_chord[0] * 2, c_chord[0] * 2, bb_chord[0] * 2, a_chord[0] * 2]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            # Quick high stabs on offbeats
            for beat in [0.75, 2.75]:
                pos = int((bar_start + beat * beat_dur) * SAMPLE_RATE)
                high_note = sine_wave(high_stab_freqs[bar], beat_dur * 0.2, amplitude=0.12)
                high_note += sine_wave(high_stab_freqs[bar] * 1.5, beat_dur * 0.2, amplitude=0.06)
                env = adsr_envelope(beat_dur * 0.2, attack=0.002, decay=0.03, sustain=0.3, release=0.05)
                high_note = high_note[:len(env)] * env
                if pos + len(high_note) < len(result):
                    result[pos:pos + len(high_note)] += high_note

        # ===== PROGRESSIVE INTENSITY =====
        intensity = 1.0 + (section / num_sections) * 0.2
        section_end = int(min((section + 1) * section_duration, duration_seconds) * SAMPLE_RATE)
        section_start_samples = int(section_start * SAMPLE_RATE)
        result[section_start_samples:section_end] *= min(intensity, 1.2)

    # More aggressive delay
    delayed = delay(result, delay_time=beat_dur * 0.5, feedback=0.3)
    result = result * 0.75 + delayed * 0.25

    # Master processing - louder!
    result = np.clip(result, -1, 1)
    result = low_pass_filter(result, cutoff=16000)
    result = normalize(result, target_db=-2)

    # Crossfade for seamless loop
    crossfade_samples = int(SAMPLE_RATE * 0.5)
    fade_out_curve = np.linspace(1, 0, crossfade_samples)
    fade_in_curve = np.linspace(0, 1, crossfade_samples)
    result[-crossfade_samples:] *= fade_out_curve
    result[:crossfade_samples] *= fade_in_curve
    result[:crossfade_samples] += result[-crossfade_samples:] * fade_in_curve

    return result


def create_seamless_loop(track: np.ndarray, crossfade_seconds: float = 1.0) -> np.ndarray:
    """Apply crossfade to make a track loop seamlessly."""
    crossfade_samples = int(SAMPLE_RATE * crossfade_seconds)

    # Ensure we have enough samples
    if len(track) < crossfade_samples * 3:
        return track

    result = track.copy()

    # Create crossfade curves
    fade_out = np.linspace(1, 0, crossfade_samples) ** 0.5  # Square root for smoother fade
    fade_in = np.linspace(0, 1, crossfade_samples) ** 0.5

    # Copy the beginning for crossfade
    beginning = result[:crossfade_samples].copy()

    # Apply fade out at the end
    result[-crossfade_samples:] *= fade_out

    # Mix in faded beginning at the end
    result[-crossfade_samples:] += beginning * fade_in

    # Also fade in the very start slightly
    result[:crossfade_samples] *= fade_in

    return result


def generate_all_music(output_dir: str = "output/music"):
    """Generate all music tracks."""
    import os
    os.makedirs(output_dir, exist_ok=True)

    print("Generating music tracks (this may take a moment)...")

    # Gameplay loop - 120 seconds for less repetition, with seamless crossfade
    print("  Generating gameplay loop (120s)...")
    gameplay = generate_gameplay_loop(120)
    gameplay = create_seamless_loop(gameplay, crossfade_seconds=1.5)
    save_wav(gameplay, f"{output_dir}/gameplay_loop.wav")

    # INTENSE gameplay loop - for final 30 seconds
    print("  Generating intense gameplay loop (90s)...")
    gameplay_intense = generate_gameplay_intense(90)
    gameplay_intense = create_seamless_loop(gameplay_intense, crossfade_seconds=1.0)
    save_wav(gameplay_intense, f"{output_dir}/gameplay_intense.wav")

    # Menu/lobby music - 60 seconds for less repetition
    print("  Generating menu music (60s)...")
    menu = generate_menu_music(60)
    menu = create_seamless_loop(menu, crossfade_seconds=1.5)
    save_wav(menu, f"{output_dir}/menu_loop.wav")

    # Summary/results music - 60 seconds
    print("  Generating summary music (60s)...")
    summary = generate_summary_music(60)
    summary = create_seamless_loop(summary, crossfade_seconds=1.0)
    save_wav(summary, f"{output_dir}/summary_loop.wav")

    # Build-up riser for countdown
    print("  Generating countdown riser...")
    riser = generate_fx_riser(3.0)
    save_wav(riser, f"{output_dir}/countdown_riser.wav")

    print(f"All music tracks saved to {output_dir}/")


if __name__ == "__main__":
    generate_all_music()
