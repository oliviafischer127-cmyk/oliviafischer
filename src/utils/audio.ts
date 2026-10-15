/**
 * Audio helper utilities for Wonny Voice Assistant
 * Supports robust browser audio unlocking, Blob-based WAV playback,
 * Live PCM streaming, and native Deep-Male SpeechSynthesis fallback.
 */

let sharedAudioContext: AudioContext | null = null;
let currentActiveAudio: HTMLAudioElement | null = null;
let isCurrentlySpeakingTTS = false;

// Synchronously unlock audio capabilities upon any user interaction
export function unlockAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch (e) {
    console.warn('AudioContext unlock note:', e);
    return null;
  }
}

// Convert base64 WAV to Blob URL and play with full browser error handling
export function playWavBase64(
  base64Audio: string,
  onEnded?: () => void,
  onStart?: () => void
): HTMLAudioElement | null {
  stopCurrentPlayback();
  unlockAudioContext();

  try {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const objectUrl = URL.createObjectURL(blob);

    const audio = new Audio();
    audio.src = objectUrl;
    audio.preload = 'auto';

    let hasEnded = false;
    const cleanup = () => {
      if (!hasEnded) {
        hasEnded = true;
        URL.revokeObjectURL(objectUrl);
        if (currentActiveAudio === audio) {
          currentActiveAudio = null;
        }
        if (onEnded) onEnded();
      }
    };

    audio.onended = cleanup;
    audio.onerror = (e) => {
      console.warn('WAV playback error, falling back:', e);
      cleanup();
    };

    audio.onplay = () => {
      if (onStart) onStart();
    };

    currentActiveAudio = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Direct audio play error:', err);
        cleanup();
      });
    }

    return audio;
  } catch (err) {
    console.error('Failed to construct WAV audio blob:', err);
    if (onEnded) onEnded();
    return null;
  }
}

// Stop any currently playing audio or speech
export function stopCurrentPlayback() {
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch (e) {
      // ignore
    }
    currentActiveAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      isCurrentlySpeakingTTS = false;
    } catch (e) {
      // ignore
    }
  }
}

// High-fidelity fallback speech using browser SpeechSynthesis with deep male styling
export function speakWithBrowserTTS(
  text: string,
  language: 'en' | 'fr' = 'en',
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    stopCurrentPlayback();
    unlockAudioContext();

    // Clean text of markdown formatting if any
    const cleanText = text.replace(/[*_#`~]/g, '').trim();
    if (!cleanText) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'fr' ? 'fr-FR' : 'en-US';

    // Deep male pitch tuning
    utterance.pitch = 0.82; // Lower pitch gives deep masculine resonance
    utterance.rate = 0.94;  // Poised, calm luxury pace

    const voices = window.speechSynthesis.getVoices();
    // Try to find an articulate male voice
    const targetLang = language === 'fr' ? 'fr' : 'en';
    const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(targetLang));

    const maleVoice = langVoices.find((v) => {
      const name = v.name.toLowerCase();
      return (
        name.includes('male') ||
        name.includes('guy') ||
        name.includes('thomas') ||
        name.includes('george') ||
        name.includes('nicolas') ||
        name.includes('paul') ||
        name.includes('daniel') ||
        name.includes('david')
      );
    });

    if (maleVoice) {
      utterance.voice = maleVoice;
    } else if (langVoices.length > 0) {
      utterance.voice = langVoices[0];
    }

    utterance.onstart = () => {
      isCurrentlySpeakingTTS = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      isCurrentlySpeakingTTS = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      isCurrentlySpeakingTTS = false;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (e) {
    console.error('SpeechSynthesis failed:', e);
    if (onEnd) onEnd();
    return false;
  }
}

// Convert Float32Array into base64 16-bit PCM (for live streaming)
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

// Convert base64 PCM to Float32Array for AudioContext
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

// Queued PCM Player for Live API streams
export class LiveAudioPlayer {
  private ctx: AudioContext | null = null;
  private nextPlayTime = 0;
  private isMuted = false;

  public init() {
    if (!this.ctx) {
      this.ctx = unlockAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
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
      source.connect(this.ctx.destination);

      const currentTime = this.ctx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
    } catch (e) {
      console.error('Error in PCM player:', e);
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
