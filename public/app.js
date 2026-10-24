import { Conversation } from 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.30.0/+esm';

const $ = (id) => document.getElementById(id);
const GREETING = 'Hi there! I am your homework buddy. What are we learning today?';
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
};
const MAX_SIDE = 1600;
const CHIPS = ['Help me with my homework', 'What is a fraction?', 'Why is the sky blue?'];
const turns = [];
const shots = [];
let conversation;
let stream;
let starting = false;

function setState(state, message = STATUS[state]) {
  document.body.dataset.state = state;
  $('status').textContent = message;
}

function render() {
  $('log').replaceChildren(...turns.map(({ role, text }) => Object.assign(document.createElement('li'), { className: role, textContent: text })));
  $('log').scrollTop = $('log').scrollHeight;
  $('subtitle').textContent = turns.findLast((turn) => turn.role === 'model')?.text ?? GREETING;
}

async function startConversation() {
  if (conversation || starting) return;
  starting = true;
  setState('connecting');
  try {
    const { signed_url: signedUrl } = await (await fetch('/api/session', { method: 'POST' })).json();
    conversation = await Conversation.startSession({
      signedUrl,
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

async function readPhotos() {
  $('read').disabled = true;
  setStudioStatus(STUDIO.reading);
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: shots.map((src) => src.split(',')[1]) }),
    });
    if (!response.ok) throw new Error(response.status);
    const { text } = await response.json();
    $('material').value = [$('material').value.trim(), text].filter(Boolean).join('\n\n');
    shots.length = 0;
    renderShots();
    setStudioStatus('');
  } catch {
    $('read').disabled = false;
    setStudioStatus(STUDIO.read);
  }
}

async function study() {
  const material = $('material').value.trim();
  if (!material) return;
  $('studio').close();
  await startConversation();
  conversation?.sendContextualUpdate(
    `The child shared this study material from photos. Use it to guide the session with hints and questions, never final answers:\n${material}`,
  );
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
$('study').onclick = study;
$('clear').onclick = () => {
  turns.length = 0;
  $('material').value = '';
  render();
  conversation?.endSession();
};
render();
