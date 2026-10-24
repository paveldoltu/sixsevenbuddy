import { loadStudy, saveStudy } from './study.js';
import { applyLanguage } from './i18n.js';

const $ = (id) => document.getElementById(id);
applyLanguage();
const { cards = [] } = loadStudy() ?? {};
let selected;

const shuffle = (items) =>
  items
    .map((item) => [Math.random(), item])
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item);

const face = (className, text) => Object.assign(document.createElement('span'), { className: `face ${className}`, textContent: text });

function select(element, card) {
  for (const other of $('deck').children) other.classList.toggle('picked', other === element);
  selected = card;
  $('go').disabled = false;
}

if (!cards.length) location.replace('./');

$('deck').replaceChildren(
  ...shuffle(cards).map((card) => {
    const flip = Object.assign(document.createElement('span'), { className: 'flip' });
    flip.append(face('cover', '?'), face('front', card.question));
    const element = Object.assign(document.createElement('button'), { className: 'card' });
    element.append(flip);
    element.onclick = () => select(element, card);
    return element;
  }),
);

$('go').onclick = () => {
  saveStudy({ cards, card: selected });
  location.href = './';
};
