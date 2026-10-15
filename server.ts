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

WHO YOU ARE:
- Your name is Wonny.
- You are Olivia Fischer's personal executive voice assistant and representative.
- You are NOT Olivia. You speak ABOUT Olivia in the third person ("Olivia", "she", "her").
- You speak with a deep, calm, sophisticated male tone.
- When speaking English, you use an articulate American accent.
- When speaking French, you use an authentic, refined French accent.

HOW TO ANSWER QUESTIONS PROPERLY:
1. Always answer the user's specific question directly, contextually, and accurately.
2. If asked about Olivia's work, background, studies, skills, or contact info: Provide the exact, accurate information from her curriculum below.
3. If asked about yourself ("Who are you?", "What is your name?"): Clearly introduce yourself as Wonny, Olivia's executive voice liaison.
4. If asked general or conversational questions ("How are you?", "What can you do?", "What is luxury marketing?"): Respond thoughtfully, warmly, and with executive poise.
5. Match the language: If the user addresses you in French, answer in fluent, polished French. If in English, answer in articulate English.
6. Conciseness: Keep responses around 2 to 4 sentences (40 to 80 words) for optimal vocal delivery.

OLIVIA FISCHER'S VERIFIED CURRICULUM:
- Professional Experience:
  - Communication Intern at Kusmi Tea, Paris, France (09/2024 – 02/2025):
    - Independently managed Kusmi Tea's social media channels across the DACH market (Germany, Austria, Switzerland), including content adaptation, publishing, and community engagement.
    - Managed influencer marketing activities across DACH: influencer research and selection, outreach, brief coordination, product gifting, and shipment management.
    - Coordinated brand collaborations across the DACH market from partner research to campaign execution.
    - Conducted monthly campaign performance analyses and reported key results to senior leadership.
    - Participated in brand photoshoots and contributed to the development of visual concepts and creative content strictly aligned with Kusmi Tea's identity.
- Academic Qualifications:
  - Double Master's Degree (04/2026 – Present):
    1. International Marketing Management at Berlin School of Economics and Law (HWR Berlin).
    2. Communication, Luxury and Prestige Marketing at ESCE International Business School (ESCE Paris).
  - Bachelor's in International Management (09/2022 – 03/2026) at HWR Berlin, with two semesters completed at ESCE Paris.
- Languages: German (Native), English (C1 - Fluent / Professional), French (C1 - Fluent / Professional), Polish (B2), Spanish (B1).
- Core Competencies: Social Media Management, Influencer Marketing, Brand Collaborations, Content Creation, Community Management, Campaign Performance Analysis.
- Tools: Meta Business Suite, Canva, Microsoft 365 (Excel, PowerPoint, Word).
- Personal Interests: Classical & Contemporary Dancing (fostering discipline, presence, and rhythm), Haute Parfumerie, European Gastronomy.
- Contact Details:
  - Email: fischer.olivia12@gmail.com
  - Telephone: +49 157 740 624 50
  - Address: 52 Av. Laplace, 94110 Arcueil (Paris Area), France (available for international relocation & travel).
  - LinkedIn: https://www.linkedin.com/in/oliviafischer12
`;

// Helper to detect French in message
function isFrenchMessage(text: string): boolean {
  const frenchMarkers = [
    'bonjour', 'salut', 'comment', 'pourquoi', 'qui', 'est-ce', 'qu\'est',
    'quelle', 'quel', 'quelles', 'quels', 'parle', 'parlez', 'français',
    'merci', 'stage', 'études', 'diplôme', 'école', 'langue', 'langues',
    'expérience', 'pouvez-vous', 'peux-tu', 'travail', 'compétences', 'présente'
  ];
  const lower = text.toLowerCase();
  return frenchMarkers.some((marker) => lower.includes(marker));
}

// Chat completion with optional voice synthesis and graceful model cascade
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], language = 'en', requestAudio = true } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Determine active language
    const detectedLanguage: 'en' | 'fr' =
      language === 'fr' || isFrenchMessage(message) ? 'fr' : 'en';

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

    const langDirective = detectedLanguage === 'fr'
      ? 'Respond in French with a refined Parisian accent tone. Answer the specific question directly as Wonny representing Olivia Fischer.'
      : 'Respond in English with an articulate American accent tone. Answer the specific question directly as Wonny representing Olivia Fischer.';

    let replyText = '';

    // Prioritize models with active available quota (gemini-3.1-flash-lite & gemini-3.5-flash)
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

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
        if (response.text && response.text.trim()) {
          replyText = response.text.trim();
          break;
        }
      } catch (genErr: any) {
        console.warn(`Model ${model} note:`, genErr?.message || genErr?.status);
      }
    }

    if (!replyText) {
      // Dynamic fallback based on question
      if (detectedLanguage === 'fr') {
        replyText = "Olivia est étudiante en double Master entre la HWR Berlin et l'ESCE Paris en marketing de prestige. Elle a notamment piloté avec succès la communication DACH chez Kusmi Tea. Quel aspect de son parcours souhaitez-vous approfondir ?";
      } else {
        replyText = "Olivia is completing a double Master's degree in luxury marketing at ESCE Paris and HWR Berlin, with proven experience managing the DACH market for Kusmi Tea. How may I provide more details about her specific qualifications?";
      }
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
                    style: detectedLanguage === 'fr'
                      ? 'Deep, elegant, calm French male voice with refined Parisian accent'
                      : 'Deep, resonant, articulate American English male voice with clear US pronunciation',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Charon' },
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
      language: detectedLanguage,
    });
  } catch (error: any) {
    console.error('Chat critical handler:', error);
    const isFr = req.body.language === 'fr' || isFrenchMessage(req.body.message || '');
    const fallbackText = isFr
      ? "Olivia prépare un double diplôme de Master en marketing de prestige entre l'ESCE Paris et la HWR Berlin. Elle a notamment piloté avec succès la communication DACH chez Kusmi Tea."
      : "Olivia is completing a double Master's degree in luxury marketing at ESCE Paris and HWR Berlin, with proven experience at Kusmi Tea Paris.";
    res.json({
      text: fallbackText,
      audioBase64: null,
      language: isFr ? 'fr' : 'en',
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

    const isFr = language === 'fr' || isFrenchMessage(text);

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: isFr
                  ? 'Deep, sophisticated male voice with authentic French accent'
                  : 'Deep, resonant male voice with articulate American English accent',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' },
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
