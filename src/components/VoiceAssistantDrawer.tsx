import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  Send,
  X,
  Globe,
  Radio,
  ChevronDown,
} from 'lucide-react';
import { AudioWaveVisualizer } from './AudioWaveVisualizer.tsx';
import { playWavBase64, LiveAudioPlayer, floatTo16BitPCM } from '../utils/audio.ts';

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
      text: "Good day. I am Wonny, personal executive representative for Olivia Fischer. Whether you wish to explore her luxury brand marketing at Kusmi Tea Paris, her Franco-German academic credentials, or schedule an interview, I am at your disposal in both English and French.",
      language: 'en',
      timestamp: 'Just now',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'ready' | 'connecting' | 'idle'>('idle');

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const livePlayerRef = useRef<LiveAudioPlayer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize live audio player
  useEffect(() => {
    livePlayerRef.current = new LiveAudioPlayer();
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle triggered initial prompt from page
  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendMessage(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt, isOpen]);

  // Handle Live WebSocket audio streaming
  const startLiveConversation = async () => {
    try {
      setIsLiveListening(true);
      setConnectionStatus('connecting');

      // 1. Connect WebSocket to /live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('ready');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'audio' && data.audio) {
            setIsPlayingAudio(true);
            if (!isMuted && livePlayerRef.current) {
              livePlayerRef.current.playChunk(data.audio);
            }
          } else if (data.type === 'text' && data.text) {
            // Append or update text from live stream
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.sender === 'wonny' && last.id.startsWith('live-')) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + data.text },
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: `live-${Date.now()}`,
                    sender: 'wonny',
                    text: data.text,
                    language: selectedLanguage,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ];
              }
            });
          } else if (data.type === 'turnComplete') {
            setIsPlayingAudio(false);
          } else if (data.type === 'interrupted') {
            setIsPlayingAudio(false);
            if (livePlayerRef.current) {
              livePlayerRef.current.stop();
            }
          }
        } catch (e) {
          console.error('Error handling live message:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('Live WebSocket error, using standard fallback:', err);
      };

      ws.onclose = () => {
        setIsLiveListening(false);
        setConnectionStatus('idle');
      };

      // 2. Start microphone capture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBase64 = floatTo16BitPCM(inputData);
          ws.send(JSON.stringify({ type: 'audio', audio: pcmBase64 }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err: any) {
      console.warn('Microphone access or live connection error:', err);
      setIsLiveListening(false);
      setConnectionStatus('idle');
      // Graceful notification
      setMessages((prev) => [
        ...prev,
        {
          id: `notice-${Date.now()}`,
          sender: 'wonny',
          text: "I am ready to speak with you. If microphone permissions are restricted in your browser, feel free to use the suggested prompts or text input below to converse aloud.",
          language: selectedLanguage,
          timestamp: 'Just now',
        },
      ]);
    }
  };

  const stopLiveConversation = () => {
    setIsLiveListening(false);
    setConnectionStatus('idle');

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (livePlayerRef.current) {
      livePlayerRef.current.stop();
    }
    setIsPlayingAudio(false);
  };

  const toggleLiveVoice = () => {
    if (isLiveListening) {
      stopLiveConversation();
    } else {
      startLiveConversation();
    }
  };

  // Play audio response using base64 WAV
  const playMessageAudio = (audioBase64?: string | null, text?: string) => {
    if (isMuted) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (audioBase64) {
      setIsPlayingAudio(true);
      currentAudioRef.current = playWavBase64(audioBase64, () => {
        setIsPlayingAudio(false);
      });
      return;
    }

    // If audio was not cached, generate on the fly via /api/tts
    if (text) {
      setIsPlayingAudio(true);
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: selectedLanguage }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.audioBase64) {
            currentAudioRef.current = playWavBase64(data.audioBase64, () => {
              setIsPlayingAudio(false);
            });
          } else {
            setIsPlayingAudio(false);
          }
        })
        .catch(() => {
          setIsPlayingAudio(false);
        });
    }
  };

  // Send message to Wonny
  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
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

      if (!res.ok) throw new Error('Failed to reach assistant server');

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

      if (data.audioBase64 && !isMuted) {
        playMessageAudio(data.audioBase64);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'wonny',
          text: "I apologize, my executive audio connection encountered a brief latency. Please ask again or select one of the curated inquiries.",
          language: selectedLanguage,
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQuestions = selectedLanguage === 'en'
    ? [
        "Present Olivia Fischer's profile and background",
        "Tell me about her work at Kusmi Tea Paris",
        "What are her key skills in luxury marketing?",
        "How can I contact Olivia for an interview?",
      ]
    : [
        "Présentez le profil et l'expertise d'Olivia Fischer",
        "Parlez-moi de son expérience chez Kusmi Tea Paris",
        "Quelles sont ses compétences en marketing de luxe ?",
        "Comment contacter Olivia pour un entretien ?",
      ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl h-full bg-[#FAF7F2] border-l border-[#EAE3D6] shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* Header: Wonny Identity & Controls */}
        <div className="px-6 py-4 border-b border-[#EAE3D6] bg-[#F7F3EB]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-[#1F1D1A] flex items-center justify-center text-[#FAF7F2] shadow-sm">
              <span className="font-serif-luxury text-lg font-semibold tracking-wider">W</span>
              {isPlayingAudio && (
                <span className="absolute -inset-1 rounded-full border border-[#A3835B] animate-ping opacity-75" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-luxury text-xl font-semibold tracking-wide text-[#1F1D1A]">
                  Wonny
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#EAE3D6] text-[#6B6155] font-medium tracking-wider">
                  Deep Male Tone
                </span>
              </div>
              <p className="text-xs text-[#7A7063]">
                Executive Voice Liaison for Olivia Fischer
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
                EN (US)
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

            {/* Mute button */}
            <button
              onClick={() => {
                const next = !isMuted;
                setIsMuted(next);
                if (next && currentAudioRef.current) {
                  currentAudioRef.current.pause();
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
                stopLiveConversation();
                onClose();
              }}
              className="p-2 rounded-lg border border-[#EAE3D6] bg-[#FAF7F2] text-[#6B6155] hover:text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors"
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
              isListening={isLiveListening}
            />
          </div>
          <div className="pl-4 flex flex-col items-end shrink-0">
            <span className="text-[11px] font-medium tracking-wide uppercase text-[#8C8070]">
              {isPlayingAudio
                ? 'Wonny is speaking…'
                : isLiveListening
                ? 'Listening to your voice…'
                : 'Awaiting your question'}
            </span>
            <span className="text-[10px] text-[#A3998C]">
              Gemini 3.8 Live & Speech
            </span>
          </div>
        </div>

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
                      onClick={() => playMessageAudio(msg.audioBase64, msg.text)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#A3835B] hover:text-[#806440] font-medium transition-colors"
                      title="Listen to Wonny speak this"
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
                    Wonny is reflecting on Olivia's portfolio…
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Curated Suggested Prompts */}
        <div className="px-6 py-2 bg-[#F7F3EB]/60 border-t border-[#EAE3D6]">
          <p className="text-[11px] font-medium text-[#8C8070] mb-2 uppercase tracking-wider">
            Curated Executive Inquiries
          </p>
          <div className="flex flex-wrap gap-2">
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="text-xs text-left px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E4DCCF] text-[#4A433A] hover:bg-[#FFFFFF] hover:border-[#A3835B] hover:text-[#1F1D1A] transition-colors disabled:opacity-50"
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
              onClick={toggleLiveVoice}
              className={`p-3 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
                isLiveListening
                  ? 'bg-rose-600 border-rose-600 text-white shadow-md animate-pulse'
                  : 'bg-[#1F1D1A] border-[#1F1D1A] text-[#FAF7F2] hover:bg-[#38332E]'
              }`}
              title={isLiveListening ? 'Stop Live Voice Stream' : 'Start Live Voice Conversation with Wonny'}
            >
              {isLiveListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  selectedLanguage === 'fr'
                    ? "Posez votre question à Wonny..."
                    : "Ask Wonny about Olivia's experience, skills, or studies..."
                }
                className="w-full pl-4 pr-10 py-3 bg-[#FFFFFF] border border-[#E4DCCF] rounded-xl text-sm text-[#1F1D1A] placeholder-[#9E9485] focus:outline-none focus:border-[#A3835B] focus:ring-1 focus:ring-[#A3835B]"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#6B6155] hover:text-[#1F1D1A] disabled:opacity-30 disabled:hover:text-[#6B6155] transition-colors"
                title="Send Inquiry"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-2 flex items-center justify-between text-[11px] text-[#8C8070] px-1">
            <span className="flex items-center gap-1">
              <Radio className={`w-3 h-3 ${isLiveListening ? 'text-rose-500 animate-pulse' : 'text-[#A3835B]'}`} />
              {isLiveListening ? 'Live WebSocket active' : 'Click mic for live conversation or type above'}
            </span>
            <span>Olivia Fischer · ESCE Paris & HWR Berlin</span>
          </div>
        </div>

      </div>
    </div>
  );
};
