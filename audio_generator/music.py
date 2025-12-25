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


def generate_gameplay_loop(duration_seconds: float = 60) -> np.ndarray:
    """Generate the main gameplay music loop."""
    # Calculate how many 4-bar sections we need
    section_duration = 4 * BAR_DURATION
    num_sections = int(np.ceil(duration_seconds / section_duration))

    # Generate base patterns
    drums = generate_drum_pattern(4)
    bass = generate_bass_line(4)
    arp = generate_arp_synth(4)
    pad = generate_pad(4)

    # Loop everything
    drums = loop(drums, num_sections)
    bass = loop(bass, num_sections)
    arp = loop(arp, num_sections)
    pad = loop(pad, num_sections)

    # Mix tracks
    track = mix_tracks(
        [drums, bass, arp, pad],
        [0.35, 0.25, 0.22, 0.18]
    )

    # Trim to exact duration
    target_samples = int(duration_seconds * SAMPLE_RATE)
    track = track[:target_samples]

    # Apply master processing
    track = low_pass_filter(track, cutoff=15000)
    track = normalize(track, target_db=-6)

    # Add fade in/out for seamless looping
    track = fade_in(track, 0.1)
    track = fade_out(track, 0.1)

    return track


def generate_menu_music(duration_seconds: float = 30) -> np.ndarray:
    """Generate calmer menu/lobby music."""
    section_duration = 4 * BAR_DURATION
    num_sections = int(np.ceil(duration_seconds / section_duration))

    # Slower tempo for menu (just use longer notes)
    pad = generate_pad(4)
    pad = loop(pad, num_sections)

    # Sparse arp at half speed feel
    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    eighth = BEAT_DURATION / 2
    root = 523.25

    for section in range(num_sections):
        section_start = section * section_duration
        bar_root = root * [1, 0.89, 0.79, 0.75][section % 4]

        for i in range(0, 16, 2):  # Every other 16th = 8th notes
            t = section_start + i * (BEAT_DURATION / 4)
            freq = bar_root * [1, 1.5, 1.19, 2][i % 4]

            pos = int(t * SAMPLE_RATE)
            note_dur = BEAT_DURATION

            note = sine_wave(freq, note_dur, amplitude=0.2)
            note += triangle_wave(freq, note_dur, amplitude=0.1)

            env = adsr_envelope(note_dur, attack=0.1, decay=0.2, sustain=0.4, release=0.3)
            note = note[:len(env)] * env

            end = min(pos + len(note), len(result))
            result[pos:end] += note[:end-pos]

    result = delay(result, delay_time=0.3, feedback=0.4)

    # Mix with pad
    track = mix_tracks([pad[:len(result)], result], [0.5, 0.5])
    track = track[:int(duration_seconds * SAMPLE_RATE)]

    track = reverb(track, room_size=0.6)
    track = normalize(track, target_db=-8)
    track = fade_in(track, 0.5)
    track = fade_out(track, 0.5)

    return track


def generate_summary_music(duration_seconds: float = 45) -> np.ndarray:
    """Generate celebratory summary/results music."""
    # More upbeat and triumphant
    section_duration = 4 * BAR_DURATION
    num_sections = int(np.ceil(duration_seconds / section_duration))

    # Major key for victory feel
    root = 261.63  # C

    # Triumphant chord progression: C - G - Am - F
    chords = [
        [root, root * 1.26, root * 1.5],  # C major
        [root * 1.5, root * 1.5 * 1.26, root * 1.5 * 1.5],  # G major
        [root * 1.68, root * 2, root * 2.52],  # Am
        [root * 1.33, root * 1.68, root * 2],  # F major
    ]

    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    # Pad layer
    for section in range(num_sections):
        for bar in range(4):
            bar_start = section * section_duration + bar * BAR_DURATION
            chord_freqs = chords[bar % len(chords)]

            pos = int(bar_start * SAMPLE_RATE)
            if pos >= len(result):
                continue

            pad = np.zeros(int(SAMPLE_RATE * BAR_DURATION))
            for freq in chord_freqs:
                tone = sawtooth_wave(freq, BAR_DURATION, amplitude=0.1)
                tone += sine_wave(freq, BAR_DURATION, amplitude=0.08)
                pad += tone

            env = adsr_envelope(BAR_DURATION, attack=0.15, decay=0.2, sustain=0.7, release=0.3)
            pad = pad * env
            pad = low_pass_filter(pad, cutoff=2500)

            end = min(pos + len(pad), len(result))
            if end > pos:
                result[pos:end] += pad[:end-pos] * 0.4

    # Add light drums
    drums = generate_drum_pattern(4)
    drums = loop(drums, num_sections)
    if len(drums) > len(result):
        drums = drums[:len(result)]
    else:
        padded_drums = np.zeros(len(result))
        padded_drums[:len(drums)] = drums
        drums = padded_drums
    drums = drums * 0.25

    result = result + drums

    # Add bell/glockenspiel melody
    melody_notes = [
        (523.25, 0.5), (659.25, 0.25), (783.99, 0.25),
        (880.00, 0.5), (783.99, 0.5),
        (659.25, 0.5), (523.25, 0.5),
        (587.33, 0.5), (523.25, 0.5),
    ]

    for section in range(num_sections):
        pos = int(section * section_duration * SAMPLE_RATE)
        if pos >= len(result):
            continue
        note_pos = pos

        for freq, dur in melody_notes:
            if note_pos >= len(result):
                break

            note = sine_wave(freq * 2, dur, amplitude=0.15)  # Higher octave
            note += sine_wave(freq * 4, dur, amplitude=0.05)

            env = pluck_envelope(dur)
            note = note[:len(env)] * env

            end = min(note_pos + len(note), len(result))
            if end > note_pos:
                result[note_pos:end] += note[:end-note_pos]

            note_pos += int(dur * SAMPLE_RATE)

    result = reverb(result, room_size=0.4)
    result = normalize(result, target_db=-6)
    result = fade_in(result, 0.3)
    result = fade_out(result, 1.0)

    return result


def generate_all_music(output_dir: str = "output/music"):
    """Generate all music tracks."""
    import os
    os.makedirs(output_dir, exist_ok=True)

    print("Generating music tracks (this may take a moment)...")

    # Gameplay loop - 60 seconds that can loop seamlessly
    print("  Generating gameplay loop...")
    gameplay = generate_gameplay_loop(60)
    save_wav(gameplay, f"{output_dir}/gameplay_loop.wav")

    # Menu/lobby music - 30 seconds
    print("  Generating menu music...")
    menu = generate_menu_music(30)
    save_wav(menu, f"{output_dir}/menu_loop.wav")

    # Summary/results music - 45 seconds
    print("  Generating summary music...")
    summary = generate_summary_music(45)
    save_wav(summary, f"{output_dir}/summary_loop.wav")

    # Build-up riser for countdown
    print("  Generating countdown riser...")
    riser = generate_fx_riser(3.0)
    save_wav(riser, f"{output_dir}/countdown_riser.wav")

    print(f"All music tracks saved to {output_dir}/")


if __name__ == "__main__":
    generate_all_music()
