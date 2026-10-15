/**
 * Audio helper utilities for Wonny Voice Assistant
 * Supports both Live PCM audio streaming (Gemini Live API) and standard WAV playback
 */

// Convert Float32Array from Web Audio API microphone into base64 16-bit PCM (16kHz)
export function floatTo16BitPCM(input: Float32Array): string {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  let binary = '';
  const bytes = new Uint8Array(output.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 PCM (24kHz, 16-bit little-endian) to Float32Array for AudioContext
export function base64ToFloat32PCM(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

// Play WAV base64 string directly
export function playWavBase64(base64Audio: string, onEnded?: () => void): HTMLAudioElement {
  const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
  if (onEnded) {
    audio.onended = onEnded;
    audio.onerror = () => onEnded();
  }
  audio.play().catch((err) => {
    console.warn('Auto-play prevented or audio failed:', err);
    if (onEnded) onEnded();
  });
  return audio;
}

// Simple queued PCM Player for Live API streams
export class LiveAudioPlayer {
  private ctx: AudioContext | null = null;
  private nextPlayTime = 0;
  private analyser: AnalyserNode | null = null;
  private isMuted = false;

  constructor() {
    // Lazily initialized on first user interaction
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 24000 });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playChunk(pcmBase64: string) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const floatData = base64ToFloat32PCM(pcmBase64);
      const buffer = this.ctx.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      if (this.analyser) {
        source.connect(this.analyser);
      } else {
        source.connect(this.ctx.destination);
      }

      const currentTime = this.ctx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
    } catch (e) {
      console.error('Error queuing live audio chunk:', e);
    }
  }

  public stop() {
    if (this.ctx) {
      this.nextPlayTime = this.ctx.currentTime;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) this.stop();
  }
}
