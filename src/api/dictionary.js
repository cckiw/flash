const API_BASE_URL = 'https://dict.pusicasavo.workers.dev/api/dictionary';
const AUTH_TOKEN_KEY = 'api_auth_token';

// Получить токен авторизации из localStorage
function getAuthToken() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY) || '930091b6-87d0-4b3a-8d0e-00d8c0834a98';
}

// Сохранить токен авторизации
export function setAuthToken(token) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

// Получить словарь с бекенда
export async function getDictionary(dictionaryId) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Токен авторизации не найден');
  }

  try {
    const response = await fetch(`${API_BASE_URL}?id=${dictionaryId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Словарь не найден
      }
      throw new Error(`Ошибка получения словаря: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка получения словаря:', error);
    throw error;
  }
}

// Создать или обновить словарь на бекенде
export async function saveDictionary(dictionaryData) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Токен авторизации не найден');
  }

  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dictionaryData)
    });

    if (!response.ok) {
      throw new Error(`Ошибка сохранения словаря: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка сохранения словаря:', error);
    throw error;
  }
}

// Преобразовать данные из формата бекенда в формат приложения
export function transformBackendToApp(backendData) {
  if (!backendData) return { learned: [], unlearned: [], draft: [] };

  return {
    learned: (backendData.learned || []).map(card => ({
      id: card.id,
      word: card.word,
      translation: card.translation,
      association: card.association || '',
      imageUrl: card.imageUrl || '',
      dictionaryId: backendData.id,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      learnedAt: card.learnedAt || card.updatedAt
    })),
    unlearned: (backendData.unlearned || []).map(card => ({
      id: card.id,
      word: card.word,
      translation: card.translation,
      association: card.association || '',
      imageUrl: card.imageUrl || '',
      dictionaryId: backendData.id,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      activatedAt: card.activatedAt,
      reviewedAt: card.reviewedAt
    })),
    draft: (backendData.draft || []).map(card => ({
      id: card.id,
      word: card.word,
      translation: card.translation || '',
      association: card.association || '',
      imageUrl: card.imageUrl || '',
      dictionaryId: backendData.id,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      isDraft: true
    }))
  };
}

// Преобразовать данные из формата приложения в формат бекенда
export function transformAppToBackend(dictionaryId, language, appData) {
  return {
    id: dictionaryId,
    language: language,
    learned: (appData.learned || []).map(card => ({
      id: card.id,
      word: card.word,
      translation: card.translation,
      association: card.association || '',
      imageUrl: card.imageUrl || '',
      createdAt: card.createdAt,
      updatedAt: card.updatedAt || card.learnedAt || new Date().toISOString()
    })),
    unlearned: (appData.unlearned || []).map(card => ({
      id: card.id,
      word: card.word,
      translation: card.translation,
      association: card.association || '',
      imageUrl: card.imageUrl || '',
      createdAt: card.createdAt,
      updatedAt: card.updatedAt || new Date().toISOString(),
      activatedAt: card.activatedAt || card.createdAt,
      reviewedAt: card.reviewedAt
    })),
    draft: (appData.draft || []).map(card => ({
      id: card.id,
      word: card.word,
      translation: card.translation || '',
      association: card.association || '',
      imageUrl: card.imageUrl || '',
      createdAt: card.createdAt,
      updatedAt: card.updatedAt || card.createdAt
    }))
  };
}

