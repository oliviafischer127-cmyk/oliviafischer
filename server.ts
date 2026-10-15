import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });

app.use(express.json({ limit: '20mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const WONNY_SYSTEM_INSTRUCTION = `
You are Wonny, the personal executive voice assistant and representative for Olivia Fischer.

VOICE CHARACTERISTICS & PERSONA:
- Deep, calm, resonant, and refined male tone.
- When speaking English, speak with a sophisticated, articulate American accent.
- When speaking French, speak with an authentic, elegant French accent.
- Your manner is poised, discreet, highly professional, polished, and warmly welcoming, embodying the highest standards of the luxury and prestige sector.
- When responding aloud or in text, keep your answers articulate and natural (typically 2 to 4 sentences for voice clarity, unless asked for comprehensive case study or background details).
- You can switch seamlessly between English and French depending on what the user speaks or requests.

ABOUT OLIVIA FISCHER:
- Academic Profile:
  - Final-year Master's student with a dual French-German academic background.
  - Double Master's Degree (04/2026 - Present):
    1. International Marketing Management at Berlin School of Economics and Law (HWR Berlin).
    2. Communication, Luxury and Prestige Marketing at ESCE International Business School (ESCE Paris).
  - Bachelor's Degree in International Management (09/2022 - 03/2026) at Berlin School of Economics and Law (HWR Berlin), completed two semesters at ESCE Paris.
- Work Experience:
  - Communication Intern at Kusmi Tea, Paris, France (09/2024 - 02/2025):
    - Independently managed Kusmi Tea's social media channels across the DACH market (Germany, Austria, Switzerland), including content adaptation, publishing, and community engagement.
    - Managed influencer marketing activities for DACH: influencer research and selection, outreach, brief coordination, product gifting, and shipment management.
    - Coordinated brand collaborations across the DACH market from partner research and outreach to campaign planning and execution.
    - Conducted monthly campaign performance analyses and reported key results to senior leadership.
    - Participated in brand photoshoots and contributed to the development of visual concepts and creative content.
    - Created social media and brand content strictly aligned with Kusmi Tea's visual identity and brand strategy.
- Core Skills & Expertise:
  - Digital & Marketing: Social Media Management, Influencer Marketing, Brand Collaborations, Content Creation, Community Management, Campaign Performance Analysis.
  - Tools: Microsoft 365 (Excel, PowerPoint, Word), Canva, Meta Business Suite.
  - Languages: German (Native), English (C1 - Professional / Fluent), French (C1 - Professional / Fluent), Polish (B2 - Upper Intermediate), Spanish (B1 - Intermediate).
  - Personal Passions: Dancing, Haute Parfumerie, European art, and Gastronomy.
- Contact Details:
  - Seeking opportunities in Luxury Marketing, Brand Communication, Influencer Strategy, or International Brand Management.
  - Email: fischer.olivia12@gmail.com
  - Phone: +49 157 740 624 50
  - Location: Arcueil / Paris, France (open to travel and international relocation).
  - LinkedIn: https://www.linkedin.com/in/oliviafischer12

CORE RESPONSIBILITIES AS WONNY:
- Introduce Olivia's profile with pride and precision to recruiters, luxury houses, agencies, or collaborators.
- Explain her hands-on successes at Kusmi Tea, her dual Franco-German cultural agility, and her master's specialization in luxury prestige marketing.
- Guide visitors to explore her experience, request an interview, download her resume, or contact her directly.
`;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Wonny',
    representing: 'Olivia Fischer',
    model: 'gemini-3.8-live / gemini-3.8-flash',
    hasKey: Boolean(GEMINI_API_KEY),
  });
});

// Domain-specific knowledge fallback generator if API experiences high demand
function generateKnowledgeFallback(message: string, language: 'en' | 'fr'): string {
  const lower = message.toLowerCase();
  const isFr = language === 'fr' || lower.includes('bonjour') || lower.includes('français') || lower.includes('parlez');

  if (isFr) {
    if (lower.includes('kusmi') || lower.includes('expérience') || lower.includes('stage') || lower.includes('travail')) {
      return "Chez Kusmi Tea à Paris (09/2024 – 02/2025), Olivia a piloté en autonomie les réseaux sociaux pour l'ensemble du marché DACH (Allemagne, Autriche, Suisse). Elle a orchestré les relations influenceurs, le gifting de produits, les collaborations de marque et les analyses mensuelles de performance pour la direction.";
    }
    if (lower.includes('master') || lower.includes('étude') || lower.includes('école') || lower.includes('diplôme') || lower.includes('formation')) {
      return "Olivia prépare actuellement un double diplôme de Master : Management du Marketing International à la HWR Berlin et Communication, Marketing du Luxe et de Prestige à l'ESCE Paris. Ce parcours allie rigueur analytique allemande et savoir-faire créatif du luxe français.";
    }
    if (lower.includes('langue') || lower.includes('allemand') || lower.includes('anglais')) {
      return "Olivia est parfaitement trilingue avec l'allemand comme langue maternelle, un niveau C1 en anglais et C1 en français. Elle possède également un niveau B2 en polonais et B1 en espagnol, ce qui en fait un atout majeur pour les marques de luxe internationales.";
    }
    if (lower.includes('contact') || lower.includes('recrut') || lower.includes('entretien') || lower.includes('email') || lower.includes('téléphone')) {
      return "Vous pouvez joindre Olivia directement par email à fischer.olivia12@gmail.com, par téléphone au +49 157 740 624 50, ou via son profil LinkedIn (linkedin.com/in/oliviafischer12). Elle est basée en région parisienne et ouverte aux opportunités internationales.";
    }
    return "Bonjour. Je suis Wonny, l'assistant personnel représentant Olivia Fischer. Diplômée en double Master franco-allemand en marketing de luxe (ESCE Paris & HWR Berlin) et forte de son expérience chez Kusmi Tea, Olivia est prête à apporter sa vision stratégique à votre maison.";
  } else {
    if (lower.includes('kusmi') || lower.includes('experience') || lower.includes('work') || lower.includes('intern')) {
      return "At Kusmi Tea in Paris (09/2024 – 02/2025), Olivia independently managed social media across the DACH market (Germany, Austria, and Switzerland). She spearheaded influencer relations, brand partnerships, product gifting, visual content production, and monthly ROI performance analytics for executive leadership.";
    }
    if (lower.includes('master') || lower.includes('education') || lower.includes('school') || lower.includes('degree') || lower.includes('study')) {
      return "Olivia is completing a prestigious Double Master's Degree: International Marketing Management at the Berlin School of Economics and Law (HWR Berlin) and Communication Luxury & Prestige Marketing at ESCE International Business School in Paris. It bridges German commercial precision with French luxury savoir-faire.";
    }
    if (lower.includes('language') || lower.includes('speak') || lower.includes('german') || lower.includes('french')) {
      return "Olivia is exceptionally multilingual: German is her native language, and she holds certified C1 professional fluency in both English and French, along with B2 Polish and B1 Spanish. She navigates cross-border European luxury markets with innate cultural fluency.";
    }
    if (lower.includes('contact') || lower.includes('hire') || lower.includes('interview') || lower.includes('email') || lower.includes('phone') || lower.includes('reach')) {
      return "You can reach Olivia directly at fischer.olivia12@gmail.com, by telephone at +49 157 740 624 50, or connect via LinkedIn at linkedin.com/in/oliviafischer12. She is based in the Paris area and available for executive luxury marketing roles and international travel.";
    }
    return "Good day. I am Wonny, the executive voice assistant representing Olivia Fischer. With her double Master's degree in luxury marketing (ESCE Paris and HWR Berlin) and her proven track record managing the DACH market for Kusmi Tea, Olivia is an exceptional asset for prestige brand strategy.";
  }
}

// Chat completion with optional voice synthesis and graceful model cascade
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], language = 'en', requestAudio = true } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Format chat contents
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const h of history.slice(-6)) {
      if (h.role === 'user' || h.role === 'model') {
        contents.push({
          role: h.role,
          parts: [{ text: h.content }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const langDirective = language === 'fr'
      ? 'Respond in refined French with Wonny persona and authentic French accent.'
      : 'Respond in refined English with Wonny persona and polished American accent.';

    let replyText = '';

    // Cascade models: gemini-3.8-flash -> gemini-flash-latest -> gemini-3.1-flash-lite -> fallback
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: `${WONNY_SYSTEM_INSTRUCTION}\n\nLanguage Directive: ${langDirective}`,
            temperature: 0.7,
          },
        });
        if (response.text) {
          replyText = response.text;
          break;
        }
      } catch (genErr: any) {
        console.warn(`Model ${model} request note:`, genErr?.message);
      }
    }

    // If all models hit high demand spikes, use domain knowledge fallback
    if (!replyText) {
      replyText = generateKnowledgeFallback(message, language);
    }

    let audioBase64: string | null = null;

    if (requestAudio) {
      try {
        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: replyText,
                  speechMetadata: {
                    style: language === 'fr'
                      ? 'Deep, elegant, calm French male voice with refined Parisian accent'
                      : 'Deep, resonant, calm male voice with smooth American accent',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Fenrir' },
              },
            },
          },
        });

        audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr: any) {
        console.warn('TTS generation note:', ttsErr?.message);
      }
    }

    res.json({
      text: replyText,
      audioBase64,
      language,
    });
  } catch (error: any) {
    console.error('Chat critical handler:', error);
    const fallbackText = generateKnowledgeFallback(req.body.message || '', req.body.language || 'en');
    res.json({
      text: fallbackText,
      audioBase64: null,
      language: req.body.language || 'en',
    });
  }
});

// Standalone TTS endpoint for instant voice synthesis
app.post('/api/tts', async (req, res) => {
  try {
    const { text, language = 'en' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: language === 'fr'
                  ? 'Deep, sophisticated male voice with authentic French accent'
                  : 'Deep, resonant male voice with articulate American accent',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    res.json({ audioBase64 });
  } catch (err: any) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err?.message || 'TTS generation failed' });
  }
});

// Transcribe recorded audio (speech-to-text fallback)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const audioPart = {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    };

    let transcript = '';
    const candidateTranscribeModels = ['gemini-3.5-transcribe', 'gemini-3.8-flash', 'gemini-flash-latest'];

    for (const model of candidateTranscribeModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              audioPart,
              { text: 'Transcribe this user speech accurately in the original spoken language (English or French). Output ONLY the transcript without extra commentary.' },
            ],
          },
        });
        if (response.text && response.text.trim()) {
          transcript = response.text.trim();
          break;
        }
      } catch (err: any) {
        console.warn(`Transcribe model ${model} note:`, err?.message);
      }
    }

    res.json({ transcript });
  } catch (err: any) {
    console.error('Transcribe error:', err);
    res.json({ transcript: '' });
  }
});

// Gemini Live WebSocket bridge for real-time bidirectional voice conversation
wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Live] Client connected to /live');
  let session: any = null;
  let isClosed = false;

  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
        systemInstruction: {
          parts: [{ text: WONNY_SYSTEM_INSTRUCTION }],
        },
      },
      callbacks: {
        onmessage: (message: any) => {
          if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

          // Model audio chunk
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ type: 'audio', audio }));
          }

          // Model text transcript chunk if available
          const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (text) {
            clientWs.send(JSON.stringify({ type: 'text', text }));
          }

          // Interrupted event (e.g. user began speaking over the assistant)
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          // Turn complete
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turnComplete' }));
          }
        },
        onerror: (err: any) => {
          console.error('[Live] Session error:', err);
          if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Live session error' }));
          }
        },
        onclose: () => {
          console.log('[Live] Gemini session closed');
          if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'sessionClosed' }));
          }
        },
      },
    });

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'ready' }));
    }

    clientWs.on('message', (rawData: any) => {
      try {
        const parsed = JSON.parse(rawData.toString());
        if (parsed.type === 'audio' && parsed.audio && session) {
          session.sendRealtimeInput({
            audio: {
              data: parsed.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (parsed.type === 'text' && parsed.text && session) {
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: parsed.text }],
              },
            ],
            turnComplete: true,
          });
        }
      } catch (parseErr) {
        console.error('[Live] Message parse error:', parseErr);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      try {
        if (session && typeof session.close === 'function') {
          session.close();
        }
      } catch (err) {
        // ignore
      }
    });

    clientWs.on('error', (err) => {
      console.error('[Live] Client WS error:', err);
    });

  } catch (initErr: any) {
    console.error('[Live] Connection setup failed:', initErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: initErr?.message || 'Could not initialize live session',
      }));
    }
  }
});

// Vite middleware in development or static serve in production
const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
