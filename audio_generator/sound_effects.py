"""
Sound effects generator for Family Boggle game.
Creates all the in-game sound effects.
"""

import numpy as np
from synth import (
    SAMPLE_RATE, sine_wave, square_wave, sawtooth_wave, triangle_wave,
    noise, pulse_wave, adsr_envelope, quick_envelope, pluck_envelope,
    low_pass_filter, high_pass_filter, delay, reverb, distortion,
    mix_tracks, normalize, fade_in, fade_out, save_wav, note_to_freq,
    midi_to_freq, concatenate, chord
)


def generate_letter_select() -> np.ndarray:
    """Sound when selecting/connecting a letter on the board."""
    duration = 0.08

    # High pitched blip
    freq = 880  # A5
    wave = sine_wave(freq, duration, amplitude=0.4)
    wave += sine_wave(freq * 2, duration, amplitude=0.2)  # Harmonic

    # Quick envelope
    env = quick_envelope(duration, attack=0.002, release=0.03)
    wave = wave[:len(env)] * env

    # Add a subtle click at the start
    click = noise(0.005, amplitude=0.3)
    click = low_pass_filter(click, cutoff=4000)

    result = np.zeros(len(wave))
    result[:len(click)] = click
    result += wave

    return normalize(fade_out(result, 0.01))


def generate_letter_chain() -> list:
    """Generate a series of ascending tones for letter chain (1-10 letters)."""
    sounds = []
    base_freq = 440  # A4

    for i in range(10):
        duration = 0.06
        # Ascending pitch for each letter in chain
        freq = base_freq * (1.05 ** i)  # Slightly higher each time

        wave = sine_wave(freq, duration, amplitude=0.3)
        wave += triangle_wave(freq * 2, duration, amplitude=0.15)

        env = quick_envelope(duration, attack=0.002, release=0.02)
        wave = wave[:len(env)] * env

        sounds.append(normalize(wave))

    return sounds


def generate_word_valid() -> np.ndarray:
    """Celebratory sound when a valid word is found."""
    duration = 0.4

    # Rising arpeggio with synth sound
    notes = [523.25, 659.25, 783.99, 1046.50]  # C5, E5, G5, C6 (C major)
    note_duration = 0.08

    result = np.zeros(int(SAMPLE_RATE * duration))

    for i, freq in enumerate(notes):
        start = int(i * note_duration * SAMPLE_RATE)
        note = sawtooth_wave(freq, note_duration * 1.5, amplitude=0.25)
        note += sine_wave(freq, note_duration * 1.5, amplitude=0.15)

        env = adsr_envelope(note_duration * 1.5, attack=0.005, decay=0.05, sustain=0.6, release=0.1)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=3000)

        end = start + len(note)
        if end <= len(result):
            result[start:end] += note

    # Add sparkle
    sparkle = noise(0.15, amplitude=0.1)
    sparkle = high_pass_filter(sparkle, cutoff=6000)
    sparkle *= pluck_envelope(0.15)
    result[:len(sparkle)] += sparkle

    result = reverb(result, room_size=0.3)
    return normalize(fade_out(result, 0.05))


def generate_word_invalid() -> np.ndarray:
    """Buzzer sound for invalid word."""
    duration = 0.25

    # Low buzzy sound
    freq = 150
    wave = square_wave(freq, duration, amplitude=0.3)
    wave += square_wave(freq * 1.02, duration, amplitude=0.2)  # Slight detune for thickness

    # Quick drop in pitch
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    pitch_mod = np.exp(-3 * t)

    # Regenerate with pitch modulation
    wave = np.zeros(int(SAMPLE_RATE * duration))
    phase = 0
    for i in range(len(wave)):
        current_freq = freq * (0.5 + 0.5 * pitch_mod[i])
        wave[i] = 0.3 * np.sign(np.sin(phase))
        phase += 2 * np.pi * current_freq / SAMPLE_RATE

    env = adsr_envelope(duration, attack=0.01, decay=0.1, sustain=0.4, release=0.1)
    wave = wave * env

    wave = low_pass_filter(wave, cutoff=1500)
    wave = distortion(wave, drive=1.5)

    return normalize(fade_out(wave, 0.02))


