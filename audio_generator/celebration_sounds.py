"""
Celebration and award sounds for the game summary.
Victory fanfares, award stingers, and celebration effects.
"""

import numpy as np
from synth import (
    SAMPLE_RATE, sine_wave, square_wave, sawtooth_wave, triangle_wave,
    noise, pulse_wave, adsr_envelope, quick_envelope, pluck_envelope,
    low_pass_filter, high_pass_filter, delay, reverb, distortion,
    mix_tracks, normalize, fade_in, fade_out, save_wav, note_to_freq,
    midi_to_freq, concatenate, chord, arpeggiate, loop
)


def generate_victory_fanfare() -> np.ndarray:
    """Epic victory fanfare for the winner."""
    duration = 2.5

    # Triumphant melody
    melody = [
        (523.25, 0.15),  # C5
        (523.25, 0.15),  # C5
        (523.25, 0.15),  # C5
        (523.25, 0.3),   # C5
        (415.30, 0.2),   # G#4
        (466.16, 0.2),   # A#4
        (523.25, 0.15),  # C5
        (466.16, 0.15),  # A#4
        (523.25, 0.6),   # C5 (long)
    ]

    result = np.zeros(int(SAMPLE_RATE * duration))
    pos = 0

    for freq, note_dur in melody:
        # Rich synth lead
        note = sawtooth_wave(freq, note_dur, amplitude=0.2)
        note += sawtooth_wave(freq * 1.01, note_dur, amplitude=0.15)  # Slight detune
        note += sine_wave(freq * 2, note_dur, amplitude=0.1)  # Octave
        note += triangle_wave(freq * 0.5, note_dur, amplitude=0.1)  # Sub

        env = adsr_envelope(note_dur, attack=0.01, decay=0.05, sustain=0.7, release=0.1)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=3500)

        end = min(pos + len(note), len(result))
        result[pos:end] += note[:end-pos]
        pos += int(note_dur * SAMPLE_RATE)

    # Add bass hits on downbeats
    bass_times = [0, 0.45, 0.9, 1.35]
    for t in bass_times:
        pos = int(t * SAMPLE_RATE)
        bass = sine_wave(130.81, 0.3, amplitude=0.3)  # C3
        bass += sine_wave(65.41, 0.3, amplitude=0.2)  # C2
        bass *= adsr_envelope(0.3, attack=0.01, decay=0.1, sustain=0.4, release=0.15)
        bass = low_pass_filter(bass, cutoff=500)
        end = min(pos + len(bass), len(result))
        result[pos:end] += bass[:end-pos]

    # Add sparkle/shimmer
    sparkle = noise(0.5, amplitude=0.15)
    sparkle = high_pass_filter(sparkle, cutoff=6000)
    sparkle *= np.exp(-3 * np.linspace(0, 0.5, len(sparkle)))
    result[-len(sparkle):] += sparkle

    result = reverb(result, room_size=0.4)
    return normalize(fade_out(result, 0.2))


def generate_word_award_reveal() -> np.ndarray:
    """Sound when revealing a word award."""
    duration = 0.5

    # Shimmery reveal
    wave = noise(duration, amplitude=0.15)
    wave = high_pass_filter(wave, cutoff=4000)

    # Rising tone
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    freq = 400 + 400 * (t / duration)

    tone = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        tone[i] = 0.2 * np.sin(phase)
        tone[i] += 0.1 * np.sin(phase * 2)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    wave += tone

    env = adsr_envelope(duration, attack=0.05, decay=0.1, sustain=0.6, release=0.2)
    wave = wave * env

    wave = reverb(wave, room_size=0.3)
    return normalize(wave)


def generate_points_fly() -> np.ndarray:
    """Whoosh sound for points flying to player."""
    duration = 0.35

    # Quick ascending whoosh
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    freq = 200 + 600 * (t / duration) ** 0.5

    wave = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        wave[i] = 0.15 * np.sin(phase)
        wave[i] += 0.1 * np.sin(phase * 1.5)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Add noise swoosh
    swoosh = noise(duration, amplitude=0.2)
    swoosh = high_pass_filter(swoosh, cutoff=2000)
    swoosh = low_pass_filter(swoosh, cutoff=6000)
    wave += swoosh

    env = adsr_envelope(duration, attack=0.02, decay=0.1, sustain=0.5, release=0.15)
    wave = wave * env

    return normalize(wave)


def generate_points_land() -> np.ndarray:
    """Sound when points land on player's score."""
    duration = 0.15

    # Quick impact with sparkle
    freq = 880
    wave = sine_wave(freq, duration, amplitude=0.3)
    wave += sine_wave(freq * 1.5, duration, amplitude=0.15)

    # Add soft click
    click = noise(0.02, amplitude=0.2)
    click = low_pass_filter(click, cutoff=3000)
    wave[:len(click)] += click

    env = quick_envelope(duration, attack=0.002, release=0.08)
    wave = wave * env

    return normalize(wave)


