import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Play,
  Pause,
  ArrowUpRight,
  Mail,
  Linkedin,
  MapPin,
  Phone,
  Sparkles,
  Award,
  Globe2,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  Languages,
} from 'lucide-react';
import { VoiceAssistantDrawer } from './components/VoiceAssistantDrawer.tsx';
import { AudioWaveVisualizer } from './components/AudioWaveVisualizer.tsx';
import {
  playWavBase64,
  stopCurrentPlayback,
  unlockAudioContext,
  speakWithBrowserTTS,
} from './utils/audio.ts';

const OLIVIA_PORTRAIT = '/src/assets/images/olivia_bewerbungsfoto_1792070967595.jpg';
const KUSMI_CAMPAIGN = '/src/assets/images/kusmi_campaign_1792070052293.jpg';
const PARIS_BERLIN_LUXURY = '/src/assets/images/paris_berlin_luxury_1792070051981.jpg';

export default function App() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [isHeroAudioPlaying, setIsHeroAudioPlaying] = useState(false);
  const [heroAudioObj, setHeroAudioObj] = useState<HTMLAudioElement | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>('en');
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    subject: 'Opportunity in Luxury Marketing',
    message: '',
  });

  const triggerAssistantWithQuestion = (question: string) => {
    setActivePrompt(question);
    setIsAssistantOpen(true);
  };

  const [greetingIndex, setGreetingIndex] = useState(0);

  const playWonnyIntroduction = async () => {
    // If already playing, stop immediately
    if (isHeroAudioPlaying) {
      stopCurrentPlayback();
      setIsHeroAudioPlaying(false);
      return;
    }

    // Unlock browser audio context synchronously inside click handler
    unlockAudioContext();

    const enGreetings = [
      "Welcome. I am Wonny, executive liaison for Olivia Fischer. Olivia brings verified expertise in luxury marketing, having steered social strategy and influencer collaborations for Kusmi Tea Paris, backed by a dual Franco-German Master's degree.",
      "Greetings. Olivia Fischer specializes in prestige brand communication, uniting German commercial precision from HWR Berlin with French luxury savoir-faire from ESCE Paris. She is fluent in German, English, and French.",
      "Hello. As Olivia's executive assistant, I invite you to explore her hands-on campaign successes across the DACH market, her influencer gifting programs, and her strategic readiness for international luxury brand leadership.",
    ];

    const frGreetings = [
      "Bienvenue. Je suis Wonny, représentant exécutif d'Olivia Fischer. Olivia allie rigueur analytique et créativité de prestige, forte de son expérience chez Kusmi Tea Paris et de son double Master franco-allemand.",
      "Bonjour. Olivia Fischer est diplômée de l'ESCE Paris et de la HWR Berlin en marketing du luxe. Elle maîtrise cinq langues et pilote avec passion les stratégies de marque et de relations influenceurs.",
      "Ravi de vous accueillir. N'hésitez pas à me poser vos questions sur les réalisations d'Olivia, ses compétences en gestion de communauté ou pour organiser un entretien direct.",
    ];

    const list = selectedLanguage === 'fr' ? frGreetings : enGreetings;
    const greetingText = list[greetingIndex % list.length];
    setGreetingIndex((prev) => (prev + 1) % list.length);

    setIsHeroAudioPlaying(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: greetingText, language: selectedLanguage }),
      });
      const data = await res.json();

      if (data.audioBase64) {
        const audio = playWavBase64(
          data.audioBase64,
          () => setIsHeroAudioPlaying(false),
          () => setIsHeroAudioPlaying(true)
        );

        if (!audio) {
          // Fallback to browser SpeechSynthesis
          speakWithBrowserTTS(
            greetingText,
            selectedLanguage,
            () => setIsHeroAudioPlaying(true),
            () => setIsHeroAudioPlaying(false)
          );
        }
      } else {
        // Fallback to browser SpeechSynthesis
        speakWithBrowserTTS(
          greetingText,
          selectedLanguage,
          () => setIsHeroAudioPlaying(true),
          () => setIsHeroAudioPlaying(false)
        );
      }
    } catch (err) {
      console.warn('Network TTS note, using speech synthesis:', err);
      speakWithBrowserTTS(
        greetingText,
        selectedLanguage,
        () => setIsHeroAudioPlaying(true),
        () => setIsHeroAudioPlaying(false)
      );
    }
  };

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInquirySent(true);
    setTimeout(() => {
      setInquirySent(false);
      setInquiryForm({
        name: '',
        email: '',
        subject: 'Opportunity in Luxury Marketing',
        message: '',
      });
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1F1D1A] selection:bg-[#E2D5C3] selection:text-[#1F1D1A]">
      
      {/* 1. TOP BAR CONTRACT: Exactly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EAE3D6]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8">
          
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#"
            className="font-serif-luxury text-2xl font-semibold tracking-wide text-[#1F1D1A] whitespace-nowrap shrink-0 hover:opacity-85 transition-opacity"
          >
            Olivia Fischer
          </a>

          {/* Zone 2: 4-5 clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6B6155]">
            <a
              href="#about"
              className="hover:text-[#1F1D1A] transition-colors whitespace-nowrap shrink-0"
            >
              Voice Liaison
            </a>
            <a
              href="#experience"
              className="hover:text-[#1F1D1A] transition-colors whitespace-nowrap shrink-0"
            >
              Kusmi Tea Experience
            </a>
            <a
              href="#education"
              className="hover:text-[#1F1D1A] transition-colors whitespace-nowrap shrink-0"
            >
              Academic Dual Degree
            </a>
            <a
              href="#competencies"
              className="hover:text-[#1F1D1A] transition-colors whitespace-nowrap shrink-0"
            >
              Competencies
            </a>
            <a
              href="#contact"
              className="hover:text-[#1F1D1A] transition-colors whitespace-nowrap shrink-0"
            >
              Direct Inquiries
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsAssistantOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold tracking-wide uppercase text-[#FAF7F2] bg-[#1F1D1A] rounded-xl hover:bg-[#38332E] shadow-xs hover:shadow-sm transition-all whitespace-nowrap shrink-0"
            >
              <Mic className="w-3.5 h-3.5 text-[#C5A880]" />
              <span>Speak with Wonny</span>
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-24">
        
        {/* 2. SPLIT-SCREEN HERO SECTION */}
        <section id="about" className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Typographic Hierarchy */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Unboxed Metadata (Zero-Pill discipline) */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#7A7063]">
              <span>Double Master's Candidate</span>
              <span aria-hidden="true">·</span>
              <span>HWR Berlin & ESCE Paris</span>
              <span aria-hidden="true">·</span>
              <span>Luxury & Prestige Marketing</span>
            </div>

            {/* Headline with text-wrap: balance */}
            <h1 className="font-serif-luxury text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#1F1D1A] leading-[1.12] text-balance">
              International brand strategy, rooted in Franco-German prestige.
            </h1>

            {/* Lead copy */}
            <p className="text-base sm:text-lg text-[#524B42] leading-relaxed max-w-2xl font-light">
              Represented by <strong className="font-medium text-[#1F1D1A]">Wonny</strong>, her dedicated executive voice assistant. Olivia brings verified experience in social media direction, influencer relations, and creative campaigns across the DACH and French luxury markets.
            </p>

            {/* Wonny Voice Persona Preview Card */}
            <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#EAE3D6] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1F1D1A] text-[#FAF7F2] flex items-center justify-center font-serif-luxury text-lg font-medium">
                    W
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1F1D1A] flex items-center gap-2">
                      <span>Wonny Voice Assistant</span>
                      <span className="text-[11px] font-normal text-[#7A7063]">
                        · Deep Male Tone
                      </span>
                    </h3>
                    <p className="text-xs text-[#85786B]">
                      American accent in English · French accent in French
                    </p>
                  </div>
                </div>

                {/* Language switcher */}
                <div className="flex items-center gap-1 p-1 bg-[#F5EFE6] rounded-lg self-start sm:self-auto">
                  <button
                    onClick={() => setSelectedLanguage('en')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      selectedLanguage === 'en'
                        ? 'bg-[#FFFFFF] text-[#1F1D1A] shadow-xs'
                        : 'text-[#6B6155] hover:text-[#1F1D1A]'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setSelectedLanguage('fr')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      selectedLanguage === 'fr'
                        ? 'bg-[#FFFFFF] text-[#1F1D1A] shadow-xs'
                        : 'text-[#6B6155] hover:text-[#1F1D1A]'
                    }`}
                  >
                    Français
                  </button>
                </div>
              </div>

              {/* Live Waveform preview & audio trigger */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#F0EBE1]">
                <div className="flex-1">
                  <AudioWaveVisualizer
                    isPlaying={isHeroAudioPlaying}
                    isListening={false}
                    className="h-10"
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={playWonnyIntroduction}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-[#FAF7F2] border border-[#DED4C5] text-[#2C2825] hover:bg-[#F2ECE1] transition-colors"
                  >
                    {isHeroAudioPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current text-[#A3835B]" />
                        <span>Pause Wonny</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current text-[#A3835B]" />
                        <span>Hear Wonny Speak</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsAssistantOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-[#1F1D1A] text-[#FAF7F2] hover:bg-[#38332E] transition-colors"
                  >
                    <Mic className="w-3.5 h-3.5 text-[#C5A880]" />
                    <span>Converse Aloud</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Inquiry Triggers */}
            <div className="space-y-2 pt-2">
              <span className="text-xs uppercase tracking-wider text-[#8A7E70] font-medium block">
                Direct Inquiries for Wonny
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Tell me about Olivia's work at Kusmi Tea",
                  "Explain her dual Franco-German academic background",
                  "What are her language proficiencies?",
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => triggerAssistantWithQuestion(q)}
                    className="text-xs px-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-[#EAE3D6] text-[#4A433A] hover:border-[#A3835B] hover:text-[#1F1D1A] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>{q}</span>
                    <ArrowUpRight className="w-3 h-3 text-[#A3835B]" />
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Visual Portrait Container */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative w-full max-w-md aspect-4/5 rounded-3xl overflow-hidden bg-[#F2ECE1] border border-[#EAE3D6] shadow-sm">
              <img
                src={OLIVIA_PORTRAIT}
                alt="Olivia Fischer portrait"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top hover:scale-102 transition-transform duration-700 ease-out"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              
              <div className="absolute bottom-6 left-6 right-6 text-white pointer-events-none">
                <span className="text-xs tracking-widest uppercase font-mono text-[#E4DCCF]">
                  Profile · Paris & Berlin
                </span>
                <h2 className="font-serif-luxury text-2xl font-medium mt-1">
                  Olivia Fischer
                </h2>
                <p className="text-xs text-[#FAF7F2]/80 mt-0.5">
                  International Marketing & Prestige Communication
                </p>
              </div>
            </div>

            {/* Discreet caption */}
            <div className="mt-3 flex items-center gap-4 text-xs text-[#8A7E70]">
              <span>Arcueil (Paris Area), France</span>
              <span aria-hidden="true">·</span>
              <span>Open to Relocation & Luxury Travel</span>
            </div>
          </div>

        </section>

        {/* 3. FULL-WIDTH KEY METRICS STRIP (Below Hero Split) */}
        <section className="border-y border-[#EAE3D6] py-10 bg-[#FFFFFF]/60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-y md:divide-y-0 md:divide-x divide-[#EAE3D6]">
            
            <div className="px-4 text-center md:text-left">
              <span className="text-xs font-medium uppercase tracking-wider text-[#8A7E70] block">
                Multilingual Fluency
              </span>
              <p className="font-serif-luxury text-3xl lg:text-4xl font-semibold text-[#1F1D1A] mt-1 tabular-nums">
                5 Languages
              </p>
              <p className="text-xs text-[#6B6155] mt-1">
                German Native · English C1 · French C1
              </p>
            </div>

            <div className="pt-6 md:pt-0 px-4 text-center md:text-left">
              <span className="text-xs font-medium uppercase tracking-wider text-[#8A7E70] block">
                Luxury Brand Experience
              </span>
              <p className="font-serif-luxury text-3xl lg:text-4xl font-semibold text-[#1F1D1A] mt-1">
                Kusmi Tea
              </p>
              <p className="text-xs text-[#6B6155] mt-1">
                DACH Social, Influencers & Gifting
              </p>
            </div>

            <div className="pt-6 md:pt-0 px-4 text-center md:text-left">
              <span className="text-xs font-medium uppercase tracking-wider text-[#8A7E70] block">
                Academic Trajectory
              </span>
              <p className="font-serif-luxury text-3xl lg:text-4xl font-semibold text-[#1F1D1A] mt-1">
                Double Master's
              </p>
              <p className="text-xs text-[#6B6155] mt-1">
                ESCE Paris & HWR Berlin
              </p>
            </div>

            <div className="pt-6 md:pt-0 px-4 text-center md:text-left">
              <span className="text-xs font-medium uppercase tracking-wider text-[#8A7E70] block">
                Professional Availability
              </span>
              <p className="font-serif-luxury text-3xl lg:text-4xl font-semibold text-[#1F1D1A] mt-1">
                2026 Ready
              </p>
              <p className="text-xs text-[#6B6155] mt-1">
                Executive & Brand Strategist roles
              </p>
            </div>

          </div>
        </section>

        {/* 4. WORK EXPERIENCE: KUSMI TEA PARIS */}
        <section id="experience" className="space-y-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#8A7E70] uppercase tracking-wider">
                <span>Work Experience</span>
                <span aria-hidden="true">·</span>
                <span>Paris, France</span>
              </div>
              <h2 className="font-serif-luxury text-3xl sm:text-4xl font-medium text-[#1F1D1A] mt-1">
                Communication at Kusmi Tea
              </h2>
            </div>
            <button
              onClick={() => triggerAssistantWithQuestion("How did Olivia manage Kusmi Tea's DACH social channels and influencer marketing?")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-[#FFFFFF] border border-[#EAE3D6] text-[#2C2825] hover:border-[#A3835B] transition-colors self-start md:self-auto shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A3835B]" />
              <span>Ask Wonny About Kusmi Tea</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Visual Campaign Banner */}
            <div className="lg:col-span-5 rounded-3xl overflow-hidden bg-[#F2ECE1] border border-[#EAE3D6] relative min-h-[320px] lg:min-h-full">
              <img
                src={KUSMI_CAMPAIGN}
                alt="Kusmi Tea luxury campaign aesthetic"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="text-[11px] font-mono tracking-widest uppercase text-[#FAF7F2]/80">
                  Parisian Haute Parfumerie & Tea Culture
                </span>
                <p className="font-serif-luxury text-xl font-medium mt-1">
                  Kusmi Tea · DACH Regional Strategy
                </p>
                <p className="text-xs text-[#FAF7F2]/75 mt-0.5">
                  Germany, Austria & Switzerland Market
                </p>
              </div>
            </div>

            {/* Detailed Accomplishments */}
            <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#EAE3D6] rounded-3xl p-8 space-y-6 shadow-xs flex flex-col justify-between">
              
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EBE1] pb-4">
                  <div>
                    <h3 className="font-serif-luxury text-2xl font-semibold text-[#1F1D1A]">
                      Communication Intern
                    </h3>
                    <p className="text-xs text-[#7A7063]">
                      Kusmi Tea · Paris, France
                    </p>
                  </div>
                  <span className="text-xs font-mono font-medium text-[#8A7E70] px-3 py-1 rounded-lg bg-[#FAF7F2] border border-[#EAE3D6]">
                    09/2024 – 02/2025
                  </span>
                </div>

                <div className="space-y-4 text-sm text-[#474138] leading-relaxed">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#A3835B] shrink-0" />
                    <p>
                      <strong className="font-medium text-[#1F1D1A]">Autonomous Social Media Leadership:</strong> Independently managed Kusmi Tea’s social media channels across the entire DACH market (Germany, Austria, Switzerland), orchestrating content adaptation, publishing schedules, and community management.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#A3835B] shrink-0" />
                    <p>
                      <strong className="font-medium text-[#1F1D1A]">Influencer Relations & Gifting Management:</strong> Managed full-cycle influencer marketing for DACH, including strategic influencer scouting, custom outreach, creative brief coordination, product gifting, and logistic shipment tracking.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#A3835B] shrink-0" />
                    <p>
                      <strong className="font-medium text-[#1F1D1A]">Brand Partnerships & Collaborations:</strong> Coordinated co-branded activations across DACH from initial partner research and outreach to comprehensive campaign planning and execution.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#A3835B] shrink-0" />
                    <p>
                      <strong className="font-medium text-[#1F1D1A]">Monthly Analytics & Executive Reporting:</strong> Conducted monthly campaign performance analyses and synthesized key ROI metrics for marketing leadership.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#A3835B] shrink-0" />
                    <p>
                      <strong className="font-medium text-[#1F1D1A]">Photoshoots & Visual Strategy:</strong> Participated in brand photoshoots and contributed to the conception of visual concepts and creative content strictly aligned with Kusmi Tea’s premium French identity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F0EBE1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#8A7E70]">
                <div className="flex items-center gap-2">
                  <span>Tools Used:</span>
                  <span className="font-medium text-[#2C2825]">Meta Business Suite</span>
                  <span>·</span>
                  <span className="font-medium text-[#2C2825]">Canva</span>
                  <span>·</span>
                  <span className="font-medium text-[#2C2825]">Microsoft 365</span>
                </div>
                <button
                  onClick={() => triggerAssistantWithQuestion("Décrivez en détail les résultats des campagnes Kusmi Tea menées par Olivia")}
                  className="text-[#A3835B] hover:text-[#806440] font-medium transition-colors"
                >
                  Détails en français →
                </button>
              </div>

            </div>

          </div>

        </section>

        {/* 5. ACADEMIC DUAL DEGREE */}
        <section id="education" className="space-y-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#8A7E70] uppercase tracking-wider">
                <span>Academic Trajectory</span>
                <span aria-hidden="true">·</span>
                <span>Berlin & Paris</span>
              </div>
              <h2 className="font-serif-luxury text-3xl sm:text-4xl font-medium text-[#1F1D1A] mt-1">
                Franco-German Double Master's Degree
              </h2>
            </div>
            <button
              onClick={() => triggerAssistantWithQuestion("How does Olivia's double degree between Berlin and Paris prepare her for luxury brand management?")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-[#FFFFFF] border border-[#EAE3D6] text-[#2C2825] hover:border-[#A3835B] transition-colors self-start md:self-auto shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A3835B]" />
              <span>Ask Wonny About Education</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Master's Degree Card */}
            <div className="bg-[#FFFFFF] border border-[#EAE3D6] rounded-3xl p-8 space-y-6 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-mono font-medium text-[#8A7E70]">
                    04/2026 – Present
                  </span>
                  <h3 className="font-serif-luxury text-2xl font-semibold text-[#1F1D1A] mt-1">
                    Double Master's Degree
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B]">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-5 text-sm">
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE3D6] space-y-1">
                  <h4 className="font-medium text-[#1F1D1A]">
                    International Marketing Management
                  </h4>
                  <p className="text-xs text-[#6B6155]">
                    Berlin School of Economics and Law (HWR Berlin) · Germany
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE3D6] space-y-1">
                  <h4 className="font-medium text-[#1F1D1A]">
                    Communication, Luxury and Prestige Marketing
                  </h4>
                  <p className="text-xs text-[#6B6155]">
                    ESCE International Business School (ESCE Paris) · France
                  </p>
                </div>

                <p className="text-xs text-[#6B6155] leading-relaxed pt-2">
                  Specialized curriculum centered on luxury consumer behavior, prestige brand communication, omnichannel storytelling, and international go-to-market execution.
                </p>
              </div>
            </div>

            {/* Bachelor's Degree Card */}
            <div className="bg-[#FFFFFF] border border-[#EAE3D6] rounded-3xl p-8 space-y-6 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-mono font-medium text-[#8A7E70]">
                    09/2022 – 03/2026
                  </span>
                  <h3 className="font-serif-luxury text-2xl font-semibold text-[#1F1D1A] mt-1">
                    Bachelor's Degree in International Management
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B]">
                  <Award className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-5 text-sm">
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE3D6] space-y-1">
                  <h4 className="font-medium text-[#1F1D1A]">
                    Berlin School of Economics and Law (HWR Berlin)
                  </h4>
                  <p className="text-xs text-[#6B6155]">
                    Core foundation in international commerce, economics, and quantitative marketing
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE3D6] space-y-1">
                  <h4 className="font-medium text-[#1F1D1A]">
                    ESCE International Business School (ESCE Paris)
                  </h4>
                  <p className="text-xs text-[#6B6155]">
                    Completed two specialized academic semesters in Paris, France
                  </p>
                </div>

                <p className="text-xs text-[#6B6155] leading-relaxed pt-2">
                  Comprehensive multi-campus international management training bridging German precision and French luxury savoir-faire.
                </p>
              </div>
            </div>

          </div>

        </section>

        {/* 6. COMPETENCIES, LANGUAGES & PASSIONS */}
        <section id="competencies" className="space-y-10">
          
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#8A7E70] uppercase tracking-wider">
              <span>Skills & Talents</span>
              <span aria-hidden="true">·</span>
              <span>Core Strengths</span>
            </div>
            <h2 className="font-serif-luxury text-3xl sm:text-4xl font-medium text-[#1F1D1A] mt-1">
              Skills, Languages & Passions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Digital & Marketing Skills */}
            <div className="bg-[#FFFFFF] border border-[#EAE3D6] rounded-3xl p-7 space-y-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B]">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="font-serif-luxury text-xl font-semibold text-[#1F1D1A]">
                  Digital & Marketing
                </h3>
              </div>
              <ul className="space-y-2.5 text-sm text-[#474138]">
                {[
                  "Social Media Management",
                  "Influencer Marketing & Relations",
                  "Brand Collaborations & Partnerships",
                  "Content Creation & Visual Identity",
                  "Community Management",
                  "Campaign Performance Analysis",
                ].map((skill, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A3835B]" />
                    <span>{skill}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-3 border-t border-[#F0EBE1] text-xs text-[#7A7063]">
                <strong>Key Platforms:</strong> Meta Business Suite, Canva, Microsoft 365 (Excel, PowerPoint, Word)
              </div>
            </div>

            {/* Languages */}
            <div className="bg-[#FFFFFF] border border-[#EAE3D6] rounded-3xl p-7 space-y-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B]">
                  <Languages className="w-4 h-4" />
                </div>
                <h3 className="font-serif-luxury text-xl font-semibold text-[#1F1D1A]">
                  Languages
                </h3>
              </div>
              <div className="space-y-3">
                {[
                  { lang: 'German', level: 'Native Language' },
                  { lang: 'English', level: 'C1 · Professional Fluency' },
                  { lang: 'French', level: 'C1 · Professional Fluency' },
                  { lang: 'Polish', level: 'B2 · Upper Intermediate' },
                  { lang: 'Spanish', level: 'B1 · Intermediate' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-[#F7F3EB] last:border-none">
                    <span className="font-medium text-[#1F1D1A]">{item.lang}</span>
                    <span className="text-xs text-[#7A7063] font-mono">{item.level}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => triggerAssistantWithQuestion("How do Olivia's German, English, and French language skills help in international brand communication?")}
                className="text-xs text-[#A3835B] hover:text-[#806440] font-medium transition-colors"
              >
                Inquire about multilingual scope →
              </button>
            </div>

            {/* Interests & Persona */}
            <div className="bg-[#FFFFFF] border border-[#EAE3D6] rounded-3xl p-7 space-y-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif-luxury text-xl font-semibold text-[#1F1D1A]">
                    Interests & Values
                  </h3>
                </div>
                <div className="mt-4 space-y-3 text-sm text-[#474138]">
                  <p>
                    <strong className="font-medium text-[#1F1D1A]">Dancing:</strong> A lifelong discipline cultivating poise, rhythm, stage presence, and precision—qualities reflected in her creative direction.
                  </p>
                  <p>
                    <strong className="font-medium text-[#1F1D1A]">European Luxury Arts:</strong> Passionate for Haute Parfumerie, sustainable luxury packaging, and contemporary architectural design.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE3D6]">
                <p className="font-serif-luxury italic text-xs text-[#6B6155] leading-relaxed">
                  "Marketing in prestige is the balance of analytical campaign precision with unmistakable sensory elegance."
                </p>
              </div>
            </div>

          </div>

        </section>

        {/* 7. CONTACT & DIRECT INQUIRIES SECTION */}
        <section id="contact" className="border-t border-[#EAE3D6] pt-16 space-y-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Contact Details */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-[#8A7E70] uppercase tracking-wider">
                  <span>Connect with Olivia</span>
                  <span aria-hidden="true">·</span>
                  <span>Direct Communication</span>
                </div>
                <h2 className="font-serif-luxury text-3xl sm:text-4xl font-medium text-[#1F1D1A] mt-1">
                  Initiate a Collaboration
                </h2>
              </div>

              <p className="text-sm text-[#524B42] leading-relaxed">
                Whether you represent a luxury maison, a creative communication agency, or wish to schedule an interview with Olivia Fischer, Wonny and Olivia welcome your inquiry.
              </p>

              <div className="space-y-4 pt-2">
                <a
                  href="mailto:fischer.olivia12@gmail.com"
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#EAE3D6] hover:border-[#A3835B] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B] group-hover:bg-[#1F1D1A] group-hover:text-white transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-[#8A7E70] block">Email Address</span>
                    <span className="text-sm font-medium text-[#1F1D1A]">
                      fischer.olivia12@gmail.com
                    </span>
                  </div>
                </a>

                <a
                  href="https://www.linkedin.com/in/oliviafischer12"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#EAE3D6] hover:border-[#A3835B] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B] group-hover:bg-[#1F1D1A] group-hover:text-white transition-colors">
                    <Linkedin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-[#8A7E70] block">LinkedIn Profile</span>
                    <span className="text-sm font-medium text-[#1F1D1A]">
                      linkedin.com/in/oliviafischer12
                    </span>
                  </div>
                </a>

                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#EAE3D6]">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-[#8A7E70] block">Telephone</span>
                    <span className="text-sm font-medium text-[#1F1D1A]">
                      +49 157 740 624 50
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#EAE3D6]">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3D6] flex items-center justify-center text-[#A3835B]">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-[#8A7E70] block">Location</span>
                    <span className="text-sm font-medium text-[#1F1D1A]">
                      52 Av. Laplace, 94110 Arcueil (Paris Area), France
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Contact Form */}
            <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#EAE3D6] rounded-3xl p-8 shadow-xs">
              <h3 className="font-serif-luxury text-2xl font-semibold text-[#1F1D1A] mb-2">
                Send an Executive Message
              </h3>
              <p className="text-xs text-[#7A7063] mb-6">
                Wonny can relay your dispatch or you may email Olivia directly.
              </p>

              {inquirySent ? (
                <div className="p-8 rounded-2xl bg-[#FAF7F2] border border-[#EAE3D6] text-center space-y-3 animate-in fade-in">
                  <CheckCircle2 className="w-10 h-10 text-[#A3835B] mx-auto" />
                  <h4 className="font-serif-luxury text-xl font-medium text-[#1F1D1A]">
                    Inquiry Relayed
                  </h4>
                  <p className="text-xs text-[#6B6155] max-w-sm mx-auto">
                    Thank you. Wonny has registered your note for Olivia Fischer. You will receive a response promptly at your specified email.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-[#4A433A] block mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={inquiryForm.name}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                        placeholder="e.g. Jean-Luc Moreau"
                        className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E4DCCF] rounded-xl text-sm focus:outline-none focus:border-[#A3835B]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#4A433A] block mb-1">
                        Your Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={inquiryForm.email}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                        placeholder="e.g. jl.moreau@luxurygroup.com"
                        className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E4DCCF] rounded-xl text-sm focus:outline-none focus:border-[#A3835B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#4A433A] block mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={inquiryForm.subject}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E4DCCF] rounded-xl text-sm focus:outline-none focus:border-[#A3835B]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#4A433A] block mb-1">
                      Message
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={inquiryForm.message}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                      placeholder="Please describe your organization, prospective project, or interview timeline..."
                      className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E4DCCF] rounded-xl text-sm focus:outline-none focus:border-[#A3835B]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#8A7E70]">
                      Direct destination: fischer.olivia12@gmail.com
                    </span>
                    <button
                      type="submit"
                      className="px-6 py-2.5 text-xs font-semibold tracking-wide uppercase text-[#FAF7F2] bg-[#1F1D1A] rounded-xl hover:bg-[#38332E] transition-all"
                    >
                      Transmit Dispatch
                    </button>
                  </div>
                </form>
              )}

            </div>

          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="mt-24 border-t border-[#EAE3D6] bg-[#F7F3EB]/60 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#7A7063]">
          <div className="flex items-center gap-2">
            <span className="font-serif-luxury text-base font-semibold text-[#1F1D1A]">
              Olivia Fischer
            </span>
            <span>·</span>
            <span>Wonny Executive Voice Assistant</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Berlin School of Economics and Law</span>
            <span>·</span>
            <span>ESCE International Business School Paris</span>
            <span>·</span>
            <span>Kusmi Tea Alumna</span>
          </div>
        </div>
      </footer>

      {/* Floating Quick Action Button for Wonny */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="group flex items-center gap-3 pl-4 pr-5 py-3.5 rounded-full bg-[#1F1D1A] text-[#FAF7F2] shadow-xl hover:bg-[#38332E] transition-all hover:scale-103"
          title="Open Wonny Voice Assistant"
        >
          <div className="relative w-7 h-7 rounded-full bg-[#A3835B] flex items-center justify-center text-[#1F1D1A]">
            <Mic className="w-4 h-4 fill-current" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-left">
            <span className="text-xs font-serif-luxury font-medium tracking-wide block">
              Speak with Wonny
            </span>
            <span className="text-[10px] text-[#C5A880] block -mt-0.5">
              English & Français
            </span>
          </div>
        </button>
      </div>

      {/* Voice Assistant Modal / Drawer */}
      <VoiceAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        initialPrompt={activePrompt}
        onClearInitialPrompt={() => setActivePrompt(null)}
      />

    </div>
  );
}
