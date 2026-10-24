# Homework Buddy

A voice homework tutor for children. Photograph a syllabus or homework page, turn it into flashcards, then practice them out loud with Buddy, an animated avatar who guides the child toward the answer, awards a green check and pays out coins when they get it right.

## What it is and who it's for

**For:** school-age children doing homework, and the parents or teachers who want them to practice without handing them the answers. It works in English, Spanish and Russian, and the child can talk or type.

**What it does:**

- **Topics and flashcards.** The left column lists topics (for example "The cell"). Selecting one shows its flashcards under Buddy.
- **New topic.** Scan or upload photos of school material, review the transcribed text, and create a new topic with four fresh flashcards.
- **Practice by voice.** Click the microphone or Buddy to start talking. Picking a flashcard makes Buddy build the session around it. "Free chat" lets the child ask anything.
- **Checks and coins.** When the child answers a flashcard correctly, the agent calls a `flashcard_correct` client tool. The card gets a green check in its top-right corner and the wallet at the top right receives 67 coins with a burst of flying coins.
- **Persistence.** Topics, checks and coins are stored in the browser (`localStorage`).

## How to run it

### Requirements

- Docker with Compose (or Node 20+)
- An [ElevenLabs](https://elevenlabs.io) API key and an empty Conversational AI agent created in the same account
- A [Gemini API](https://aistudio.google.com) key with access to Gemma 4

### With Docker

```bash
make up
```

The first run asks for three values and writes them to `.env`:

```
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
GEMINI_API_KEY=...
```

Then open <http://localhost:3000>.

| Command | Effect |
| --- | --- |
| `make logs` | Follow the server logs |
| `make keys` | Delete `.env` and ask for the keys again |
| `make down` | Stop the app |

After changing keys, run `make down && make up` so the container reloads them.

### Without Docker

```bash
export ELEVENLABS_API_KEY=...
export ELEVENLABS_AGENT_ID=...
export GEMINI_API_KEY=...
node server.js
```

Optionally set `PORT` (default `3000`).

### Using it

1. Allow microphone access when the browser asks. Camera access is only needed to take photos; uploading images works without it. Use `localhost` or HTTPS, since browsers block the microphone elsewhere.
2. Click **New topic**, add photos, press **Read photos**, adjust the text if needed, then press **Create flashcards**.
3. Pick a flashcard, then click the microphone or Buddy and answer out loud.

## How Gemma 4 is used

The server calls `gemma-4-26b-a4b-it` through the Gemini API (`generateContent`) in two places, both in `server.js`:

1. **Reading photos (`POST /api/extract`).** The photos are sent as images with a transcription prompt. Gemma 4's multimodal input reads the pages in reading order, in their original language, keeping exercise numbering and formulas. The text lands in an editable box so it can be fixed before continuing.
2. **Creating flashcards (`POST /api/flashcards`).** The material is sent with a prompt asking for a two-to-four-word topic name and exactly four flashcards for a child, each covering a different key idea. The call uses a JSON response schema (`responseMimeType: application/json` with `responseSchema`), so the reply is structured data that is parsed directly. The server rejects any answer that does not contain exactly four cards. Questions and answers are written in the selected language, translating the material if needed.

Both calls use `thinkingConfig.thinkingLevel: MINIMAL` to keep latency low for a child waiting on screen. The Gemini API sometimes answers with a temporary `500` or `429` error, so the server retries up to three times with a short pause (permanent errors such as an invalid key are not retried). It also reads the first JSON object in the reply, so extra text after the JSON does not break flashcard creation.

The live voice conversation is not Gemma. It runs on an ElevenLabs Conversational AI agent, which the server configures at startup with the tutoring prompt, the per-language voices and the `flashcard_correct` tool.

## What expertise is inside, and where it comes from

Buddy has two kinds of expertise, and they come from different places.

**Teaching method.** It lives in the `PROMPT` constant in `server.js` and was written by the authors of this project. It tells the agent to:

- guide with hints, questions and small worked examples instead of giving final answers;
- ask one question at a time, then wait in silence and never answer its own question;
- check the child's reply against the flashcard answer and celebrate effort and progress;
- answer as a short, clean hip-hop verse inspired by the flow of well-known rappers of each language (English, Spanish and Russian), always staying accurate and never revealing the answer early;
- speak only in the selected language and keep everything child-safe;
- never assume the child's age, grade or curriculum.

These rules follow well-established teaching practices: scaffolding with hints (Wood, Bruner & Ross, 1976), practicing recall with flashcards, known as the testing effect (Roediger & Karpicke, 2006), and giving students time to think before responding (Rowe, 1974). The prompt itself has not been reviewed by teachers or educators.

**Subject knowledge.** There is no built-in curriculum or knowledge base. The content comes from the child's own photographed material, transcribed and turned into flashcards by Gemma 4. During practice, the agent compares the child's answer with the answer stored on the flashcard, and its own general knowledge fills the gaps. Whether an answer counts as correct is decided by the voice agent's language model, so it can occasionally be wrong.

The reward of 67 coins per correct answer is a design choice, not something taken from research.

## The model and its license

| | |
| --- | --- |
| Model | Gemma 4 26B A4B instruction-tuned (`gemma-4-26b-a4b-it`), a multimodal mixture-of-experts model from Google DeepMind |
| Model card | <https://huggingface.co/google/gemma-4-26B-A4B-it> |
| License | Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0> |

Requests are sent to the hosted Gemini API, so Google's API terms also apply to that usage. The voice agent runs on ElevenLabs, under its own terms.

## Troubleshooting

- **Agent configuration failed in the logs.** The API key and agent ID must belong to the same ElevenLabs account. The three voice IDs in `server.js` (`LANGUAGES`) must also be available to that account; replace them with your own if they are not.
- **Photos or flashcards fail but voice works.** Check `GEMINI_API_KEY` and that it can use `gemma-4-26b-a4b-it`.
- **No check or coins after a correct answer.** The agent must have the `flashcard_correct` client tool. The server adds it at startup, so check `make logs` for `agent configuration failed:`. If the agent already has tools attached from the ElevenLabs dashboard, the update can be rejected; remove them there and restart.
- **Buddy never connects.** Check microphone permission and `make logs`.

## Project layout

```
server.js            API routes, Gemma 4 calls, ElevenLabs agent setup, static server
public/index.html    Layout and styles
public/app.js        UI logic, voice session, scanning, rewards, avatar animation
public/i18n.js       English, Spanish and Russian texts
public/study.js      Topic and coin storage
docker-compose.yml   Container setup
Makefile             up, down, logs, keys
```
