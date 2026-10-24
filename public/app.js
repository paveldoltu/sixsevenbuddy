import { Conversation } from 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.30.0/+esm';
import { clearStudy, loadStudy, saveStudy } from './study.js';

const $ = (id) => document.getElementById(id);
const GREETING = 'Hi there! I am your homework buddy. What are we learning today?';
const OPENING = '¡Hola! Soy tu compañero de deberes. ¿Qué estamos aprendiendo hoy?';
const CARD_OPENING = '¡Hola! Vamos a practicar con tu tarjeta de estudio. ¿Estás listo?';
const NO_CARD = 'No flashcard is selected.';
const STATUS = {
  idle: 'Tap the microphone and ask me anything!',
  connecting: 'Connecting…',
  listening: 'Listening… go ahead, I am ready.',
  speaking: 'Here is my answer!',
};
const ERRORS = {
  mic: 'Microphone unavailable. Please allow microphone access.',
  connect: 'I could not connect right now. Please try again in a few seconds.',
  session: 'Something went wrong. Please try again.',
};
const STUDIO = {
  camera: 'Camera unavailable. Please allow camera access.',
  reading: 'Reading your photos…',
  read: 'I could not read the photos. Please try again.',
  creating: 'Creating your flashcards…',
  flashcards: 'I could not create the flashcards. Please try again.',
};
const MAX_SIDE = 1600;
const CHIPS = ['Help me with my homework', 'What is a fraction?', 'Why is the sky blue?'];
const turns = [];
const shots = [];
let conversation;
let stream;
let card = loadStudy()?.card;
let starting = false;

function setState(state, message = STATUS[state]) {
  document.body.dataset.state = state;
  $('status').textContent = message;
}

function render() {
  $('log').replaceChildren(...turns.map(({ role, text }) => Object.assign(document.createElement('li'), { className: role, textContent: text })));
  $('log').scrollTop = $('log').scrollHeight;
  $('subtitle').textContent = turns.findLast((turn) => turn.role === 'model')?.text ?? GREETING;
  $('flashcard').hidden = !card;
  $('flashcard').textContent = card ? `Flashcard: ${card.question}` : '';
}

const sessionVariables = () =>
  card
    ? { opening: CARD_OPENING, flashcard: `Question: ${card.question}\nAnswer: ${card.answer}` }
    : { opening: OPENING, flashcard: NO_CARD };

async function startConversation() {
  if (conversation || starting) return;
  starting = true;
  setState('connecting');
  try {
    const { signed_url: signedUrl } = await (await fetch('/api/session', { method: 'POST' })).json();
    conversation = await Conversation.startSession({
      signedUrl,
      dynamicVariables: sessionVariables(),
      onConnect: () => setState('listening'),
      onDisconnect: () => {
        conversation = undefined;
        if (document.body.dataset.state !== 'error') setState('idle');
      },
      onModeChange: ({ mode }) => setState(mode),
      onMessage: ({ message, source }) => {
        turns.push({ role: source === 'user' ? 'user' : 'model', text: message });
        render();
      },
      onError: () => setState('error', ERRORS.session),
    });
  } catch (error) {
    setState('error', error.name === 'NotAllowedError' ? ERRORS.mic : ERRORS.connect);
  } finally {
    starting = false;
  }
}

async function ask(text) {
  const message = text.trim();
  if (!message) return;
  await startConversation();
  if (!conversation) return;
  turns.push({ role: 'user', text: message });
  $('text').value = '';
  render();
  conversation.sendUserMessage(message);
}

async function toggleConversation() {
  if (conversation) return conversation.endSession();
  await startConversation();
}

const setStudioStatus = (message) => ($('studioStatus').textContent = message);

function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(width * scale), height: Math.round(height * scale) });
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function renderShots() {
  $('shots').replaceChildren(
    ...shots.map((src, index) =>
      Object.assign(new Image(), {
        src,
        title: 'Remove',
        onclick: () => {
          shots.splice(index, 1);
          renderShots();
        },
      }),
    ),
  );
  $('read').disabled = !shots.length;
}

function addShot(src) {
  shots.push(src);
  renderShots();
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  $('video').srcObject = null;
  $('video').hidden = true;
  $('snap').hidden = true;
}

async function toggleCamera() {
  if (stream) return stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    return setStudioStatus(STUDIO.camera);
  }
  setStudioStatus('');
  $('video').srcObject = stream;
  $('video').hidden = false;
  $('snap').hidden = false;
}

async function postJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(response.status);
  return response.json();
}

async function readPhotos() {
  $('read').disabled = true;
  setStudioStatus(STUDIO.reading);
  try {
    const { text } = await postJson('/api/extract', { images: shots.map((src) => src.split(',')[1]) });
    $('material').value = [$('material').value.trim(), text].filter(Boolean).join('\n\n');
    shots.length = 0;
    renderShots();
    setStudioStatus('');
  } catch {
    $('read').disabled = false;
    setStudioStatus(STUDIO.read);
  }
}

