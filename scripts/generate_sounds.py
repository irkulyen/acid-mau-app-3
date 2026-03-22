#!/usr/bin/env python3
"""
Generate simple card game sound effects using numpy and scipy
"""
import numpy as np
from scipy.io import wavfile
import os

def generate_tone(frequency, duration, sample_rate=44100, volume=0.3):
    """Generate a simple sine wave tone"""
    t = np.linspace(0, duration, int(sample_rate * duration))
    # Add envelope (fade in/out) to avoid clicks
    envelope = np.ones_like(t)
    fade_samples = int(sample_rate * 0.01)  # 10ms fade
    envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
    envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)
    
    wave = np.sin(2 * np.pi * frequency * t) * envelope * volume
    return (wave * 32767).astype(np.int16)

def generate_card_play():
    """Card being played - quick snap sound"""
    sample_rate = 44100
    # Two quick tones (snap effect)
    tone1 = generate_tone(800, 0.05, sample_rate, 0.2)
    tone2 = generate_tone(600, 0.03, sample_rate, 0.15)
    silence = np.zeros(int(sample_rate * 0.01), dtype=np.int16)
    return np.concatenate([tone1, silence, tone2])

def generate_card_draw():
    """Card being drawn - soft swoosh"""
    sample_rate = 44100
    # Descending tone (swoosh effect)
    duration = 0.15
    t = np.linspace(0, duration, int(sample_rate * duration))
    # Frequency sweep from 1200 to 400 Hz
    freq = 1200 - (800 * t / duration)
    wave = np.sin(2 * np.pi * freq * t)
    
    # Envelope
    envelope = np.exp(-t * 8)  # Exponential decay
    wave = wave * envelope * 0.15
    return (wave * 32767).astype(np.int16)

def generate_round_end():
    """Round end - success chime"""
    sample_rate = 44100
    # Three ascending tones (C-E-G chord)
    tone1 = generate_tone(523, 0.15, sample_rate, 0.2)  # C5
    tone2 = generate_tone(659, 0.15, sample_rate, 0.15)  # E5
    tone3 = generate_tone(784, 0.2, sample_rate, 0.2)   # G5
    
    silence1 = np.zeros(int(sample_rate * 0.05), dtype=np.int16)
    silence2 = np.zeros(int(sample_rate * 0.05), dtype=np.int16)
    
    return np.concatenate([tone1, silence1, tone2, silence2, tone3])

def main():
    output_dir = "/home/ubuntu/crazyamsel-app/assets/sounds"
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating card game sounds...")
    
    # Generate sounds
    card_play = generate_card_play()
    card_draw = generate_card_draw()
    round_end = generate_round_end()
    
    # Save as WAV files
    sample_rate = 44100
    wavfile.write(f"{output_dir}/card-play.wav", sample_rate, card_play)
    wavfile.write(f"{output_dir}/card-draw.wav", sample_rate, card_draw)
    wavfile.write(f"{output_dir}/round-end.wav", sample_rate, round_end)
    
    print(f"✓ Generated 3 sound files in {output_dir}")
    print("  - card-play.wav (quick snap)")
    print("  - card-draw.wav (soft swoosh)")
    print("  - round-end.wav (success chime)")

if __name__ == "__main__":
    main()