def generate_unique_word_bonus() -> np.ndarray:
    """Special sound for unique word bonus."""
    duration = 0.6

    # Magical sparkle arpeggio
    notes = [1046.50, 1318.51, 1567.98, 2093.00]  # C6, E6, G6, C7

    result = np.zeros(int(SAMPLE_RATE * duration))

    for i, freq in enumerate(notes):
        start = int(i * 0.1 * SAMPLE_RATE)
        note = sine_wave(freq, 0.3, amplitude=0.2)
        note += triangle_wave(freq * 2, 0.3, amplitude=0.1)

        env = pluck_envelope(0.3)
        note = note[:len(env)] * env

        end = start + len(note)
        if end <= len(result):
            result[start:end] += note

    # Add sparkle dust
    sparkle = noise(0.4, amplitude=0.15)
    sparkle = high_pass_filter(sparkle, cutoff=8000)
    sparkle *= np.exp(-5 * np.linspace(0, 0.4, len(sparkle)))
    result[:len(sparkle)] += sparkle

    result = reverb(result, room_size=0.5)
    return normalize(result)


def generate_challenge_complete() -> np.ndarray:
    """Sound for completing a challenge."""
    duration = 0.8

    # Achievement unlocked style
    notes = [
        (659.25, 0.12),  # E5
        (783.99, 0.12),  # G5
        (987.77, 0.12),  # B5
        (1174.66, 0.4),  # D6
    ]

    result = np.zeros(int(SAMPLE_RATE * duration))
    pos = 0

    for freq, note_dur in notes:
        note = sine_wave(freq, note_dur, amplitude=0.25)
        note += sawtooth_wave(freq, note_dur, amplitude=0.1)
        note += sine_wave(freq * 2, note_dur, amplitude=0.1)

        env = adsr_envelope(note_dur, attack=0.01, decay=0.03, sustain=0.7, release=0.1)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=4000)

        end = pos + len(note)
        if end <= len(result):
            result[pos:end] += note
        pos = end

    # Add shimmer
    shimmer = noise(0.3, amplitude=0.1)
    shimmer = high_pass_filter(shimmer, cutoff=6000)
    shimmer *= pluck_envelope(0.3)
    result[-int(SAMPLE_RATE * 0.3):] += shimmer[:int(SAMPLE_RATE * 0.3)]

    result = reverb(result, room_size=0.35)
    return normalize(result)


def generate_longest_word_award() -> np.ndarray:
    """Epic sound for longest word award."""
    duration = 1.5

    # Dramatic build and release
    # Low rumble build
    t = np.linspace(0, 0.6, int(SAMPLE_RATE * 0.6), False)
    rumble = sine_wave(60, 0.6, amplitude=0.2)
    rumble += noise(0.6, amplitude=0.1)
    rumble = low_pass_filter(rumble, cutoff=200)
    rumble *= np.linspace(0, 1, len(rumble))

    # Impact
    impact = sine_wave(80, 0.3, amplitude=0.4)
    noise_burst = noise(0.1, amplitude=0.3)
    impact[:len(noise_burst)] += noise_burst
    impact *= np.exp(-5 * np.linspace(0, 0.3, len(impact)))

    # Triumphant chord
    chord_notes = [261.63, 329.63, 392.00, 523.25]  # C major spread
    chord_sound = np.zeros(int(SAMPLE_RATE * 0.8))
    for freq in chord_notes:
        note = sawtooth_wave(freq, 0.8, amplitude=0.15)
        note += sine_wave(freq, 0.8, amplitude=0.1)
        chord_sound += note

    chord_env = adsr_envelope(0.8, attack=0.02, decay=0.2, sustain=0.5, release=0.4)
    chord_sound = chord_sound * chord_env
    chord_sound = low_pass_filter(chord_sound, cutoff=2500)

    # Combine
    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(rumble)] = rumble
    result[int(0.5 * SAMPLE_RATE):int(0.5 * SAMPLE_RATE) + len(impact)] += impact
    result[int(0.6 * SAMPLE_RATE):int(0.6 * SAMPLE_RATE) + len(chord_sound)] += chord_sound

    # Add final sparkle
    sparkle = noise(0.4, amplitude=0.12)
    sparkle = high_pass_filter(sparkle, cutoff=5000)
    sparkle *= pluck_envelope(0.4)
    result[-int(SAMPLE_RATE * 0.4):] += sparkle[:int(SAMPLE_RATE * 0.4)]

    result = reverb(result, room_size=0.5)
    return normalize(fade_out(result, 0.15))


