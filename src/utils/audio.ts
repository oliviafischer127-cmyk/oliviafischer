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

// Preload voices immediately on load
let cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

// Find strictly English or French voice, never defaulting to the system's German voice
export function getStrictVoice(language: 'en' | 'fr' = 'en'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    voices = cachedVoices;
  }
  if (!voices || voices.length === 0) return null;

  if (language === 'en') {
    // Strictly filter for English voices ONLY. Reject any German, French, or foreign voice.
    const enVoices = voices.filter((v) => {
      const lang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      const isEnglish = lang.startsWith('en') || lang.includes('en-us') || lang.includes('en_us') || lang.includes('en-gb');
      const isGerman = lang.includes('de') || name.includes('german') || name.includes('deutsch') || name.includes('de-de') || name.includes('de_de');
      return isEnglish && !isGerman;
    });

    if (enVoices.length > 0) {
      // Priority 1: High-quality American Male voices
      const usMale = enVoices.find((v) => {
        const n = v.name.toLowerCase();
        const l = v.lang.toLowerCase();
        const isUs = l.includes('en-us') || l.includes('en_us');
        return isUs && (n.includes('david') || n.includes('guy') || n.includes('mark') || n.includes('male') || n.includes('alex') || n.includes('natural'));
      });
      if (usMale) return usMale;

      // Priority 2: Standard US English male or neutral
      const anyUs = enVoices.find((v) => {
        const l = v.lang.toLowerCase();
        const n = v.name.toLowerCase();
        return (l.includes('en-us') || l.includes('en_us')) && !n.includes('zira') && !n.includes('female');
      });
      if (anyUs) return anyUs;

      // Priority 3: Any English male voice (e.g. Daniel UK)
      const anyEnMale = enVoices.find((v) => {
        const n = v.name.toLowerCase();
        return n.includes('daniel') || n.includes('george') || n.includes('oliver') || n.includes('male');
      });
      if (anyEnMale) return anyEnMale;

      // Fallback: First strictly English voice
      return enVoices[0];
    }
    return null;
  } else {
    // Strictly filter for French voices ONLY.
    const frVoices = voices.filter((v) => {
      const lang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      const isFrench = lang.startsWith('fr') || lang.includes('fr-fr') || lang.includes('fr_fr');
      const isGerman = lang.includes('de') || name.includes('german') || name.includes('deutsch');
      return isFrench && !isGerman;
    });

    if (frVoices.length > 0) {
      const frMale = frVoices.find((v) => {
        const n = v.name.toLowerCase();
        return n.includes('paul') || n.includes('nicolas') || n.includes('guy') || n.includes('male') || n.includes('claude');
      });
      if (frMale) return frMale;
      return frVoices[0];
    }
    return null;
  }
}

// High-fidelity fallback speech using browser SpeechSynthesis with strict English/French voice
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

    // Strictly assign English or French voice
    const matchedVoice = getStrictVoice(language);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang;
    } else {
      utterance.lang = language === 'fr' ? 'fr-FR' : 'en-US';
    }

    // Pitch and pace
    utterance.pitch = 0.88; // Deep masculine tone without distorting accent
    utterance.rate = 0.96;  // Natural articulate executive pace

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
