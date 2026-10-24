# Homework Buddy

A voice and text homework tutor for children, powered entirely by ElevenLabs Agents. The agent handles speech recognition, the tutor's replies and speech synthesis; a friendly avatar reacts to idle, connecting, listening, speaking and error states.

## Run

    make up

The first run asks for the ElevenLabs API key and agent ID and writes `.env`. Then open http://localhost:3000.

Requires Docker. To run without Docker: `ELEVENLABS_API_KEY=... ELEVENLABS_AGENT_ID=... node server.js` (serves files from `public/`).

## Agent setup

Create a Conversational Agent in the ElevenLabs dashboard, choose the tutor voice and LLM there, and put the tutor rules in its system prompt: hints instead of final answers, one to three short spoken sentences, no lists or markdown, reply in the child's language, never assume age or grade, steer off-topic chat back to learning, and keep everything child-safe. The agent must be set to private, which is why the server issues a signed URL.

## Environment

- `ELEVENLABS_API_KEY`: ElevenLabs API key, server-side only.
- `ELEVENLABS_AGENT_ID`: ID of the Conversational Agent.
- `PORT`: optional, defaults to 3000.

## Endpoints

- `POST /api/session` returns `{ signed_url }` for opening a conversation with the agent.
