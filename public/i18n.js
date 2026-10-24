export const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'ru', name: 'Русский' },
];

const KEY = 'language';
const DEFAULT_LANGUAGE = 'es';

const TEXT = {
  en: {
    title: 'Homework Buddy',
    greeting: 'Hi there! I am your homework buddy. What are we learning today?',
    cardOpening: 'Hi there! Let us practice with your study flashcard. Are you ready?',
    status: {
      idle: 'Tap the microphone and ask me anything!',
      connecting: 'Connecting…',
      listening: 'Listening… go ahead, I am ready.',
      speaking: 'Here is my answer!',
    },
    errors: {
      mic: 'Microphone unavailable. Please allow microphone access.',
      connect: 'I could not connect right now. Please try again in a few seconds.',
      session: 'Something went wrong. Please try again.',
    },
    studio: {
      camera: 'Camera unavailable. Please allow camera access.',
      reading: 'Reading your photos…',
      read: 'I could not read the photos. Please try again.',
      creating: 'Creating your flashcards…',
      flashcards: 'I could not create the flashcards. Please try again.',
    },
    flashcard: 'Flashcard',
    wallet: 'Your coins',
    done: 'Done',
    remove: 'Remove',
    conversation: 'Conversation',
    topics: 'Topics',
    newTopic: 'New topic',
    freeChat: 'Free chat',
    noTopics: 'Tap “New topic” and scan your homework to create your first topic.',
    cardsTitle: 'Flashcards of the topic',
    camera: 'Camera',
    snap: 'Take photo',
    upload: 'Upload photos',
    materialPlaceholder: 'Photographed text from your syllabus or homework appears here. You can edit it.',
    read: 'Read photos',
    createFlashcards: 'Create flashcards',
    close: 'Close',
    textPlaceholder: 'Or type your question…',
    send: 'Send',
    micLabel: 'Tap to start or stop talking',
    language: 'Language',
  },
  es: {
    title: 'Homework Buddy',
    greeting: '¡Hola! Soy tu compañero de deberes. ¿Qué estamos aprendiendo hoy?',
    cardOpening: '¡Hola! Vamos a practicar con tu tarjeta de estudio. ¿Estás listo?',
    status: {
      idle: 'Toca el micrófono y pregúntame lo que quieras.',
      connecting: 'Conectando…',
      listening: 'Escuchando… dime, estoy listo.',
      speaking: '¡Aquí va mi respuesta!',
    },
    errors: {
      mic: 'Micrófono no disponible. Permite el acceso al micrófono.',
      connect: 'No pude conectarme ahora. Inténtalo de nuevo en unos segundos.',
      session: 'Algo salió mal. Inténtalo de nuevo.',
    },
    studio: {
      camera: 'Cámara no disponible. Permite el acceso a la cámara.',
      reading: 'Leyendo tus fotos…',
      read: 'No pude leer las fotos. Inténtalo de nuevo.',
      creating: 'Creando tus tarjetas…',
      flashcards: 'No pude crear las tarjetas. Inténtalo de nuevo.',
    },
    flashcard: 'Tarjeta',
    wallet: 'Tus monedas',
    done: 'Completada',
    remove: 'Quitar',
    conversation: 'Conversación',
    topics: 'Temas',
    newTopic: 'Nuevo tema',
    freeChat: 'Chat libre',
    noTopics: 'Toca «Nuevo tema» y escanea tus deberes para crear tu primer tema.',
    cardsTitle: 'Tarjetas del tema',
    camera: 'Cámara',
    snap: 'Tomar foto',
    upload: 'Subir fotos',
    materialPlaceholder: 'El texto de tus fotos del temario o de los deberes aparece aquí. Puedes editarlo.',
    read: 'Leer fotos',
    createFlashcards: 'Crear tarjetas',
    close: 'Cerrar',
    textPlaceholder: 'O escribe tu pregunta…',
    send: 'Enviar',
    micLabel: 'Toca para empezar o dejar de hablar',
    language: 'Idioma',
  },
  ru: {
    title: 'Homework Buddy',
    greeting: 'Привет! Я твой помощник по домашним заданиям. Что мы сегодня изучаем?',
    cardOpening: 'Привет! Давай потренируемся с твоей учебной карточкой. Ты готов?',
    status: {
      idle: 'Нажми на микрофон и спроси меня о чём угодно!',
      connecting: 'Подключаюсь…',
      listening: 'Слушаю… говори, я готов.',
      speaking: 'Вот мой ответ!',
    },
    errors: {
      mic: 'Микрофон недоступен. Разреши доступ к микрофону.',
      connect: 'Сейчас не удалось подключиться. Попробуй ещё раз через несколько секунд.',
      session: 'Что-то пошло не так. Попробуй ещё раз.',
    },
    studio: {
      camera: 'Камера недоступна. Разреши доступ к камере.',
      reading: 'Читаю твои фото…',
      read: 'Не удалось прочитать фото. Попробуй ещё раз.',
      creating: 'Создаю карточки…',
      flashcards: 'Не удалось создать карточки. Попробуй ещё раз.',
    },
    flashcard: 'Карточка',
    wallet: 'Твои монеты',
    done: 'Готово',
    remove: 'Удалить',
    conversation: 'Разговор',
    topics: 'Темы',
    newTopic: 'Новая тема',
    freeChat: 'Свободный чат',
    noTopics: 'Нажми «Новая тема» и отсканируй домашнее задание, чтобы создать первую тему.',
    cardsTitle: 'Карточки темы',
    camera: 'Камера',
    snap: 'Сделать фото',
    upload: 'Загрузить фото',
    materialPlaceholder: 'Здесь появится текст с фото программы или домашнего задания. Его можно редактировать.',
    read: 'Прочитать фото',
    createFlashcards: 'Создать карточки',
    close: 'Закрыть',
    textPlaceholder: 'Или напиши свой вопрос…',
    send: 'Отправить',
    micLabel: 'Нажми, чтобы начать или закончить разговор',
    language: 'Язык',
  },
};

export const getLanguage = () => {
  const saved = localStorage.getItem(KEY);
  return LANGUAGES.some(({ id }) => id === saved) ? saved : DEFAULT_LANGUAGE;
};

export const setLanguage = (id) => localStorage.setItem(KEY, id);

export const t = () => TEXT[getLanguage()];

export function applyLanguage() {
  const text = t();
  document.documentElement.lang = getLanguage();
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = text[element.dataset.i18n];
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = text[element.dataset.i18nPlaceholder];
  for (const element of document.querySelectorAll('[data-i18n-label]')) element.setAttribute('aria-label', text[element.dataset.i18nLabel]);
}
