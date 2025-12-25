"""
Synthesizer engine for generating electronic sounds.
Uses numpy for waveform generation and scipy for effects.
"""

import numpy as np
from scipy import signal
from scipy.io import wavfile
from typing import List, Tuple, Optional
import os

# Constants
SAMPLE_RATE = 44100


def sine_wave(freq: float, duration: float, amplitude: float = 0.5) -> np.ndarray:
    """Generate a sine wave."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    return amplitude * np.sin(2 * np.pi * freq * t)


def square_wave(freq: float, duration: float, amplitude: float = 0.5) -> np.ndarray:
    """Generate a square wave."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    return amplitude * signal.square(2 * np.pi * freq * t)


def sawtooth_wave(freq: float, duration: float, amplitude: float = 0.5) -> np.ndarray:
    """Generate a sawtooth wave."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    return amplitude * signal.sawtooth(2 * np.pi * freq * t)


def triangle_wave(freq: float, duration: float, amplitude: float = 0.5) -> np.ndarray:
    """Generate a triangle wave."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    return amplitude * signal.sawtooth(2 * np.pi * freq * t, width=0.5)


def noise(duration: float, amplitude: float = 0.5) -> np.ndarray:
    """Generate white noise."""
    samples = int(SAMPLE_RATE * duration)
    return amplitude * np.random.uniform(-1, 1, samples)


