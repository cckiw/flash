import { writable } from 'svelte/store';
import { saveDictionary, getDictionary, transformBackendToApp, transformAppToBackend } from '../api/dictionary.js';

const STORAGE_KEY = 'flash-cards-data';

// Счетчики изменений для синхронизации с бекендом
const changeCounters = new Map(); // dictionaryId -> количество изменений
const syncTimeouts = new Map(); // dictionaryId -> timeout
const SYNC_DELAY = 5000; // 5 секунд задержки для отправки оставшихся изменений
const SYNC_THRESHOLD = 5; // Отправлять каждые 5 изменений

// Функция синхронизации словаря с бекендом
async function syncDictionaryToBackend(dictionaryId, language, state) {
  try {
    const dictCards = {
      learned: state.learned.filter(c => (c.dictionaryId || 'default') === dictionaryId),
      unlearned: state.unlearned.filter(c => (c.dictionaryId || 'default') === dictionaryId),
      draft: (state.draft || []).filter(c => (c.dictionaryId || 'default') === dictionaryId)
    };

    const backendData = transformAppToBackend(dictionaryId, language, dictCards);
    await saveDictionary(backendData);
    
    // Сбрасываем счетчик после успешной синхронизации
    changeCounters.set(dictionaryId, 0);
  } catch (error) {
    console.error('Ошибка синхронизации словаря:', error);
    // Не выбрасываем ошибку, чтобы не блокировать работу приложения
  }
}

// Планирование синхронизации с накоплением изменений
function scheduleSync(dictionaryId, language, state, changeCount = 1) {
  // Увеличиваем счетчик изменений для этого словаря
  const currentCount = changeCounters.get(dictionaryId) || 0;
  const newCount = currentCount + changeCount;
  changeCounters.set(dictionaryId, newCount);

  // Если накопилось 5 или больше изменений, отправляем сразу
  if (newCount >= SYNC_THRESHOLD) {
    // Очищаем таймер, если он был установлен
    if (syncTimeouts.has(dictionaryId)) {
      clearTimeout(syncTimeouts.get(dictionaryId));
      syncTimeouts.delete(dictionaryId);
    }
    
    // Отправляем синхронизацию немедленно
    syncDictionaryToBackend(dictionaryId, language, state);
    return;
  }

  // Если изменений меньше 5, устанавливаем таймер для отправки через SYNC_DELAY
  // Очищаем предыдущий таймер для этого словаря
  if (syncTimeouts.has(dictionaryId)) {
    clearTimeout(syncTimeouts.get(dictionaryId));
  }

  // Устанавливаем новый таймер
  const timeout = setTimeout(() => {
    syncDictionaryToBackend(dictionaryId, language, state);
    syncTimeouts.delete(dictionaryId);
  }, SYNC_DELAY);

  syncTimeouts.set(dictionaryId, timeout);
}

