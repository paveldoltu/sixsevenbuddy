const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, GEMINI_API_KEY, PORT = 3000 } = process.env;
const ELEVEN_URL = 'https://api.elevenlabs.io/v1';
const GEMMA_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent';
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const EXTRACT_PROMPT =
  'Transcribe all the text in these photos of school material (a syllabus or homework), in reading order and in its original language. Keep exercise numbering and formulas. Output only the transcribed text.';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const VOICES = { es: 'p4zZMQfmG6U1aRDEIlF6', en: 'cdnpdcqt2HW1XtKv2f3V', ru: 'WTn2eCRCpoFAC50VD351' };
const SPEEDS = { es: 0.8 };

const PROMPT = [
  'You are a friendly, patient homework tutor for children.',
  'Explain simply with everyday examples. Do not give final answers: guide with hints, questions and small examples, and let the child take the next step.',
  'If the child is stuck, give a smaller hint or a worked example of a similar problem, then ask them to try.',
  'Encourage every attempt and celebrate progress warmly.',
  'Your reply is spoken aloud: keep it to one to three short sentences in plain conversational language, with no lists, markdown or emojis.',

  'AUTOMATIC LANGUAGE AND VOICE SWITCHING:',
  'Detect the language the child is speaking in on every turn.',
  'Always reply in the same language the child is currently speaking.',
  'Switch languages automatically as soon as the child switches languages, even in the middle of a conversation.',
  'Never wait for the child to ask you to switch, and never ask for confirmation.',
  'Use the language_detection tool to identify language changes whenever needed.',
  'When the language changes, immediately use the voice configured for that language through the language preset.',
  'When the child speaks English, use the English language preset and English voice. When the child speaks Spanish, use the Spanish language preset and Spanish voice. When the child speaks Russian, use the Russian language preset and Russian voice.',
  'Never keep using the previous language voice after switching languages.',
  'Speak naturally with the pronunciation and accent appropriate to the selected language. In English, sound like a natural English speaker, not a Spanish speaker speaking English.',
  'Continue detecting and responding to language changes throughout the entire conversation.',
  'If the child uses only an occasional word from another language, keep replying in the main language they are speaking.',
  'If the child speaks another language supported by the agent, reply in that language when possible.',

  "Never assume the child's age, grade, curriculum or assignment; ask one short question if you need to know.",
  'Steer unrelated topics back to learning. Keep everything safe and appropriate for children.',
].join(' ');

const AGENT_CONFIG = {
  agent: {
    language: 'es',
    first_message: '¡Hola! Soy tu compañero de deberes. ¿Qué estamos aprendiendo hoy?',
    prompt: {
      prompt: PROMPT,
      built_in_tools: {
        language_detection: {
          type: 'system',
          name: 'language_detection',
          description: '',
          params: { system_tool_type: 'language_detection' },
        },
      },
    },
  },
  tts: { model_id: 'eleven_flash_v2_5', voice_id: VOICES.es, stability: 0.75, similarity_boost: 0.75, speed: SPEEDS.es },
  language_presets: Object.fromEntries(
    Object.entries(VOICES).map(([language, voice_id]) => [language, { overrides: { tts: { voice_id, speed: SPEEDS[language] ?? 1 } } }]),
  ),
};

const elevenRequest = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`ElevenLabs ${response.status} ${await response.text()}`);
  return response.json();
};

const session = () => {
  const url = new URL(`${ELEVEN_URL}/convai/conversation/get-signed-url`);
  url.searchParams.set('agent_id', ELEVENLABS_AGENT_ID);
  return elevenRequest(url);
};

const configureAgent = () =>
  elevenRequest(`${ELEVEN_URL}/convai/agents/${ELEVENLABS_AGENT_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ conversation_config: AGENT_CONFIG }),
  });

const extractText = async (images) => {
  const response = await fetch(GEMMA_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: EXTRACT_PROMPT }, ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))] }],
    }),
  });
  if (!response.ok) throw new Error(`Gemma ${response.status} ${await response.text()}`);
  const { candidates } = await response.json();
  return candidates[0].content.parts
    .filter((part) => !part.thought)
    .map((part) => part.text)
    .join('')
    .trim();
};

const readJson = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks));
};

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
};

http
  .createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (req.method === 'POST' && pathname === '/api/session') {
        return send(res, 200, JSON.stringify(await session()));
      }
      if (req.method === 'POST' && pathname === '/api/extract') {
        const { images } = await readJson(req);
        return send(res, 200, JSON.stringify({ text: await extractText(images) }));
      }
      const file = path.join('public', pathname === '/' ? 'index.html' : pathname);
      send(res, 200, await fs.promises.readFile(file), TYPES[path.extname(file)]);
    } catch (error) {
      const status = error.status ?? (error.code === 'ENOENT' ? 404 : 500);
      if (status === 500) console.error(req.method, req.url, error.message);
      send(res, status, JSON.stringify({ error: error.message }));
    }
  })
  .listen(PORT, () => {
    console.log(`listening on ${PORT}`);
    configureAgent()
      .then(() => console.log('agent configured'))
      .catch((error) => console.error('agent configuration failed:', error.message));
  });