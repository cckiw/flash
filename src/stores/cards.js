import { writable } from 'svelte/store';

const STORAGE_KEY = 'flash-cards-data';

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
    addCard: (word, translation, association = '', imageUrl = '', dictionaryId = 'default') => {
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
        return newState;
      });
    },
    markAsLearned: (cardId) => {
      update(state => {
        const card = state.unlearned.find(c => c.id === cardId);
        if (!card) return state;
        
        const newState = {
          ...state,
          unlearned: state.unlearned.filter(c => c.id !== cardId),
          learned: [...state.learned, { ...card, learnedAt: new Date().toISOString() }]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    markAsUnlearned: (cardId) => {
      update(state => {
        const card = state.unlearned.find(c => c.id === cardId);
        if (!card) return state;
        
        // Перемещаем карточку в конец списка для повторного изучения
        const newState = {
          ...state,
          unlearned: [...state.unlearned.filter(c => c.id !== cardId), { ...card, reviewedAt: new Date().toISOString() }]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
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
    deleteCard: (cardId, fromList = 'unlearned') => {
      update(state => {
        const newState = {
          ...state,
          [fromList]: state[fromList].filter(c => c.id !== cardId)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    editCard: (cardId, fromList, updates) => {
      update(state => {
        const newState = {
          ...state,
          [fromList]: state[fromList].map(c => 
            c.id === cardId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          )
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    addDraftCards: (words, dictionaryId = 'default') => {
      update(state => {
        // Получаем существующие слова для проверки дубликатов
        const existingWords = new Set([
          ...state.unlearned.map(c => c.word.toLowerCase()),
          ...state.learned.map(c => c.word.toLowerCase()),
          ...state.draft.map(c => c.word.toLowerCase())
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
        
        const newState = {
          ...state,
          draft: [...state.draft, ...newCards]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    activateCard: (cardId) => {
      update(state => {
        const card = state.draft.find(c => c.id === cardId);
        if (!card) return state;
        
        // Удаляем флаг isDraft и перемещаем в unlearned
        const { isDraft, ...cleanCard } = card;
        
        const newState = {
          ...state,
          draft: state.draft.filter(c => c.id !== cardId),
          unlearned: [...state.unlearned, { ...cleanCard, activatedAt: new Date().toISOString() }]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return newState;
      });
    },
    editDraftCard: (cardId, updates) => {
      update(state => {
        const card = state.draft.find(c => c.id === cardId);
        if (!card) return state;
        
        const updatedCard = { ...card, ...updates, updatedAt: new Date().toISOString() };
        
        // Проверяем, готова ли карточка (есть перевод и изображение)
        const isReady = updatedCard.translation?.trim() && updatedCard.imageUrl?.trim();
        
        if (isReady) {
          // Перемещаем в активные слова
          const { isDraft, ...cleanCard } = updatedCard;
          const newState = {
            ...state,
            draft: state.draft.filter(c => c.id !== cardId),
            unlearned: [...state.unlearned, { ...cleanCard, activatedAt: new Date().toISOString() }]
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
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
