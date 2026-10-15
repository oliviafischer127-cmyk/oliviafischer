import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Send,
  X,
  Radio,
  Square,
  AlertCircle,
} from 'lucide-react';
import { AudioWaveVisualizer } from './AudioWaveVisualizer.tsx';
import {
  playWavBase64,
  speakWithBrowserTTS,
  stopCurrentPlayback,
  unlockAudioContext,
} from '../utils/audio.ts';

export interface Message {
  id: string;
  sender: 'wonny' | 'user';
  text: string;
  language?: 'en' | 'fr';
  audioBase64?: string | null;
  timestamp: string;
}

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

export const VoiceAssistantDrawer: React.FC<VoiceAssistantProps> = ({
  isOpen,
  onClose,
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'wonny',
      text: "Good day. I am Wonny, the personal executive voice assistant representing Olivia Fischer. I speak with a deep, calm male tone in both English and French. How may I introduce Olivia's luxury marketing achievements, her Kusmi Tea experience, or her Franco-German credentials today?",
      language: 'en',
      timestamp: 'Just now',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, interimTranscript]);

  const lastTriggeredPromptRef = useRef<string | null>(null);

  // Handle triggered initial prompt from page
  useEffect(() => {
    if (initialPrompt && isOpen && initialPrompt !== lastTriggeredPromptRef.current) {
      lastTriggeredPromptRef.current = initialPrompt;
      handleSendMessage(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt, isOpen]);

  // Reset trigger ref when drawer closes
  useEffect(() => {
    if (!isOpen) {
      lastTriggeredPromptRef.current = null;
    }
  }, [isOpen]);

  // Speak response with double-redundant audio pipeline
  const speakResponse = (text: string, audioBase64?: string | null, language: 'en' | 'fr' = selectedLanguage) => {
    if (isMuted) return;

    unlockAudioContext();
    setIsPlayingAudio(true);

    if (audioBase64) {
      const audio = playWavBase64(
        audioBase64,
        () => setIsPlayingAudio(false),
        () => setIsPlayingAudio(true)
      );

      // If audio player failed to launch, fallback to SpeechSynthesis
      if (!audio) {
        speakWithBrowserTTS(
          text,
          language,
          () => setIsPlayingAudio(true),
          () => setIsPlayingAudio(false)
        );
      }
    } else {
      speakWithBrowserTTS(
        text,
        language,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false)
      );
    }
  };

  // Stop listening helper
  const stopListening = () => {
    setIsListening(false);
    setInterimTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
  };

  // Start listening to the user's microphone with SpeechRecognition + MediaRecorder fallback
  const startListening = async () => {
    unlockAudioContext();
    stopCurrentPlayback();
    setIsPlayingAudio(false);
    setMicError(null);
    setInterimTranscript('');

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // Method 1: Web Speech API (Instant real-time transcription)
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognitionRef.current = recognition;
        recognition.lang = selectedLanguage === 'fr' ? 'fr-FR' : 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }

          if (interim) {
            setInterimTranscript(interim);
          }

          if (final.trim()) {
            const finalQuery = final.trim();
            stopListening();
            handleSendMessage(finalQuery);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition notice:', e.error);
          if (e.error === 'not-allowed') {
            setMicError('Microphone permission was denied. Please allow microphone access in your browser settings.');
          }
          stopListening();
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition init error, falling back to MediaRecorder:', err);
      }
    }

    // Method 2: MediaRecorder fallback with Gemini speech-to-text
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size > 1000) {
          setInterimTranscript('Processing your speech with Gemini…');
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            try {
              const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64Data,
                  mimeType: 'audio/webm',
                }),
              });
              const data = await res.json();
              if (data.transcript && data.transcript.trim()) {
                handleSendMessage(data.transcript.trim());
              } else {
                setMicError("I couldn't hear your words clearly. Please try speaking again or click one of the suggested questions.");
              }
            } catch (err) {
              setMicError("Speech transcription latency. Please try again.");
            } finally {
              setInterimTranscript('');
            }
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn('Microphone access denied:', err);
      setMicError('Microphone permission required. Please allow microphone permissions or use the text prompt below.');
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Send message to Wonny
  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    unlockAudioContext();
    stopCurrentPlayback();
    setIsPlayingAudio(false);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setInterimTranscript('');
    setMicError(null);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'wonny' ? 'model' : 'user',
        content: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          language: selectedLanguage,
          requestAudio: !isMuted,
        }),
      });

      if (!res.ok) throw new Error('Assistant response error');

      const data = await res.json();
      const replyMessage: Message = {
        id: `wonny-${Date.now()}`,
        sender: 'wonny',
        text: data.text,
        language: selectedLanguage,
        audioBase64: data.audioBase64,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, replyMessage]);

      // Speak aloud immediately!
      speakResponse(data.text, data.audioBase64, selectedLanguage);
    } catch (err: any) {
      console.error('Chat error:', err);
      const fallbackText =
        selectedLanguage === 'fr'
          ? "Je suis Wonny, représentant d'Olivia Fischer. Olivia est diplômée d'un double Master en management et marketing du luxe entre Berlin et Paris, avec une solide expérience chez Kusmi Tea."
          : "I am Wonny, executive assistant representing Olivia Fischer. Olivia is a dual Master's candidate in luxury prestige marketing at ESCE Paris and HWR Berlin, with proven experience at Kusmi Tea Paris.";

      setMessages((prev) => [
        ...prev,
        {
          id: `fallback-${Date.now()}`,
          sender: 'wonny',
          text: fallbackText,
          language: selectedLanguage,
          timestamp: 'Just now',
        },
      ]);
      speakResponse(fallbackText, null, selectedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQuestions =
    selectedLanguage === 'en'
      ? [
          "Present Olivia Fischer's profile and background",
          "Tell me about her work at Kusmi Tea Paris",
          "What makes Olivia unique for luxury brand marketing?",
          "How can I contact Olivia for an interview?",
        ]
      : [
          "Présentez le profil et l'expertise d'Olivia Fischer",
          "Parlez-moi de son expérience chez Kusmi Tea Paris",
          "Quelles sont ses compétences en marketing de prestige ?",
          "Comment contacter Olivia pour un entretien ?",
        ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl h-full bg-[#FAF7F2] border-l border-[#EAE3D6] shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* Header: Wonny Identity & Controls */}
        <div className="px-6 py-4 border-b border-[#EAE3D6] bg-[#F7F3EB]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-[#1F1D1A] flex items-center justify-center text-[#FAF7F2] shadow-sm">
              <span className="font-serif-luxury text-lg font-semibold tracking-wider">W</span>
              {isPlayingAudio && (
                <span className="absolute -inset-1 rounded-full border-2 border-[#A3835B] animate-ping opacity-75" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-luxury text-xl font-semibold tracking-wide text-[#1F1D1A]">
                  Wonny
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#EAE3D6] text-[#6B6155] font-medium tracking-wider">
                  Deep Male Voice
                </span>
              </div>
              <p className="text-xs text-[#7A7063]">
                {selectedLanguage === 'fr' ? 'Voix masculine grave · Accent français' : 'Deep male tone · American accent'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switch */}
            <div className="flex items-center bg-[#EAE3D6]/70 p-0.5 rounded-lg text-xs font-medium text-[#6B6155]">
              <button
                onClick={() => setSelectedLanguage('en')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedLanguage === 'en'
                    ? 'bg-[#FAF7F2] text-[#1F1D1A] shadow-xs'
                    : 'hover:text-[#1F1D1A]'
                }`}
                title="American English"
              >
                EN
              </button>
              <button
                onClick={() => setSelectedLanguage('fr')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedLanguage === 'fr'
                    ? 'bg-[#FAF7F2] text-[#1F1D1A] shadow-xs'
                    : 'hover:text-[#1F1D1A]'
                }`}
                title="French Accent"
              >
                FR
              </button>
            </div>

            {/* Stop / Pause Speaking Button */}
            {isPlayingAudio && (
              <button
                onClick={() => {
                  stopCurrentPlayback();
                  setIsPlayingAudio(false);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#EAE3D6] text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors flex items-center gap-1"
                title="Stop Wonny Speaking"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Pause</span>
              </button>
            )}

            {/* Mute button */}
            <button
              onClick={() => {
                const next = !isMuted;
                setIsMuted(next);
                if (next) {
                  stopCurrentPlayback();
                  setIsPlayingAudio(false);
                }
              }}
              className={`p-2 rounded-lg border border-[#EAE3D6] transition-colors ${
                isMuted
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-[#FAF7F2] text-[#6B6155] hover:text-[#1F1D1A]'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Close button */}
            <button
              onClick={() => {
                stopListening();
                stopCurrentPlayback();
                setIsPlayingAudio(false);
                onClose();
              }}
              className="p-2 rounded-lg border border-[#EAE3D6] bg-[#FAF7F2] text-[#6B6155] hover:text-[#1F1D1A] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Audio Visualizer Banner */}
        <div className="px-6 py-3 border-b border-[#EAE3D6] bg-[#FAF7F2] flex items-center justify-between">
          <div className="flex-1">
            <AudioWaveVisualizer
              isPlaying={isPlayingAudio}
              isListening={isListening}
            />
          </div>
          <div className="pl-4 flex flex-col items-end shrink-0">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-[#8C8070]">
              {isPlayingAudio
                ? 'Wonny is speaking…'
                : isListening
                ? 'Listening to you now…'
                : 'Ready for your voice'}
            </span>
            <span className="text-[10px] text-[#A3998C]">
              {selectedLanguage === 'fr' ? 'Français' : 'English (US)'} · Deep Tone
            </span>
          </div>
        </div>

        {/* Interim Speech Transcription Banner */}
        {isListening && (
          <div className="px-6 py-2.5 bg-amber-50/80 border-b border-amber-200/60 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>
                {interimTranscript
                  ? `Hearing: "${interimTranscript}"`
                  : 'Listening to your voice... Speak clearly into your mic'}
              </span>
            </div>
            <button
              onClick={stopListening}
              className="text-[11px] text-amber-900 font-semibold underline hover:text-amber-950"
            >
              Done speaking
            </button>
          </div>
        )}

        {/* Mic Error Banner */}
        {micError && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{micError}</span>
          </div>
        )}

        {/* Messages Transcript Scroll Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-[#8C8070]">
                <span>{msg.sender === 'wonny' ? 'Wonny' : 'You'}</span>
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>
              <div
                className={`max-w-[88%] rounded-2xl p-4 text-sm leading-relaxed transition-all ${
                  msg.sender === 'user'
                    ? 'bg-[#1F1D1A] text-[#FAF7F2] rounded-tr-xs'
                    : 'bg-[#FFFFFF] border border-[#EAE3D6] text-[#2C2825] shadow-xs rounded-tl-xs'
                }`}
              >
                <p className={msg.sender === 'wonny' ? 'font-serif-luxury text-[15px]' : ''}>
                  {msg.text}
                </p>

                {msg.sender === 'wonny' && (
                  <div className="mt-3 pt-2 border-t border-[#EAE3D6]/60 flex items-center justify-between">
                    <button
                      onClick={() => speakResponse(msg.text, msg.audioBase64, msg.language || selectedLanguage)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#A3835B] hover:text-[#806440] font-medium transition-colors"
                      title="Hear Wonny speak this aloud"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Hear Wonny</span>
                    </button>
                    <span className="text-[10px] text-[#A89E90]">
                      Deep Male · {msg.language === 'fr' ? 'French Accent' : 'American Accent'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="max-w-[80%] rounded-2xl rounded-tl-xs p-4 bg-[#FFFFFF] border border-[#EAE3D6] text-[#7A7063] text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#A3835B] animate-ping" />
                  <span className="font-serif-luxury italic text-[#8C8070]">
                    Wonny is articulating a response…
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Curated Suggested Prompts */}
        <div className="px-6 py-2.5 bg-[#F7F3EB]/70 border-t border-[#EAE3D6]">
          <p className="text-[11px] font-semibold text-[#8C8070] mb-2 uppercase tracking-wider">
            Quick Voice Inquiries (Click to hear Wonny respond)
          </p>
          <div className="flex flex-wrap gap-2">
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="text-xs text-left px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E4DCCF] text-[#4A433A] hover:bg-[#FFFFFF] hover:border-[#A3835B] hover:text-[#1F1D1A] transition-colors disabled:opacity-50 shadow-2xs"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input & Voice Interaction Bar */}
        <div className="p-4 bg-[#FAF7F2] border-t border-[#EAE3D6]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            {/* Live Mic Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
                isListening
                  ? 'bg-rose-600 border-rose-600 text-white shadow-lg animate-pulse ring-4 ring-rose-200'
                  : 'bg-[#1F1D1A] border-[#1F1D1A] text-[#FAF7F2] hover:bg-[#38332E]'
              }`}
              title={isListening ? 'Stop Listening' : 'Click to Speak Aloud to Wonny'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#C5A880]" />}
            </button>

            {/* Text Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  selectedLanguage === 'fr'
                    ? "Parlez au micro ou écrivez à Wonny..."
                    : "Speak with mic or ask Wonny about Olivia..."
                }
                className="w-full pl-4 pr-10 py-3 bg-[#FFFFFF] border border-[#E4DCCF] rounded-xl text-sm text-[#1F1D1A] placeholder-[#9E9485] focus:outline-none focus:border-[#A3835B] focus:ring-1 focus:ring-[#A3835B]"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#6B6155] hover:text-[#1F1D1A] disabled:opacity-30 disabled:hover:text-[#6B6155] transition-colors"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8C8070] px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-rose-500 animate-ping' : isPlayingAudio ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isListening
                ? 'Listening to your microphone...'
                : isPlayingAudio
                ? 'Wonny is speaking aloud'
                : 'Click the black mic to speak'}
            </span>
            <span>Olivia Fischer · ESCE Paris & HWR Berlin</span>
          </div>
        </div>

      </div>
    </div>
  );
};
