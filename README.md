# Homework Buddy

A voice homework tutor for children. Photograph a syllabus or homework page, turn it into flashcards, then practice them out loud with Buddy, a friendly animated avatar that talks back.

## What it does

- **Topics and flashcards.** The left column lists your topics (for example "The cell"). Selecting a topic shows its flashcards under Buddy.
- **New topic.** Scan or upload photos of school material, review the transcribed text, and create a new topic with four fresh flashcards.
- **Practice by voice.** Click the microphone or Buddy to start talking. Picking a flashcard makes Buddy build the session around it: he asks the question, gives hints, never reveals the answer first, and checks the child's reply. "Free chat" lets the child ask anything.
- **Three languages.** English, Spanish and Russian. Buddy speaks only the selected language and flashcards are generated in it, translating the material if needed.
- **Conversation window.** Shows the transcript, plus a text box for typing instead of speaking.
- **Persistence.** Topics are stored in the browser (`localStorage`) per language.

## How Gemma 4 is used

The server calls `gemma-4-26b-a4b-it` through the Gemini API (`generateContent`) in two places, both in `server.js`:

1. **Reading photos (`POST /api/extract`).** The photos are sent as images together with a transcription prompt. Gemma 4's multimodal input reads the pages in reading order, in their original language, keeping exercise numbering and formulas. The text lands in an editable box so the child or parent can fix it before continuing.
2. **Creating flashcards (`POST /api/flashcards`).** The material is sent with a prompt asking for a two-to-four-word topic name and exactly four flashcards for a child, each covering a different key idea. The call uses a JSON response schema (`responseMimeType: application/json` with `responseSchema`), so the reply is structured data that is parsed directly. The server rejects any answer that does not contain exactly four cards. Questions and answers are written in the selected language.

Both calls use `thinkingConfig.thinkingLevel: MINIMAL` to keep latency low for a child waiting on screen.

The live voice conversation is not Gemma. It runs on an ElevenLabs Conversational AI agent, which the server configures with the tutoring prompt and per-language voices at startup.

## Architecture

```
Browser (public/)                     Node server (server.js)
  index.html + app.js  ── fetch ──▶   POST /api/session     signed URL for ElevenLabs agent
  i18n.js, study.js                   POST /api/extract     photos ─▶ Gemma 4 ─▶ text
  ElevenLabs client (voice)           POST /api/flashcards  text   ─▶ Gemma 4 ─▶ topic + 4 cards
                                      static files from public/
```

- No npm dependencies. The server uses only Node built-ins, and the browser loads the ElevenLabs client from the jsdelivr CDN.
- On startup the server patches the ElevenLabs agent with the tutor prompt, language presets and voice overrides.

## Run it

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

Other commands:

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

## Troubleshooting

- **Agent configuration failed in the logs.** The API key and agent ID must belong to the same ElevenLabs account. The three voice IDs in `server.js` (`LANGUAGES`) must also be available to that account; replace them with your own if they are not.
- **Photos or flashcards fail but voice works.** Check `GEMINI_API_KEY` and that it can use `gemma-4-26b-a4b-it`.
- **Buddy never connects.** Check microphone permission and `make logs`.

## Project layout

```
server.js            API routes, Gemma 4 calls, ElevenLabs agent setup, static server
public/index.html    Layout and styles
public/app.js        UI logic, voice session, scanning, avatar animation
public/i18n.js       English, Spanish and Russian texts
public/study.js      Topic storage
docker-compose.yml   Container setup
Makefile             up, down, logs, keys
```
