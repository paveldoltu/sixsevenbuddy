const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, GEMINI_API_KEY, PORT = 3000 } = process.env;
const ELEVEN_URL = 'https://api.elevenlabs.io/v1';
const GEMMA_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent';
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const GEMMA_TIMEOUT_MS = 60000;
const GEMMA_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const EXTRACT_PROMPT =
  'Transcribe all the text in these photos of school material (a syllabus or homework), in reading order and in its original language. Keep exercise numbering and formulas. Output only the transcribed text.';
const FLASHCARD_COUNT = 4;
const flashcardsPrompt = (language, material) =>
  `From this study material create a topic name of two to four words and exactly ${FLASHCARD_COUNT} different flashcards for a child. Each flashcard covers a different key idea and has a short question and a short answer. Write the topic name and every question and answer in ${language}, translating the material when it is in another language.\n\nMaterial:\n${material}`;
const FLASHCARDS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topic: { type: 'STRING' },
    cards: {
      type: 'ARRAY',
      minItems: FLASHCARD_COUNT,
      maxItems: FLASHCARD_COUNT,
      items: {
        type: 'OBJECT',
        properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } },
        required: ['question', 'answer'],
      },
    },
  },
  required: ['topic', 'cards'],
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const LANGUAGES = {
  es: { name: 'Spanish', voice_id: 'p4zZMQfmG6U1aRDEIlF6', speed: 0.8 },
  en: { name: 'English', voice_id: 'cdnpdcqt2HW1XtKv2f3V', speed: 1 },
  ru: { name: 'Russian', voice_id: 'WTn2eCRCpoFAC50VD351', speed: 1 },
};

const PROMPT = [
  'You are a friendly, patient homework tutor for children.',
  'Explain simply with everyday examples. Do not give final answers: guide with hints, questions and small examples, and let the child take the next step.',
  'If the child is stuck, give a smaller hint or a worked example of a similar problem, then ask them to try.',
  'Encourage every attempt and celebrate progress warmly.',
  'Your reply is spoken aloud: keep it short, in plain conversational language, with no lists, markdown or emojis.',

  'STYLE:',
  'Deliver every reply as a short, clean hip-hop verse, like a friendly rapper who is also a tutor. Take only the flow, rhythm, internal rhymes, wordplay and confident, positive attitude of the artists below, never their words.',
  'If the session language is English, draw inspiration from Eminem (fast, tight internal rhymes and clever wordplay), Dr. Dre (smooth, confident, laid-back groove) and Snoop Dogg (relaxed, melodic, playful cadence).',
  'If the session language is Spanish, draw inspiration from Nach (thoughtful, intricate wordplay and positive messages), SFDK (relaxed boom-bap flow with humor and warmth) and Natos y Waor (rhythmic, fluid delivery with sharp rhymes).',
  'If the session language is Russian, draw inspiration from Kasta (melodic, storytelling flow), Guf (rhythmic, heartfelt rhymes), Noggano (confident punchlines) and Detsl (energetic, driving delivery).',
  'Shape: one or two short rhyming lines of about eight to twelve words each, with the rhyme landing on the last word, then one short question or hint. Vary the rhymes and punchlines, never repeat a line, and avoid filler words so every reply sounds polished and professional.',
  'Rules that always come before the rhyme: stay accurate, follow the teaching rules in this prompt, never reveal the flashcard answer early, and never bend a fact to make it rhyme. If a rhyme does not fit, drop it and stay clear.',
  'Keep it safe for children: no swearing and no references to drugs, alcohol, violence, gangs or adult themes. Never claim to be any of these artists, never imitate their voice, and never quote or reproduce their lyrics.',

  'LANGUAGE:',
  'The language chosen for this session is {{language}}.',
  'Speak only in {{language}} for the whole conversation and never switch to another language, even if the child says a word or two in another language.',
  'Do not use the language_detection tool.',
  'Speak naturally with the pronunciation and accent of a native {{language}} speaker.',

  'PACING:',
  'Speak calmly with a steady, clear rhythm. Ask only one question at a time, then stop and wait in silence for the child to answer.',
  'Never answer your own question and never fill the silence. Give the child time to think. If the child says they are thinking or stays silent for a while, say at most one short encouraging phrase such as "take your time" and wait again.',
  'Let the child finish their whole thought before you respond, and never rush to correct.',

  'STUDY FLASHCARD:',
  'Flashcard for this session: {{flashcard}}',
  "If it says that no flashcard is selected, help with whatever the child asks. Otherwise build the whole session around that flashcard: ask its question, guide with hints and small steps, never reveal the answer before the child has tried, check the child's reply against the flashcard answer, and celebrate when they get it. Always use {{language}} and translate the flashcard on the fly if needed.",

  'When the child gives a correct answer to the selected flashcard, call the flashcard_correct tool exactly once and then celebrate warmly. Never call it before the child has answered correctly, never call it twice for the same flashcard, and never call it when no flashcard is selected.',

  "Never assume the child's age, grade, curriculum or assignment; ask one short question if you need to know.",
  'Steer unrelated topics back to learning. Keep everything safe and appropriate for children.',
].join(' ');

