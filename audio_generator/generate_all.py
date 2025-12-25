#!/usr/bin/env python3
"""
Main script to generate all audio assets for Family Boggle.
Run this script to create all sound effects and music tracks.
"""

import os
import shutil
from pathlib import Path


def main():
    print("=" * 60)
    print("Family Boggle Audio Generator")
    print("=" * 60)
    print()

    # Import generators
    from sound_effects import generate_all_effects
    from celebration_sounds import generate_all_celebration_sounds
    from music import generate_all_music

    # Output directories
    base_output = Path(__file__).parent / "output"

    # Clear previous output
    if base_output.exists():
        print(f"Clearing previous output in {base_output}...")
        shutil.rmtree(base_output)

    # Generate all audio
    print()
    print("-" * 40)
    generate_all_effects(str(base_output / "sfx"))

    print()
    print("-" * 40)
    generate_all_celebration_sounds(str(base_output / "celebration"))

    print()
    print("-" * 40)
    generate_all_music(str(base_output / "music"))

    print()
    print("=" * 60)
    print("Audio generation complete!")
    print(f"All files saved to: {base_output}")
    print()

    # List all generated files
    print("Generated files:")
    for category in ["sfx", "celebration", "music"]:
        category_path = base_output / category
        if category_path.exists():
            print(f"\n  {category}/")
            for f in sorted(category_path.glob("*.wav")):
                size = f.stat().st_size / 1024
                print(f"    - {f.name} ({size:.1f} KB)")

    print()
    print("To use these in the game:")
    print("  1. Copy the 'output' folder to 'frontend/public/audio'")
    print("  2. The React app will load them from '/audio/...'")
    print()


if __name__ == "__main__":
    main()
