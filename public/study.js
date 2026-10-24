const KEY = 'topics';

export function loadTopics() {
  try {
    const topics = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(topics) ? topics : [];
  } catch {
    return [];
  }
}

export const saveTopics = (topics) => localStorage.setItem(KEY, JSON.stringify(topics));
