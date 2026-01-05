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
    """Generate an Oberheim DMX style kick - punchy 80s drum machine."""
    duration = 0.25
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # DMX kick: punchy, tight, with that 80s thump
    freq = 160 * np.exp(-25 * t) + 45
    kick = np.zeros(len(t))
    phase = 0
    for i in range(len(t)):
        kick[i] = np.sin(phase)
        phase += 2 * np.pi * freq[i] / SAMPLE_RATE

    # Sharp click for attack
    click = noise(0.012, amplitude=0.4)
    click = low_pass_filter(click, cutoff=2500)
    kick[:len(click)] += click

    kick *= np.exp(-12 * t)
    kick = low_pass_filter(kick, cutoff=180)
    kick = distortion(kick, drive=1.15)

    return normalize(kick) * 0.9


def generate_blue_monday_snare() -> np.ndarray:
    """Generate DMX style snare - tight and punchy."""
    duration = 0.18
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Tonal body
    tone = sine_wave(180, duration, amplitude=0.35)
    tone *= np.exp(-25 * t)

    # Noise burst
    noise_part = noise(duration, amplitude=0.55)
    noise_part = high_pass_filter(noise_part, cutoff=1500)
    noise_part = low_pass_filter(noise_part, cutoff=6500)
    noise_part *= np.exp(-18 * t)

    snare = tone + noise_part
    snare = distortion(snare, drive=1.1)

    return normalize(snare) * 0.65