def generate_word_already_found() -> np.ndarray:
    """Soft 'already found' notification sound."""
    duration = 0.2

    # Two descending notes
    freq1, freq2 = 600, 450

    note1 = sine_wave(freq1, 0.1, amplitude=0.25)
    note1 *= quick_envelope(0.1, attack=0.005, release=0.03)

    note2 = sine_wave(freq2, 0.1, amplitude=0.25)
    note2 *= quick_envelope(0.1, attack=0.005, release=0.03)

    result = concatenate([note1, note2])
    return normalize(result)


def generate_powerup_earned() -> np.ndarray:
    """Exciting sound when earning a powerup."""
    duration = 0.6

    # Rising sweep
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    freq_sweep = 300 + 700 * (t / duration) ** 2  # Quadratic rise

    wave = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        wave[i] = 0.3 * np.sin(phase)
        wave[i] += 0.15 * np.sin(phase * 2)  # Harmonic
        phase += 2 * np.pi * freq_sweep[i] / SAMPLE_RATE

    env = adsr_envelope(duration, attack=0.02, decay=0.1, sustain=0.7, release=0.2)
    wave = wave * env

    # Add sparkle burst at the end
    sparkle = noise(0.2, amplitude=0.2)
    sparkle = high_pass_filter(sparkle, cutoff=5000)
    sparkle *= pluck_envelope(0.2)

    result = np.zeros(int(SAMPLE_RATE * 0.7))
    result[:len(wave)] = wave
    result[-len(sparkle):] += sparkle

    result = reverb(result, room_size=0.4)
    return normalize(result)


def generate_powerup_freeze() -> np.ndarray:
    """Icy freeze sound effect."""
    duration = 0.8

    # High shimmer
    wave = noise(duration, amplitude=0.3)
    wave = high_pass_filter(wave, cutoff=3000)

    # Add crystalline tones
    for freq in [2000, 2500, 3000, 4000]:
        tone = sine_wave(freq, duration, amplitude=0.1)
        tone *= adsr_envelope(duration, attack=0.1, decay=0.2, sustain=0.3, release=0.4)
        wave += tone

    # Whoosh down
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    whoosh_freq = 1500 * np.exp(-3 * t)
    whoosh = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        whoosh[i] = 0.2 * np.sin(phase)
        phase += 2 * np.pi * whoosh_freq[i] / SAMPLE_RATE

    wave += whoosh
    wave = reverb(wave, room_size=0.6)

    env = adsr_envelope(duration, attack=0.05, decay=0.2, sustain=0.5, release=0.3)
    wave = wave * env

    return normalize(fade_out(wave, 0.1))


def generate_powerup_bomb() -> np.ndarray:
    """Explosion bomb sound."""
    duration = 0.6

    # Low boom
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    freq = 80 * np.exp(-5 * t) + 40

    boom = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        boom[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    boom *= 0.5 * np.exp(-4 * t)

    # Add noise burst
    burst = noise(0.15, amplitude=0.4)
    burst = low_pass_filter(burst, cutoff=2000)
    burst *= np.exp(-15 * np.linspace(0, 0.15, len(burst)))

    result = np.zeros(int(SAMPLE_RATE * duration))
    result[:len(burst)] = burst
    result[:len(boom)] += boom

    result = distortion(result, drive=1.3)
    result = low_pass_filter(result, cutoff=3000)

    return normalize(result)


def generate_powerup_shuffle() -> np.ndarray:
    """Shuffle/whoosh sound."""
    duration = 0.5

    # Whooshing noise
    wave = noise(duration, amplitude=0.4)

    # Band-pass sweep
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    center_freq = 500 + 2000 * np.sin(np.pi * t / duration)

    # Simple moving filter simulation
    wave = low_pass_filter(wave, cutoff=3000)
    wave = high_pass_filter(wave, cutoff=300)

    # Add some rhythmic clicks
    for i in range(5):
        pos = int((i / 5) * len(wave))
        click = noise(0.01, amplitude=0.3)
        click = low_pass_filter(click, cutoff=5000)
        end = min(pos + len(click), len(wave))
        wave[pos:end] += click[:end-pos]

    env = adsr_envelope(duration, attack=0.02, decay=0.1, sustain=0.6, release=0.2)
    wave = wave * env

    return normalize(wave)


def generate_timer_tick() -> np.ndarray:
    """Clock tick for timer."""
    duration = 0.05

    freq = 1200
    wave = sine_wave(freq, duration, amplitude=0.2)

    # Add click at start
    click_samples = int(SAMPLE_RATE * 0.01)
    click = noise(0.01, amplitude=0.1)
    wave[:click_samples] += click[:click_samples]

    env = quick_envelope(duration, attack=0.001, release=0.02)
    wave = wave[:len(env)] * env

    return normalize(wave)


def generate_timer_warning() -> np.ndarray:
    """Urgent beeping for low time."""
    duration = 0.15

    freq = 800
    wave = square_wave(freq, duration, amplitude=0.25)
    wave = low_pass_filter(wave, cutoff=2000)

    env = quick_envelope(duration, attack=0.005, release=0.05)
    wave = wave * env

    return normalize(wave)


def generate_game_start() -> np.ndarray:
    """Game starting sound - countdown finished."""
    duration = 0.8

    # Ascending power chord
    notes = [
        (130.81, 0.15),   # C3
        (164.81, 0.15),   # E3
        (196.00, 0.15),   # G3
        (261.63, 0.35),   # C4 (longer)
    ]

    result = np.zeros(int(SAMPLE_RATE * duration))
    pos = 0

    for freq, note_dur in notes:
        note = sawtooth_wave(freq, note_dur, amplitude=0.2)
        note += sawtooth_wave(freq * 1.5, note_dur, amplitude=0.15)  # Fifth
        note += sine_wave(freq * 2, note_dur, amplitude=0.1)  # Octave

        env = adsr_envelope(note_dur, attack=0.01, decay=0.05, sustain=0.7, release=0.1)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=2500)

        end = pos + len(note)
        if end <= len(result):
            result[pos:end] += note
        pos = end

    result = reverb(result, room_size=0.3)
    return normalize(result)