async function createFlashcards() {
  const material = $('material').value.trim();
  if (!material) return;
  $('study').disabled = true;
  setStudioStatus(STUDIO.creating);
  try {
    const { cards } = await postJson('/api/flashcards', { material });
    saveStudy({ cards });
    location.href = 'cards.html';
  } catch {
    $('study').disabled = false;
    setStudioStatus(STUDIO.flashcards);
  }
}

for (const text of CHIPS) {
  $('chips').append(Object.assign(document.createElement('button'), { className: 'chip', textContent: text, onclick: () => ask(text) }));
}
$('form').onsubmit = (event) => {
  event.preventDefault();
  ask($('text').value);
};
$('mic').onclick = toggleConversation;
$('studioOpen').onclick = () => $('studio').showModal();
$('studioClose').onclick = () => $('studio').close();
$('studio').onclose = stopCamera;
$('camera').onclick = toggleCamera;
$('snap').onclick = () => addShot(toJpeg($('video'), $('video').videoWidth, $('video').videoHeight));
$('upload').onchange = async ({ target }) => {
  for (const file of target.files) {
    const bitmap = await createImageBitmap(file);
    addShot(toJpeg(bitmap, bitmap.width, bitmap.height));
  }
  target.value = '';
};
$('read').onclick = readPhotos;
$('study').onclick = createFlashcards;
$('clear').onclick = () => {
  turns.length = 0;
  $('material').value = '';
  clearStudy();
  card = undefined;
  render();
  conversation?.endSession();
};

const mouth = { open: 0, smile: 1 };
const mouthPaths = document.querySelectorAll('.mouth-d');

const lerp = (from, to, amount) => from + (to - from) * amount;

function drawMouth({ open, smile }) {
  const left = 14 + open * 20;
  const right = 423 - open * 20;
  const width = right - left;
  const corner = 34 - 22 * smile + open * 14;
  const upper = corner + 64 * smile;
  const lower = upper + open * 250;
  const jaw = 0.3 - 0.22 * open;
  const teeth = Math.min(1, open * 3) * 46;
  const upperEdge = (y, dy) => `C${left + width * 0.3} ${y + dy} ${right - width * 0.3} ${y + dy} ${right} ${corner + dy}`;
  const shape = `M${left} ${corner}${upperEdge(upper, 0)}C${right - width * jaw} ${lower} ${left + width * jaw} ${lower} ${left} ${corner}Z`;
  const lowerMiddle = 0.25 * corner + 0.75 * lower;
  const flick = -16 * smile;

  for (const path of mouthPaths) path.setAttribute('d', shape);
  $('teethPath').setAttribute('d', `M${left} ${corner}${upperEdge(upper, 0)}L${right} ${corner + teeth}C${right - width * 0.3} ${upper + teeth} ${left + width * 0.3} ${upper + teeth} ${left} ${corner + teeth}Z`);
  $('goldTooth').setAttribute('x', left + width * 0.56);
  Object.entries({ cx: 218, cy: lowerMiddle + 4, rx: width * 0.3, ry: 80 }).forEach(([name, value]) => $('tongue').setAttribute(name, value));
  $('cornerLeft').setAttribute('d', `M${left} ${corner}Q${left - 10} ${corner + flick / 8} ${left - 14} ${corner + flick}`);
  $('cornerRight').setAttribute('d', `M${right} ${corner}Q${right + 10} ${corner + flick / 8} ${right + 14} ${corner + flick}`);
}

const voice = { floor: undefined };

async function readVoiceLevel() {
  const active = conversation;
  if (!active || document.body.dataset.state !== 'speaking') return undefined;
  try {
    return await active.getOutputVolume();
  } catch {
    return undefined;
  }
}

async function animateVoice() {
  const level = await readVoiceLevel();
  let target = 0;
  if (level === undefined) {
    voice.floor = undefined;
  } else {
    voice.floor = voice.floor === undefined || level < voice.floor ? level : lerp(voice.floor, level, 0.01);
    target = Math.min(0.9, Math.max(0, level - voice.floor - 0.02) * 3.2);
  }
  mouth.open = lerp(mouth.open, target, target > mouth.open ? 0.45 : 0.2);
  if (mouth.open < 0.02) mouth.open = 0;
  const smile = document.body.dataset.state === 'error' ? -0.8 : 1 - mouth.open * 0.4;
  mouth.smile = lerp(mouth.smile, smile, 0.2);
  drawMouth(mouth);
  requestAnimationFrame(animateVoice);
}

render();
animateVoice();