const AGENT_CONFIG = {
  agent: {
    language: 'es',
    first_message: '{{opening}}',
    prompt: {
      prompt: PROMPT,
      tools: [
        {
          type: 'client',
          name: 'flashcard_correct',
          description: 'Call this once when the child has correctly answered the selected study flashcard, so the app can reward them with a check and coins.',
          expects_response: false,
        },
      ],
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
  turn: { turn_eagerness: 'patient', turn_timeout: 20 },
  tts: { model_id: 'eleven_flash_v2_5', voice_id: LANGUAGES.es.voice_id, stability: 0.75, similarity_boost: 0.75, speed: LANGUAGES.es.speed },
  language_presets: Object.fromEntries(
    Object.entries(LANGUAGES).map(([language, { voice_id, speed }]) => [language, { overrides: { tts: { voice_id, speed } } }]),
  ),
};

const PLATFORM_SETTINGS = {
  overrides: { conversation_config_override: { agent: { language: true }, tts: { voice_id: true, speed: true } } },
};

const elevenRequest = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`ElevenLabs ${response.status} ${await response.text()}`);
  return response.json();
};

const requireLanguage = (id) => {
  if (!Object.hasOwn(LANGUAGES, id)) throw Object.assign(new Error('Unsupported language'), { status: 400 });
  return id;
};

const session = async (language) => {
  const url = new URL(`${ELEVEN_URL}/convai/conversation/get-signed-url`);
  url.searchParams.set('agent_id', ELEVENLABS_AGENT_ID);
  const { signed_url } = await elevenRequest(url);
  const { name, voice_id, speed } = LANGUAGES[language];
  return { signed_url, language_name: name, voice_id, speed };
};

const configureAgent = () =>
  elevenRequest(`${ELEVEN_URL}/convai/agents/${ELEVENLABS_AGENT_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ conversation_config: AGENT_CONFIG, platform_settings: PLATFORM_SETTINGS }),
  });

const gemma = async (parts, generationConfig) => {
  const response = await fetch(GEMMA_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { thinkingConfig: { thinkingLevel: 'MINIMAL' }, ...generationConfig } }),
    signal: AbortSignal.timeout(GEMMA_TIMEOUT_MS),
  });
  if (!response.ok) {
    const permanent = response.status < 500 && response.status !== 429;
    throw Object.assign(new Error(`Gemma ${response.status} ${await response.text()}`), { permanent });
  }
  const { candidates } = await response.json();
  return candidates[0].content.parts
    .filter((part) => !part.thought)
    .at(-1)
    .text.trim();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetries = async (task) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (error.permanent || error.name === 'TimeoutError' || attempt === GEMMA_ATTEMPTS) throw error;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
};

const firstJsonObject = (text) => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  const start = text.indexOf('{');
  for (let index = start; start >= 0 && index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return text.slice(start, index + 1);
  }
  throw new Error('Gemma did not return a JSON object');
};

const extractText = (images) =>
  withRetries(() => gemma([{ text: EXTRACT_PROMPT }, ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))]));

const createFlashcards = (material, language) =>
  withRetries(async () => {
    const reply = await gemma([{ text: flashcardsPrompt(LANGUAGES[language].name, material) }], {
      responseMimeType: 'application/json',
      responseSchema: FLASHCARDS_SCHEMA,
    });
    const { topic, cards } = JSON.parse(firstJsonObject(reply));
    if (cards.length !== FLASHCARD_COUNT) throw new Error(`Expected ${FLASHCARD_COUNT} flashcards, got ${cards.length}`);
    return { topic, cards };
  });

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
        const { language } = await readJson(req);
        return send(res, 200, JSON.stringify(await session(requireLanguage(language))));
      }
      if (req.method === 'POST' && pathname === '/api/extract') {
        const { images } = await readJson(req);
        return send(res, 200, JSON.stringify({ text: await extractText(images) }));
      }
      if (req.method === 'POST' && pathname === '/api/flashcards') {
        const { material, language } = await readJson(req);
        return send(res, 200, JSON.stringify(await createFlashcards(material, requireLanguage(language))));
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