function createCardsStore() {
  const stored = typeof localStorage !== 'undefined' 
    ? localStorage.getItem(STORAGE_KEY) 
    : null;
  
  const initial = stored ? JSON.parse(stored) : {
    learned: [],
    unlearned: [],
    draft: []
  };

  // Миграция старых данных: перенести cards в unlearned
  if (initial.cards && initial.cards.length > 0) {
    initial.unlearned = [...initial.unlearned, ...initial.cards];
    delete initial.cards;
  }

  // Миграция: добавить draft если его нет
  if (!initial.draft) {
    initial.draft = [];
  }

  // Миграция: добавить dictionaryId к старым карточкам
  const addDictionaryIdToCards = (list) => {
    return list.map(card => ({
      ...card,
      dictionaryId: card.dictionaryId || 'default'
    }));
  };
  
  initial.learned = addDictionaryIdToCards(initial.learned);
  initial.unlearned = addDictionaryIdToCards(initial.unlearned);
  initial.draft = addDictionaryIdToCards(initial.draft);

  // Очистка дубликатов ID
  const seenIds = new Set();
  const cleanupDuplicates = (list) => {
    return list.filter(card => {
      if (seenIds.has(card.id)) {
        return false;
      }
      seenIds.add(card.id);
      return true;
    });
  };
  
  initial.learned = cleanupDuplicates(initial.learned);
  initial.unlearned = cleanupDuplicates(initial.unlearned);
  initial.draft = cleanupDuplicates(initial.draft);
  
  // Сохраняем обновленные данные с dictionaryId
  if (typeof localStorage !== 'undefined' && stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  }

  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    set,
    update,
    // Загрузить словарь с бекенда
    loadDictionaryFromBackend: async (dictionaryId, language) => {
      try {
        const backendData = await getDictionary(dictionaryId);
        if (backendData) {
          const appData = transformBackendToApp(backendData);
          update(state => {
            // Удаляем старые карточки этого словаря
            const filteredState = {
              learned: state.learned.filter(c => (c.dictionaryId || 'default') !== dictionaryId),
              unlearned: state.unlearned.filter(c => (c.dictionaryId || 'default') !== dictionaryId),
              draft: state.draft.filter(c => (c.dictionaryId || 'default') !== dictionaryId)
            };
            
            // Добавляем новые карточки
            const newState = {
              learned: [...filteredState.learned, ...appData.learned],
              unlearned: [...filteredState.unlearned, ...appData.unlearned],
              draft: [...filteredState.draft, ...appData.draft]
            };
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            return newState;
          });
        }
      } catch (error) {
        console.error('Ошибка загрузки словаря:', error);
        throw error;
      }
    },
    // Синхронизировать словарь с бекендом (без debounce)
    syncDictionary: async (dictionaryId, language) => {
      let currentState;
      subscribe(state => { currentState = state; })();
      await syncDictionaryToBackend(dictionaryId, language, currentState);
    },
    addCard: (word, translation, association = '', imageUrl = '', dictionaryId = 'default', language = 'en') => {
      update(state => {
        const newCard = {
          id: Date.now(),
          word,
          translation,
          association,
          imageUrl,
          dictionaryId,
          createdAt: new Date().toISOString()
        };
        const newState = {
          ...state,
          unlearned: [...state.unlearned, newCard]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        scheduleSync(dictionaryId, language, newState);
        return newState;
      });
    },
    markAsLearned: (cardId, dictionaryId = null, language = 'en') => {
      update(state => {
        const card = state.unlearned.find(c => c.id === cardId);
        if (!card) return state;
        
        const dictId = dictionaryId || card.dictionaryId || 'default';
        const newState = {
          ...state,
          unlearned: state.unlearned.filter(c => c.id !== cardId),
          learned: [...state.learned, { ...card, learnedAt: new Date().toISOString() }]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        scheduleSync(dictId, language, newState);
        return newState;
      });
    },
    markAsUnlearned: (cardId, dictionaryId = null, language = 'en') => {
      update(state => {
        const card = state.unlearned.find(c => c.id === cardId);
        if (!card) return state;
        
        const dictId = dictionaryId || card.dictionaryId || 'default';
        // Перемещаем карточку в конец списка для повторного изучения
        const newState = {
          ...state,
          unlearned: [...state.unlearned.filter(c => c.id !== cardId), { ...card, reviewedAt: new Date().toISOString() }]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        scheduleSync(dictId, language, newState);
        return newState;
      });
    },
    moveToStudy: (cardId) => {
      update(state => {
        const card = state.learned.find(c => c.id === cardId);
        if (!card) return state;
        
        const newState = {
          ...state,
          learned: state.learned.filter(c => c.id !== cardId),
          unlearned: [...state.unlearned, card]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    moveAllToStudy: () => {
      update(state => {
        if (state.learned.length === 0) return state;
        
        const newState = {
          ...state,
          learned: [],
          unlearned: [...state.unlearned, ...state.learned]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    deleteCard: (cardId, fromList = 'unlearned', dictionaryId = null, language = 'en') => {
      update(state => {
        const card = state[fromList].find(c => c.id === cardId);
        const dictId = dictionaryId || card?.dictionaryId || 'default';
        
        const newState = {
          ...state,
          [fromList]: state[fromList].filter(c => c.id !== cardId)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        scheduleSync(dictId, language, newState);
        return newState;
      });
    },
    editCard: (cardId, fromList, updates, dictionaryId = null, language = 'en') => {
      update(state => {
        const card = state[fromList].find(c => c.id === cardId);
        const dictId = dictionaryId || card?.dictionaryId || 'default';
        
        const newState = {
          ...state,
          [fromList]: state[fromList].map(c => 
            c.id === cardId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          )
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        scheduleSync(dictId, language, newState);
        return newState;
      });
    },
    addDraftCards: (words, dictionaryId = 'default', language = 'en') => {
      update(state => {
        // Получаем существующие слова для проверки дубликатов
        const existingWords = new Set([
          ...state.unlearned.map(c => c.word.toLowerCase()),
          ...state.learned.map(c => c.word.toLowerCase()),
          ...(state.draft || []).map(c => c.word.toLowerCase())
        ]);
        
        let idCounter = 0;
        const newCards = words
          .filter(word => word.trim() && !existingWords.has(word.trim().toLowerCase()))
          .map(word => ({
            id: `draft_${Date.now()}_${idCounter++}_${Math.random().toString(36).substr(2, 9)}`,
            word: word.trim(),
            translation: '',
            association: '',
            imageUrl: '',
            dictionaryId,
            createdAt: new Date().toISOString(),
            isDraft: true
          }));
        
        if (newCards.length === 0) {
          return state; // Не обновляем, если нет новых карточек
        }
        
        const newState = {
          ...state,
          draft: [...(state.draft || []), ...newCards]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        // Передаем количество добавленных слов как количество изменений
        scheduleSync(dictionaryId, language, newState, newCards.length);
        return newState;
      });
    },
    activateCard: (cardId, language = 'en') => {
      update(state => {
        const card = state.draft.find(c => c.id === cardId);
        if (!card) return state;
        
        const dictId = card.dictionaryId || 'default';
        // Удаляем флаг isDraft и перемещаем в unlearned
        const { isDraft, ...cleanCard } = card;
        
        const newState = {
          ...state,
          draft: state.draft.filter(c => c.id !== cardId),
          unlearned: [...state.unlearned, { ...cleanCard, activatedAt: new Date().toISOString() }]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        scheduleSync(dictId, language, newState);
        return newState;
      });
    },
    editDraftCard: (cardId, updates, language = 'en', allowWithoutImage = false) => {
      update(state => {
        const card = state.draft.find(c => c.id === cardId);
        if (!card) return state;
        
        const dictId = card.dictionaryId || 'default';
        const updatedCard = { ...card, ...updates, updatedAt: new Date().toISOString() };
        
        // Проверяем, готова ли карточка
        // Если allowWithoutImage = true и изображения нет, карточка готова только с переводом
        // Иначе нужны и перевод, и изображение
        const hasTranslation = updatedCard.translation?.trim();
        const hasImage = updatedCard.imageUrl?.trim();
        const isReady = hasTranslation && (hasImage || allowWithoutImage);
        
        if (isReady) {
          // Перемещаем в активные слова
          const { isDraft, ...cleanCard } = updatedCard;
          const newState = {
            ...state,
            draft: state.draft.filter(c => c.id !== cardId),
            unlearned: [...state.unlearned, { ...cleanCard, activatedAt: new Date().toISOString() }]
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
          scheduleSync(dictId, language, newState);
          return newState;
        } else {
          // Оставляем в draft
          const newState = {
            ...state,
            draft: state.draft.map(c => c.id === cardId ? updatedCard : c)
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
          return newState;
        }
      });
    },
    reset: () => {
      const initial = { learned: [], unlearned: [], draft: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      set(initial);
    },
    resetDictionary: (dictionaryId) => {
      update(state => {
        const newState = {
          learned: state.learned.filter(c => (c.dictionaryId || 'default') !== dictionaryId),
          unlearned: state.unlearned.filter(c => (c.dictionaryId || 'default') !== dictionaryId),
          draft: state.draft.filter(c => (c.dictionaryId || 'default') !== dictionaryId)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    importCards: (data, dictionaryId) => {
      update(state => {
        const newUnlearned = data.unlearned || [];
        const newLearned = data.learned || [];
        const newDraft = data.draft || [];
        
        // Всегда присваиваем указанный dictionaryId (перезаписываем существующий)
        const addDictionaryId = (cards) => cards.map(card => ({
          ...card,
          dictionaryId: dictionaryId || 'default'
        }));
        
        const processedUnlearned = addDictionaryId(newUnlearned);
        const processedLearned = addDictionaryId(newLearned);
        const processedDraft = addDictionaryId(newDraft);
        
        // Добавляем новые карточки, избегая дубликатов по слову
        const existingWords = new Set([
          ...state.unlearned.map(c => c.word.toLowerCase()),
          ...state.learned.map(c => c.word.toLowerCase()),
          ...state.draft.map(c => c.word.toLowerCase())
        ]);
        
        const filteredUnlearned = processedUnlearned.filter(c => !existingWords.has(c.word.toLowerCase()));
        const filteredLearned = processedLearned.filter(c => !existingWords.has(c.word.toLowerCase()));
        const filteredDraft = processedDraft.filter(c => !existingWords.has(c.word.toLowerCase()));
        
        const newState = {
          learned: [...state.learned, ...filteredLearned],
          unlearned: [...state.unlearned, ...filteredUnlearned],
          draft: [...state.draft, ...filteredDraft]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
  };
}

export const cardsStore = createCardsStore();