def generate_blue_monday_bass_note(freq: float, duration: float) -> np.ndarray:
    """Generate the iconic Blue Monday bass synth sound."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    # Moog-style bass: detuned oscillators for thickness
    bass = sawtooth_wave(freq, duration, amplitude=0.45)
    bass += sawtooth_wave(freq * 1.004, duration, amplitude=0.35)  # Slight detune
    bass += square_wave(freq * 0.5, duration, amplitude=0.25)  # Sub octave

    # Filter envelope - opens then closes (that squelchy sound)
    filter_env = 1500 + 2000 * np.exp(-8 * t)

    # Apply time-varying filter (simplified)
    bass = low_pass_filter(bass, cutoff=1800)

    # Punchy envelope
    env = adsr_envelope(duration, attack=0.008, decay=0.1, sustain=0.6, release=0.08)
    bass = bass[:len(env)] * env

    bass = distortion(bass, drive=1.15)

    return bass


def generate_blue_monday_synth_stab(freqs: list, duration: float) -> np.ndarray:
    """Generate the Blue Monday synth stab chord."""
    result = np.zeros(int(SAMPLE_RATE * duration))
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)

    for freq in freqs:
        # Bright, cutting synth
        tone = sawtooth_wave(freq, duration, amplitude=0.12)
        tone += pulse_wave(freq, duration, duty=0.4, amplitude=0.08)
        result += tone

    # Sharp attack, quick decay
    env = adsr_envelope(duration, attack=0.003, decay=0.15, sustain=0.2, release=0.1)
    result = result[:len(env)] * env

    result = low_pass_filter(result, cutoff=5000)
    result = chorus(result, depth=0.002, rate=1.5)

    return result


def generate_gameplay_loop(duration_seconds: float = 60) -> np.ndarray:
    """Generate Blue Monday style gameplay music - iconic 80s synth-pop."""
    # Blue Monday tempo: ~130 BPM
    bm_bpm = 130
    beat_dur = 60 / bm_bpm
    bar_dur = beat_dur * 4
    section_duration = 4 * bar_dur
    num_sections = int(np.ceil(duration_seconds / section_duration))

    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    # Generate drum sounds
    kick = generate_blue_monday_kick()
    snare = generate_blue_monday_snare()
    hihat_c = generate_hihat_closed()
    hihat_o = generate_hihat_open()

    sixteenth = beat_dur / 4
    eighth = beat_dur / 2

    # THE ICONIC BLUE MONDAY BASS RIFF
    # In F minor, that driving descending pattern
    f_root = 87.31  # F2
    bass_pattern = [
        # Bar 1: Driving F notes
        (f_root, eighth), (f_root, eighth), (f_root, eighth), (f_root, eighth),
        (f_root, eighth), (f_root, eighth), (f_root, eighth), (f_root, eighth),
        # Bar 2: F with movement to Eb
        (f_root, eighth), (f_root, eighth), (f_root, eighth), (f_root, eighth),
        (f_root * 0.944, eighth), (f_root * 0.944, eighth),  # Eb
        (f_root * 0.944, eighth), (f_root * 0.944, eighth),
        # Bar 3: Db down
        (f_root * 0.841, eighth), (f_root * 0.841, eighth),  # Db
        (f_root * 0.841, eighth), (f_root * 0.841, eighth),
        (f_root * 0.841, eighth), (f_root * 0.841, eighth),
        (f_root * 0.841, eighth), (f_root * 0.841, eighth),
        # Bar 4: C then back up
        (f_root * 0.749, eighth), (f_root * 0.749, eighth),  # C
        (f_root * 0.749, eighth), (f_root * 0.749, eighth),
        (f_root * 0.841, eighth), (f_root * 0.841, eighth),  # Db
        (f_root * 0.944, eighth), (f_root, eighth),  # Eb, F
    ]

    # Synth stab chords (Fm, Eb, Db, C)
    fm_chord = [174.61, 207.65, 261.63]  # F minor
    eb_chord = [155.56, 185.00, 233.08]  # Eb
    db_chord = [138.59, 174.61, 207.65]  # Db
    c_chord = [130.81, 164.81, 196.00]   # C minor

    for section in range(num_sections):
        section_start = section * section_duration

        # DRUMS - Blue Monday style
        for bar in range(4):
            bar_start = section_start + bar * bar_dur

            # Kick on every beat (four-on-the-floor)
            for beat in range(4):
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(kick) < len(result):
                    result[pos:pos + len(kick)] += kick

            # Snare on 2 and 4
            for beat in [1, 3]:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(snare) < len(result):
                    result[pos:pos + len(snare)] += snare * 0.75

            # Hi-hat pattern - Blue Monday has that distinctive 16th note pattern
            # with accents creating a driving groove
            for i in range(16):
                t = bar_start + i * sixteenth
                pos = int(t * SAMPLE_RATE)
                # Open hat on certain offbeats for that Blue Monday feel
                if i in [2, 6, 10, 14]:  # Offbeat opens
                    hat = hihat_o
                    vol = 0.35
                else:
                    hat = hihat_c
                    vol = 0.4 if i % 4 == 0 else 0.25
                if pos + len(hat) < len(result):
                    result[pos:pos + len(hat)] += hat * vol

        # BASS RIFF
        bass_time = section_start
        for freq, dur in bass_pattern:
            pos = int(bass_time * SAMPLE_RATE)
            note = generate_blue_monday_bass_note(freq, dur * 0.9)
            if pos + len(note) < len(result):
                result[pos:pos + len(note)] += note * 0.55
            bass_time += dur

        # SYNTH STABS - on beat 1 of each bar
        stab_chords = [fm_chord, eb_chord, db_chord, c_chord]
        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            pos = int(bar_start * SAMPLE_RATE)
            stab = generate_blue_monday_synth_stab(stab_chords[bar], beat_dur * 0.8)
            if pos + len(stab) < len(result):
                result[pos:pos + len(stab)] += stab * 0.45

            # Secondary stab on beat 3
            pos2 = int((bar_start + 2 * beat_dur) * SAMPLE_RATE)
            stab2 = generate_blue_monday_synth_stab(stab_chords[bar], beat_dur * 0.5)
            if pos2 + len(stab2) < len(result):
                result[pos2:pos2 + len(stab2)] += stab2 * 0.3

    # Add atmospheric synth pad
    pad_result = np.zeros(len(result))
    pad_chords = [
        [174.61 * 2, 207.65 * 2, 261.63 * 2],  # Fm high
        [155.56 * 2, 185.00 * 2, 233.08 * 2],  # Eb high
        [138.59 * 2, 174.61 * 2, 207.65 * 2],  # Db high
        [130.81 * 2, 164.81 * 2, 196.00 * 2],  # Cm high
    ]

    for section in range(num_sections):
        section_start = section * section_duration

        for bar in range(4):
            bar_start = section_start + bar * bar_dur
            pos = int(bar_start * SAMPLE_RATE)

            pad = np.zeros(int(SAMPLE_RATE * bar_dur))
            for freq in pad_chords[bar]:
                tone = sawtooth_wave(freq, bar_dur, amplitude=0.06)
                tone += sawtooth_wave(freq * 1.003, bar_dur, amplitude=0.04)
                pad += tone

            env = adsr_envelope(bar_dur, attack=0.15, decay=0.2, sustain=0.5, release=0.3)
            pad = pad[:len(env)] * env
            pad = low_pass_filter(pad, cutoff=2500)
            pad = chorus(pad, depth=0.003, rate=0.6)

            end = min(pos + len(pad), len(pad_result))
            if end > pos:
                pad_result[pos:end] += pad[:end - pos]

    result = result + pad_result * 0.35

    # Master processing
    result = np.clip(result, -1, 1)
    result = low_pass_filter(result, cutoff=14000)
    result = normalize(result, target_db=-5)
    result = fade_in(result, 0.15)
    result = fade_out(result, 0.15)

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


def generate_menu_music(duration_seconds: float = 30) -> np.ndarray:
    """Generate upbeat, catchy, head-banging lobby music."""
    # FAST tempo for head-banging energy!
    lobby_bpm = 128
    beat_dur = 60 / lobby_bpm
    bar_dur = beat_dur * 4
    section_duration = 4 * bar_dur
    num_sections = int(np.ceil(duration_seconds / section_duration))

    result = np.zeros(int(SAMPLE_RATE * duration_seconds))

    kick = generate_lobby_kick()
    snare = generate_snare()
    hihat = generate_hihat_closed()

    # Catchy synth riff - think electro/synth-pop hook
    # E minor pentatonic riff that's super catchy
    root = 164.81  # E3
    riff_notes = [
        (root * 2, 0.5),      # E4
        (root * 2 * 1.5, 0.25),  # B4
        (root * 2, 0.25),      # E4
        (root * 1.5, 0.5),     # B3
        (root * 2 * 1.335, 0.5),  # G4
        (root * 2, 0.25),      # E4
        (root * 1.5, 0.25),    # B3
        (root, 0.5),           # E3
    ]

    sixteenth = beat_dur / 4

    for section in range(num_sections):
        section_start = section * section_duration

        for bar in range(4):
            bar_start = section_start + bar * bar_dur

            # FOUR-ON-THE-FLOOR kick pattern - essential for head-banging!
            for beat in range(4):
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(kick) < len(result):
                    result[pos:pos + len(kick)] += kick * 0.9

            # Snare on 2 and 4
            for beat in [1, 3]:
                t = bar_start + beat * beat_dur
                pos = int(t * SAMPLE_RATE)
                if pos + len(snare) < len(result):
                    result[pos:pos + len(snare)] += snare * 0.7

            # Driving 16th note hi-hats
            for i in range(16):
                t = bar_start + i * sixteenth
                pos = int(t * SAMPLE_RATE)
                # Accent on beat
                vol = 0.5 if i % 4 == 0 else 0.3
                if pos + len(hihat) < len(result):
                    result[pos:pos + len(hihat)] += hihat * vol

        # Catchy synth riff
        riff_time = section_start
        for freq, dur in riff_notes:
            pos = int(riff_time * SAMPLE_RATE)
            note_dur = dur * beat_dur
            stab = generate_lobby_synth_stab(freq, note_dur)

            if pos + len(stab) < len(result):
                result[pos:pos + len(stab)] += stab * 0.6

            riff_time += note_dur

        # Repeat riff in second half of section
        riff_time = section_start + 2 * bar_dur
        for freq, dur in riff_notes:
            pos = int(riff_time * SAMPLE_RATE)
            note_dur = dur * beat_dur
            stab = generate_lobby_synth_stab(freq * 1.0595, note_dur)  # Slight pitch up for variation

            if pos + len(stab) < len(result):
                result[pos:pos + len(stab)] += stab * 0.55

            riff_time += note_dur

    # Add pumping bass
    bass_result = np.zeros(len(result))
    bass_root = 82.41  # E2
    bass_pattern = [1, 1, 1.5, 1, 1.335, 1, 1.5, 1]  # Root, root, 5th, root pattern

    for section in range(num_sections):
        section_start = section * section_duration

        for bar in range(4):
            bar_start = section_start + bar * bar_dur

            for i in range(8):
                t = bar_start + i * (beat_dur / 2)
                pos = int(t * SAMPLE_RATE)

                freq = bass_root * bass_pattern[i % len(bass_pattern)]
                note_dur = beat_dur / 2 * 0.9

                bass = sawtooth_wave(freq, note_dur, amplitude=0.4)
                bass += sine_wave(freq * 0.5, note_dur, amplitude=0.3)  # Sub

                env = adsr_envelope(note_dur, attack=0.005, decay=0.05, sustain=0.5, release=0.05)
                bass = bass[:len(env)] * env
                bass = low_pass_filter(bass, cutoff=600)
                bass = distortion(bass, drive=1.2)

                if pos + len(bass) < len(bass_result):
                    bass_result[pos:pos + len(bass)] += bass

    result = result + bass_result * 0.5

    # Master processing
    result = np.clip(result, -1, 1)
    result = low_pass_filter(result, cutoff=16000)
    result = normalize(result, target_db=-5)
    result = fade_in(result, 0.2)
    result = fade_out(result, 0.3)

    return result


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
