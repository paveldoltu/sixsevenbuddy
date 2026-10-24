import { Conversation } from 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.30.0/+esm';
import { loadTopics, saveTopics } from './study.js';
import { LANGUAGES, applyLanguage, getLanguage, setLanguage, t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const NO_CARD = 'No flashcard is selected.';
const MAX_SIDE = 1600;
const REQUEST_TIMEOUT_MS = 90000;
const turns = [];
const shots = [];
let topics = loadTopics();
let topicId;
let conversation;
let stream;
let card;
let starting = false;
let sessionId = 0;

function setState(state, message = t().status[state]) {
  document.body.dataset.state = state;
  $('status').textContent = message;
}

const visibleTopics = () => topics.filter((topic) => topic.language === getLanguage());
const currentTopic = () => visibleTopics().find((topic) => topic.id === topicId);

function renderChat() {
  $('log').replaceChildren(...turns.map(({ role, text }) => Object.assign(document.createElement('li'), { className: role, textContent: text })));
  $('log').scrollTop = $('log').scrollHeight;
}

function markSelection() {
  const cards = currentTopic()?.cards ?? [];
  [...$('deck').children].forEach((element, index) => element.classList.toggle('picked', cards[index] === card));
  $('flashcard').hidden = !card;
  $('flashcard').textContent = card ? `${t().flashcard}: ${card.question}` : '';
  $('freeChat').classList.toggle('active', !card);
}

const face = (className, text) => Object.assign(document.createElement('span'), { className: `face ${className}`, textContent: text });

function cardButton(item) {
  const flip = Object.assign(document.createElement('span'), { className: 'flip' });
  flip.append(face('cover', '?'), face('front', item.question));
  const element = Object.assign(document.createElement('button'), { className: 'card', onclick: () => selectCard(item) });
  element.append(flip);
  return element;
}

function renderStudy() {
  const items = visibleTopics();
  $('topicList').replaceChildren(
    ...items.map((topic) =>
      Object.assign(document.createElement('button'), {
        className: topic.id === topicId ? 'topic picked' : 'topic',
        textContent: topic.name,
        onclick: () => selectTopic(topic.id),
      }),
    ),
  );
  $('noTopics').hidden = items.length > 0;
  $('deckArea').hidden = !currentTopic();
  $('deck').replaceChildren(...(currentTopic()?.cards ?? []).map(cardButton));
  markSelection();
}

function render() {
  renderChat();
  renderStudy();
}

async function restartConversation() {
  if (!conversation) return;
  await conversation.endSession();
  conversation = undefined;
  await startConversation();
}

function showTopic(id) {
  topicId = id;
  card = undefined;
  renderStudy();
  restartConversation();
}

function selectTopic(id) {
  if (id !== topicId) showTopic(id);
}

function selectCard(item) {
  card = item;
  markSelection();
  restartConversation();
}

function freeChat() {
  card = undefined;
  markSelection();
  restartConversation();
}

function markLanguage() {
  for (const element of $('languages').children) element.setAttribute('aria-pressed', String(element.textContent === getLanguage()));
}

function changeLanguage(id) {
  if (id === getLanguage()) return;
  setLanguage(id);
  topicId = visibleTopics()[0]?.id;
  card = undefined;
  turns.length = 0;
  conversation?.endSession();
  applyLanguage();
  setStudioStatus('');
  setState('idle');
  renderShots();
  markLanguage();
  render();
}

const sessionVariables = (language) =>
  card
    ? { language, opening: t().cardOpening, flashcard: `Question: ${card.question}\nAnswer: ${card.answer}` }
    : { language, opening: t().greeting, flashcard: NO_CARD };

async function startConversation() {
  if (conversation || starting) return;
  starting = true;
  const id = ++sessionId;
  setState('connecting');
  try {
    const language = getLanguage();
    const { signed_url: signedUrl, language_name: languageName, voice_id: voiceId, speed } = await postJson('/api/session', { language });
    conversation = await Conversation.startSession({
      signedUrl,
      dynamicVariables: sessionVariables(languageName),
      overrides: { agent: { language }, tts: { voiceId, speed } },
      onConnect: () => setState('listening'),
      onDisconnect: () => {
        if (id !== sessionId) return;
        conversation = undefined;
        if (document.body.dataset.state !== 'error') setState('idle');
      },
      onModeChange: ({ mode }) => setState(mode),
      onMessage: ({ message, source }) => {
        turns.push({ role: source === 'user' ? 'user' : 'model', text: message });
        renderChat();
      },
      onError: () => setState('error', t().errors.session),
    });
  } catch (error) {
    setState('error', error.name === 'NotAllowedError' ? t().errors.mic : t().errors.connect);
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
  renderChat();
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
        title: t().remove,
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
    return setStudioStatus(t().studio.camera);
  }
  setStudioStatus('');
  $('video').srcObject = stream;
  $('video').hidden = false;
  $('snap').hidden = false;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(response.status);
  return response.json();
}

async function readPhotos() {
  $('read').disabled = true;
  setStudioStatus(t().studio.reading);
  try {
    const { text } = await postJson('/api/extract', { images: shots.map((src) => src.split(',')[1]) });
    $('material').value = [$('material').value.trim(), text].filter(Boolean).join('\n\n');
    shots.length = 0;
    renderShots();
    setStudioStatus('');
  } catch {
    $('read').disabled = false;
    setStudioStatus(t().studio.read);
  }
}

async function createFlashcards() {
  const material = $('material').value.trim();
  if (!material) return;
  $('study').disabled = true;
  setStudioStatus(t().studio.creating);
  try {
    const { topic, cards } = await postJson('/api/flashcards', { material, language: getLanguage() });
    const created = { id: Date.now(), language: getLanguage(), name: topic, cards };
    topics = [created, ...topics];
    saveTopics(topics);
    $('material').value = '';
    shots.length = 0;
    renderShots();
    setStudioStatus('');
    $('studio').close();
    showTopic(created.id);
  } catch {
    setStudioStatus(t().studio.flashcards);
  } finally {
    $('study').disabled = false;
  }
}

$('languages').replaceChildren(
  ...LANGUAGES.map(({ id, name }) =>
    Object.assign(document.createElement('button'), { className: 'language', textContent: id, title: name, onclick: () => changeLanguage(id) }),
  ),
);
$('form').onsubmit = (event) => {
  event.preventDefault();
  ask($('text').value);
};
$('mic').onclick = toggleConversation;
$('avatar').onclick = toggleConversation;
$('newTopic').onclick = () => $('studio').showModal();
$('freeChat').onclick = freeChat;
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

applyLanguage();
setState('idle');
topicId = visibleTopics()[0]?.id;
markLanguage();
render();
animateVoice();