def generate_countdown_beep() -> np.ndarray:
    """Countdown beep (3, 2, 1)."""
    duration = 0.2

    freq = 660
    wave = sine_wave(freq, duration, amplitude=0.3)
    wave += sine_wave(freq * 2, duration, amplitude=0.1)

    env = adsr_envelope(duration, attack=0.005, decay=0.05, sustain=0.5, release=0.1)
    wave = wave * env

    return normalize(wave)


def generate_countdown_go() -> np.ndarray:
    """Final 'GO!' beep - higher and longer."""
    duration = 0.4

    freq = 880
    wave = sine_wave(freq, duration, amplitude=0.35)
    wave += sine_wave(freq * 2, duration, amplitude=0.15)
    wave += sawtooth_wave(freq, duration, amplitude=0.1)

    env = adsr_envelope(duration, attack=0.01, decay=0.1, sustain=0.6, release=0.2)
    wave = wave * env
    wave = low_pass_filter(wave, cutoff=4000)

    return normalize(reverb(wave, room_size=0.2))


def generate_game_end() -> np.ndarray:
    """Game over/time's up sound."""
    duration = 1.0

    # Descending chord
    freqs = [523.25, 392.00, 329.63, 261.63]  # C5, G4, E4, C4

    result = np.zeros(int(SAMPLE_RATE * duration))

    for i, freq in enumerate(freqs):
        start = int(i * 0.15 * SAMPLE_RATE)
        note = sawtooth_wave(freq, 0.5, amplitude=0.2)
        note += sine_wave(freq, 0.5, amplitude=0.15)

        env = adsr_envelope(0.5, attack=0.01, decay=0.1, sustain=0.5, release=0.3)
        note = note[:len(env)] * env
        note = low_pass_filter(note, cutoff=2000)

        end = start + len(note)
        if end <= len(result):
            result[start:end] += note

    result = reverb(result, room_size=0.4)
    return normalize(fade_out(result, 0.2))


def generate_all_effects(output_dir: str = "output/sfx"):
    """Generate all sound effects and save them."""
    import os
    os.makedirs(output_dir, exist_ok=True)

    print("Generating sound effects...")

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

    # Timer
    save_wav(generate_timer_tick(), f"{output_dir}/timer_tick.wav")
    save_wav(generate_timer_warning(), f"{output_dir}/timer_warning.wav")

    # Game state
    save_wav(generate_game_start(), f"{output_dir}/game_start.wav")
    save_wav(generate_countdown_beep(), f"{output_dir}/countdown_beep.wav")
    save_wav(generate_countdown_go(), f"{output_dir}/countdown_go.wav")
    save_wav(generate_game_end(), f"{output_dir}/game_end.wav")

    print(f"All sound effects saved to {output_dir}/")


if __name__ == "__main__":
    generate_all_effects()
