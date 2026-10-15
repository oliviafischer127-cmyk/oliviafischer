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
You are Wonny, the personal executive voice assistant representing Olivia Fischer.

CONVERSATIONAL INTELLIGENCE & ANTI-REPETITION RULES (CRITICAL):
- NEVER repeat the same greeting or introduction ("Good day, I am Wonny...", "Je suis Wonny...").
- Do NOT re-introduce yourself unless explicitly asked "Who are you?".
- After the initial welcome, jump DIRECTLY to answering the user's specific question.
- Keep each voice response natural, fresh, articulate, and concise (typically 2 to 3 sentences, ~30 to 60 words) so it sounds like an effortless executive conversation, not a robotic script.
- Vary your openings, vocabulary, and phrasing. Never use repetitive formulaic templates.
- If asked a follow-up, answer contextually based on the chat history without repeating prior facts.
- Answer in English with an articulate American accent, or in French with a refined French accent, depending on the language used.

DETAILED BACKGROUND OF OLIVIA FISCHER:
- Academic Profile:
  - Final-year Master's candidate with a Franco-German trajectory.
  - Double Master's Degree (04/2026 – Present):
    1. International Marketing Management at Berlin School of Economics and Law (HWR Berlin).
    2. Communication, Luxury and Prestige Marketing at ESCE International Business School (ESCE Paris).
  - Bachelor's in International Management (09/2022 – 03/2026) at HWR Berlin, with two semesters at ESCE Paris.
- Professional Experience:
  - Communication Intern at Kusmi Tea, Paris (09/2024 – 02/2025):
    - Autonomously drove social media across the DACH region (Germany, Austria, Switzerland).
    - Led influencer marketing, gifting campaigns, and cross-brand collaborations.
    - Reported monthly analytics, ROI metrics, and social growth to executive leadership.
    - Contributed to brand photoshoots and visual creative direction adhering to Parisian luxury tea aesthetics.
- Languages: German (Native), English (C1 - Fluent), French (C1 - Fluent), Polish (B2), Spanish (B1).
- Key Competencies: Social Media Management, Influencer Outreach & Gifting, Campaign Analytics, Brand Partnerships, Visual Identity, Meta Business Suite, Canva, Microsoft 365.
- Interests: Classical & Contemporary Dancing (brings discipline and aesthetic grace), Haute Parfumerie, Gastronomy.
- Contact: fischer.olivia12@gmail.com, +49 157 740 624 50, LinkedIn: linkedin.com/in/oliviafischer12, Arcueil/Paris (open to global luxury travel/relocation).
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

// Domain-specific dynamic fallback generator if all APIs are temporarily offline
function generateKnowledgeFallback(message: string, language: 'en' | 'fr'): string {
  const lower = message.toLowerCase();
  const isFr = language === 'fr' || lower.includes('bonjour') || lower.includes('français') || lower.includes('parlez');

  if (isFr) {
    if (lower.includes('kusmi') || lower.includes('expérience') || lower.includes('stage') || lower.includes('travail')) {
      return "Chez Kusmi Tea à Paris, Olivia a managé en autonomie les réseaux sociaux pour l'Allemagne, l'Autriche et la Suisse. Elle a orchestré les relations influenceurs, le gifting de produits, les collaborations de marque et les analyses mensuelles de performance.";
    }
    if (lower.includes('master') || lower.includes('étude') || lower.includes('école') || lower.includes('diplôme') || lower.includes('formation')) {
      return "Olivia prépare un double diplôme de Master : Management du Marketing International à la HWR Berlin et Communication, Marketing du Luxe et de Prestige à l'ESCE Paris, conjuguant rigueur commerciale allemande et créativité française.";
    }
    if (lower.includes('langue') || lower.includes('allemand') || lower.includes('anglais')) {
      return "Olivia maîtrise 5 langues : l'allemand en langue maternelle, l'anglais et le français au niveau professionnel C1, ainsi que le polonais (B2) et l'espagnol (B1).";
    }
    if (lower.includes('contact') || lower.includes('recrut') || lower.includes('entretien') || lower.includes('email') || lower.includes('téléphone')) {
      return "Vous pouvez contacter Olivia directement par email à fischer.olivia12@gmail.com ou par téléphone au +49 157 740 624 50. Elle est joignable également via LinkedIn.";
    }
    return "Olivia se spécialise dans le marketing et la communication de prestige. Que souhaitez-vous approfondir concernant ses compétences ou ses réalisations ?";
  } else {
    if (lower.includes('kusmi') || lower.includes('experience') || lower.includes('work') || lower.includes('intern')) {
      return "At Kusmi Tea in Paris, Olivia drove social channels for the DACH region, managed high-impact influencer gifting, steered co-branded partnerships, and presented monthly ROI reports to leadership.";
    }
    if (lower.includes('master') || lower.includes('education') || lower.includes('school') || lower.includes('degree') || lower.includes('study')) {
      return "Olivia is completing a Double Master's Degree between HWR Berlin (International Marketing Management) and ESCE Paris (Communication, Luxury & Prestige Marketing), uniting German analytical structure with French luxury craftsmanship.";
    }
    if (lower.includes('language') || lower.includes('speak') || lower.includes('german') || lower.includes('french')) {
      return "Olivia speaks 5 languages: German natively, English and French with C1 professional fluency, alongside B2 Polish and B1 Spanish.";
    }
    if (lower.includes('contact') || lower.includes('hire') || lower.includes('interview') || lower.includes('email') || lower.includes('phone') || lower.includes('reach')) {
      return "You can reach Olivia directly at fischer.olivia12@gmail.com or by phone at +49 157 740 624 50. She is based in the Paris area and open to global opportunities.";
    }
    return "Olivia specializes in international luxury marketing and prestige brand communication. What specific facet of her background would you like to explore?";
  }
}

// Chat completion with optional voice synthesis and graceful model cascade
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], language = 'en', requestAudio = true } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Filter history so turns strictly alternate and the first turn is ALWAYS a 'user' turn
    const validHistory: Array<{ role: 'user' | 'model'; content: string }> = [];
    for (const h of history.slice(-6)) {
      if ((h.role === 'user' || h.role === 'model') && h.content && h.content.trim()) {
        validHistory.push({ role: h.role, content: h.content.trim() });
      }
    }

    // Gemini API requires the first turn to be 'user'
    while (validHistory.length > 0 && validHistory[0].role === 'model') {
      validHistory.shift();
    }

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const h of validHistory) {
      contents.push({
        role: h.role,
        parts: [{ text: h.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }],
    });

    const langDirective = language === 'fr'
      ? 'Answer naturally in French with an authentic Parisian accent tone. Answer directly without repeating your name or greetings.'
      : 'Answer naturally in English with an articulate American accent tone. Answer directly without repeating your name or greetings.';

    let replyText = '';

    // Fast, responsive, reliable models first
    const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: `${WONNY_SYSTEM_INSTRUCTION}\n\n${langDirective}`,
            temperature: 0.8,
          },
        });
        if (response.text && response.text.trim()) {
          replyText = response.text.trim();
          break;
        }
      } catch (genErr: any) {
        console.warn(`Model ${model} request notice:`, genErr?.message);
      }
    }

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