def pulse_wave(freq: float, duration: float, duty: float = 0.5, amplitude: float = 0.5) -> np.ndarray:
    """Generate a pulse wave with variable duty cycle."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    return amplitude * signal.square(2 * np.pi * freq * t, duty=duty)


# Envelope functions
def adsr_envelope(
    duration: float,
    attack: float = 0.01,
    decay: float = 0.1,
    sustain: float = 0.7,
    release: float = 0.1
) -> np.ndarray:
    """Generate an ADSR envelope."""
    samples = int(SAMPLE_RATE * duration)
    attack_samples = int(SAMPLE_RATE * attack)
    decay_samples = int(SAMPLE_RATE * decay)
    release_samples = int(SAMPLE_RATE * release)
    sustain_samples = samples - attack_samples - decay_samples - release_samples

    if sustain_samples < 0:
        sustain_samples = 0

    envelope = np.zeros(samples)

    # Attack
    if attack_samples > 0:
        envelope[:attack_samples] = np.linspace(0, 1, attack_samples)

    # Decay
    start = attack_samples
    end = start + decay_samples
    if decay_samples > 0 and end <= samples:
        envelope[start:end] = np.linspace(1, sustain, decay_samples)

    # Sustain
    start = attack_samples + decay_samples
    end = start + sustain_samples
    if end <= samples:
        envelope[start:end] = sustain

    # Release
    start = samples - release_samples
    if start >= 0 and release_samples > 0:
        envelope[start:] = np.linspace(sustain, 0, release_samples)

    return envelope


def quick_envelope(duration: float, attack: float = 0.005, release: float = 0.05) -> np.ndarray:
    """Generate a quick attack-release envelope for percussive sounds."""
    return adsr_envelope(duration, attack=attack, decay=0.01, sustain=0.8, release=release)


def pluck_envelope(duration: float) -> np.ndarray:
    """Generate a pluck-like envelope with fast attack and exponential decay."""
    samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, samples, False)
    return np.exp(-5 * t)


# Effects
def low_pass_filter(audio: np.ndarray, cutoff: float = 2000) -> np.ndarray:
    """Apply a low-pass filter."""
    nyquist = SAMPLE_RATE / 2
    normalized_cutoff = cutoff / nyquist
    if normalized_cutoff >= 1:
        return audio
    b, a = signal.butter(4, normalized_cutoff, btype='low')
    return signal.filtfilt(b, a, audio)


def high_pass_filter(audio: np.ndarray, cutoff: float = 200) -> np.ndarray:
    """Apply a high-pass filter."""
    nyquist = SAMPLE_RATE / 2
    normalized_cutoff = cutoff / nyquist
    if normalized_cutoff <= 0:
        return audio
    b, a = signal.butter(4, normalized_cutoff, btype='high')
    return signal.filtfilt(b, a, audio)


def delay(audio: np.ndarray, delay_time: float = 0.3, feedback: float = 0.4) -> np.ndarray:
    """Apply a delay effect."""
    delay_samples = int(SAMPLE_RATE * delay_time)
    output = np.copy(audio)

    for i in range(delay_samples, len(audio)):
        output[i] += feedback * output[i - delay_samples]

    return np.clip(output, -1, 1)


def reverb(audio: np.ndarray, room_size: float = 0.5) -> np.ndarray:
    """Simple reverb using multiple delays."""
    output = audio.copy()
    delays = [0.029, 0.037, 0.044, 0.053, 0.067, 0.083]

    for d in delays:
        delay_samples = int(SAMPLE_RATE * d * room_size)
        if delay_samples < len(audio):
            delayed = np.zeros_like(audio)
            delayed[delay_samples:] = audio[:-delay_samples] * (0.3 / len(delays))
            output += delayed

    return np.clip(output, -1, 1)


def distortion(audio: np.ndarray, drive: float = 2.0) -> np.ndarray:
    """Apply soft clipping distortion."""
    return np.tanh(audio * drive) / np.tanh(drive)


def bitcrush(audio: np.ndarray, bits: int = 8) -> np.ndarray:
    """Apply bit crushing effect for lo-fi sound."""
    levels = 2 ** bits
    return np.round(audio * levels) / levels


def chorus(audio: np.ndarray, depth: float = 0.002, rate: float = 1.5) -> np.ndarray:
    """Apply a chorus effect."""
    samples = len(audio)
    t = np.arange(samples) / SAMPLE_RATE
    mod = depth * np.sin(2 * np.pi * rate * t)

    output = np.zeros_like(audio)
    for i in range(samples):
        delay_samples = int(mod[i] * SAMPLE_RATE)
        source_idx = i - delay_samples
        if 0 <= source_idx < samples:
            output[i] = 0.5 * audio[i] + 0.5 * audio[source_idx]
        else:
            output[i] = audio[i]

    return output


# Arpeggiator
def arpeggiate(
    notes: List[float],
    note_duration: float,
    total_duration: float,
    wave_func=sawtooth_wave,
    envelope_func=quick_envelope
) -> np.ndarray:
    """Create an arpeggio from a list of frequencies."""
    samples = int(SAMPLE_RATE * total_duration)
    output = np.zeros(samples)
    note_samples = int(SAMPLE_RATE * note_duration)

    current_sample = 0
    note_idx = 0

    while current_sample < samples:
        freq = notes[note_idx % len(notes)]
        remaining = min(note_samples, samples - current_sample)
        actual_duration = remaining / SAMPLE_RATE

        note = wave_func(freq, actual_duration, amplitude=0.3)
        env = envelope_func(actual_duration)
        note = note[:len(env)] * env[:len(note)]

        end_sample = current_sample + len(note)
        output[current_sample:end_sample] = note

        current_sample += note_samples
        note_idx += 1

    return output


# Chord generation
def chord(
    root_freq: float,
    chord_type: str = 'major',
    duration: float = 1.0,
    wave_func=sawtooth_wave
) -> np.ndarray:
    """Generate a chord."""
    ratios = {
        'major': [1, 1.26, 1.5],  # root, major third, fifth
        'minor': [1, 1.19, 1.5],  # root, minor third, fifth
        'dim': [1, 1.19, 1.41],   # root, minor third, diminished fifth
        'aug': [1, 1.26, 1.59],   # root, major third, augmented fifth
        'sus4': [1, 1.33, 1.5],   # root, fourth, fifth
        'power': [1, 1.5, 2],     # root, fifth, octave
    }

    chord_ratios = ratios.get(chord_type, ratios['major'])
    output = np.zeros(int(SAMPLE_RATE * duration))

    for ratio in chord_ratios:
        freq = root_freq * ratio
        wave = wave_func(freq, duration, amplitude=0.2)
        output[:len(wave)] += wave

    return np.clip(output, -1, 1)


# Note frequency helpers
NOTE_FREQUENCIES = {
    'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
    'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
    'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
}


def note_to_freq(note: str, octave: int = 4) -> float:
    """Convert a note name to frequency."""
    base_freq = NOTE_FREQUENCIES.get(note.upper(), 440)
    return base_freq * (2 ** (octave - 4))


def freq_to_midi(freq: float) -> int:
    """Convert frequency to MIDI note number."""
    return int(69 + 12 * np.log2(freq / 440))


def midi_to_freq(midi: int) -> float:
    """Convert MIDI note number to frequency."""
    return 440 * (2 ** ((midi - 69) / 12))


# Mixing and output
def mix_tracks(tracks: List[np.ndarray], volumes: Optional[List[float]] = None) -> np.ndarray:
    """Mix multiple audio tracks together."""
    if not tracks:
        return np.array([])

    max_len = max(len(t) for t in tracks)
    output = np.zeros(max_len)

    if volumes is None:
        volumes = [1.0 / len(tracks)] * len(tracks)

    for track, vol in zip(tracks, volumes):
        output[:len(track)] += track * vol

    return np.clip(output, -1, 1)


def normalize(audio: np.ndarray, target_db: float = -3) -> np.ndarray:
    """Normalize audio to a target dB level."""
    if len(audio) == 0:
        return audio

    peak = np.max(np.abs(audio))
    if peak == 0:
        return audio

    target_amplitude = 10 ** (target_db / 20)
    return audio * (target_amplitude / peak)


def fade_in(audio: np.ndarray, duration: float = 0.01) -> np.ndarray:
    """Apply fade in."""
    samples = min(int(SAMPLE_RATE * duration), len(audio))
    audio = audio.copy()
    audio[:samples] *= np.linspace(0, 1, samples)
    return audio


def fade_out(audio: np.ndarray, duration: float = 0.01) -> np.ndarray:
    """Apply fade out."""
    samples = min(int(SAMPLE_RATE * duration), len(audio))
    audio = audio.copy()
    audio[-samples:] *= np.linspace(1, 0, samples)
    return audio


def save_wav(audio: np.ndarray, filename: str, sample_rate: int = SAMPLE_RATE):
    """Save audio as WAV file."""
    # Ensure output directory exists
    os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)

    # Normalize and convert to 16-bit
    audio = normalize(audio)
    audio_16bit = (audio * 32767).astype(np.int16)
    wavfile.write(filename, sample_rate, audio_16bit)
    print(f"Saved: {filename}")


def concatenate(audios: List[np.ndarray], gap: float = 0) -> np.ndarray:
    """Concatenate audio clips with optional gap."""
    if not audios:
        return np.array([])

    gap_samples = int(SAMPLE_RATE * gap)
    gap_audio = np.zeros(gap_samples)

    result = []
    for i, audio in enumerate(audios):
        result.append(audio)
        if i < len(audios) - 1 and gap_samples > 0:
            result.append(gap_audio)

    return np.concatenate(result)


def loop(audio: np.ndarray, times: int) -> np.ndarray:
    """Loop audio a number of times."""
    return np.tile(audio, times)
