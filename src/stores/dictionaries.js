import { writable } from 'svelte/store';

const STORAGE_KEY = 'loaded-dictionaries';
const CURRENT_DICT_KEY = 'current_dictionary';

// Store для активного словаря
const storedCurrentDict = typeof localStorage !== 'undefined' 
  ? localStorage.getItem(CURRENT_DICT_KEY) || ''
  : '';

export const currentDictionary = writable(storedCurrentDict);

// Подписываемся на изменения и сохраняем в localStorage
currentDictionary.subscribe(value => {
  if (typeof localStorage !== 'undefined') {
    if (value) {
      localStorage.setItem(CURRENT_DICT_KEY, value);
    } else {
      localStorage.removeItem(CURRENT_DICT_KEY);
    }
  }
});

function createDictionariesStore() {
  const stored = typeof localStorage !== 'undefined' 
    ? localStorage.getItem(STORAGE_KEY) 
    : null;
  
  const initial = stored ? JSON.parse(stored) : [];

  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    addDictionary: (dictId, dictName, language, isImported = false) => {
      update(dictionaries => {
        // Проверяем, нет ли уже такого словаря
        const existing = dictionaries.find(d => d.id === dictId);
        if (existing) {
          // Обновляем существующий словарь
          return dictionaries.map(d => 
            d.id === dictId ? { ...d, name: dictName, language, isImported } : d
          );
        }
        
        const newDict = { id: dictId, name: dictName, language, isImported };
        const newList = [...dictionaries, newDict];
        
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
        }
        
        return newList;
      });
    },
    removeDictionary: (dictId) => {
      update(dictionaries => {
        const newList = dictionaries.filter(d => d.id !== dictId);
        
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
        }
        
        return newList;
      });
    },
    clear: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      set([]);
    },
    updateDictionaryData: (dictId, data) => {
      update(dictionaries => {
        const updated = dictionaries.map(d => 
          d.id === dictId ? { ...d, data } : d
        );
        
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
        
        return updated;
      });
    }
  };
}

export const loadedDictionaries = createDictionariesStore();