def generate_leaderboard_reveal() -> np.ndarray:
    """Sound for revealing leaderboard positions."""
    duration = 0.4

    # Quick ascending blip
    freq = 600
    wave = sine_wave(freq, duration, amplitude=0.25)
    wave += triangle_wave(freq * 1.5, duration, amplitude=0.1)

    env = adsr_envelope(duration, attack=0.01, decay=0.1, sustain=0.4, release=0.2)
    wave = wave * env

    wave = reverb(wave, room_size=0.2)
    return normalize(wave)


def generate_confetti_burst() -> np.ndarray:
    """Confetti explosion sound."""
    duration = 0.5

    # Burst of noise with sparkle
    burst = noise(0.1, amplitude=0.4)
    burst = high_pass_filter(burst, cutoff=1000)
    burst *= np.exp(-20 * np.linspace(0, 0.1, len(burst)))

    # Falling sparkles
    sparkle = noise(duration, amplitude=0.15)
    sparkle = high_pass_filter(sparkle, cutoff=4000)
    sparkle *= np.exp(-3 * np.linspace(0, duration, len(sparkle)))

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(burst)] = burst
    result += sparkle

    # Add some random pings
    for _ in range(5):
        pos = int(np.random.random() * duration * SAMPLE_RATE * 0.8)
        freq = 1000 + np.random.random() * 2000
        ping = sine_wave(freq, 0.05, amplitude=0.1)
        ping *= pluck_envelope(0.05)
        end = min(pos + len(ping), len(result))
        result[pos:end] += ping[:end-pos]

    return normalize(result)


def generate_score_tick() -> np.ndarray:
    """Quick tick for score counting up."""
    duration = 0.03

    freq = 1000
    wave = sine_wave(freq, duration, amplitude=0.2)
    env = quick_envelope(duration, attack=0.001, release=0.01)
    wave = wave * env

    return normalize(wave)


def generate_final_score_reveal() -> np.ndarray:
    """Dramatic reveal of final score."""
    duration = 0.6

    # Build up
    t = np.linspace(0, 0.3, int(SAMPLE_RATE * 0.3), False)
    buildup = noise(0.3, amplitude=0.2)
    buildup = high_pass_filter(buildup, cutoff=500)
    buildup *= t / 0.3

    # Impact note
    impact = sine_wave(440, 0.3, amplitude=0.35)
    impact += sine_wave(880, 0.3, amplitude=0.15)
    impact += sawtooth_wave(440, 0.3, amplitude=0.1)
    impact *= adsr_envelope(0.3, attack=0.01, decay=0.1, sustain=0.5, release=0.15)

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(buildup)] = buildup
    result[int(0.3 * SAMPLE_RATE):int(0.3 * SAMPLE_RATE) + len(impact)] = impact

    result = reverb(result, room_size=0.3)
    return normalize(result)


def generate_button_click() -> np.ndarray:
    """UI button click sound."""
    duration = 0.06

    freq = 700
    wave = sine_wave(freq, duration, amplitude=0.2)

    # Add click at start
    click = noise(0.01, amplitude=0.1)
    wave[:len(click)] += click

    env = quick_envelope(duration, attack=0.001, release=0.02)
    wave = wave[:len(env)] * env

    return normalize(wave)


def generate_button_hover() -> np.ndarray:
    """Subtle hover sound."""
    duration = 0.04

    freq = 500
    wave = sine_wave(freq, duration, amplitude=0.1)
    env = quick_envelope(duration, attack=0.001, release=0.015)
    wave = wave * env

    return normalize(wave)


def generate_all_celebration_sounds(output_dir: str = "output/celebration"):
    """Generate all celebration and award sounds."""
    import os
    os.makedirs(output_dir, exist_ok=True)

    print("Generating celebration sounds...")

    save_wav(generate_victory_fanfare(), f"{output_dir}/victory_fanfare.wav")
    save_wav(generate_word_award_reveal(), f"{output_dir}/word_award_reveal.wav")
    save_wav(generate_points_fly(), f"{output_dir}/points_fly.wav")
    save_wav(generate_points_land(), f"{output_dir}/points_land.wav")
    save_wav(generate_unique_word_bonus(), f"{output_dir}/unique_word_bonus.wav")
    save_wav(generate_challenge_complete(), f"{output_dir}/challenge_complete.wav")
    save_wav(generate_longest_word_award(), f"{output_dir}/longest_word_award.wav")
    save_wav(generate_leaderboard_reveal(), f"{output_dir}/leaderboard_reveal.wav")
    save_wav(generate_confetti_burst(), f"{output_dir}/confetti_burst.wav")
    save_wav(generate_score_tick(), f"{output_dir}/score_tick.wav")
    save_wav(generate_final_score_reveal(), f"{output_dir}/final_score_reveal.wav")
    save_wav(generate_button_click(), f"{output_dir}/button_click.wav")
    save_wav(generate_button_hover(), f"{output_dir}/button_hover.wav")

    print(f"All celebration sounds saved to {output_dir}/")


if __name__ == "__main__":
    generate_all_celebration_sounds()
