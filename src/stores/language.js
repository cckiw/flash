import { writable } from 'svelte/store';

// Маппинг кодов языков на названия (русские)
const languageNames = {
  en: 'Английский',
  pt: 'Португальский',
  es: 'Испанский'
};

// Маппинг кодов языков на английские названия (для промптов AI)
const languageNamesEn = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish'
};

// Загружаем сохранённый язык из localStorage
const storedLanguage = typeof localStorage !== 'undefined' 
  ? localStorage.getItem('target_language') || 'en'
  : 'en';

export const targetLanguage = writable(storedLanguage);

// Подписываемся на изменения и сохраняем в localStorage
targetLanguage.subscribe(value => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('target_language', value);
  }
});

// Функция для получения названия языка (русское)
export function getLanguageName(code) {
  return languageNames[code] || code;
}

// Функция для получения названия языка (английское, для AI промптов)
export function getLanguageNameEn(code) {
  return languageNamesEn[code] || code;
}

