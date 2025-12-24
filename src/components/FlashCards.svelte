<script>
  import { cardsStore } from '../stores/cards.js';
  import { targetLanguage, getLanguageName, getLanguageNameEn } from '../stores/language.js';
  import { currentDictionary as currentDictionaryStore } from '../stores/dictionaries.js';
  import { flip } from 'svelte/animate';
  
  $: languageName = getLanguageName($targetLanguage);
  $: languageNameEn = getLanguageNameEn($targetLanguage);
  
  let currentIndex = 0;
  let showTranslation = false;
  let dragStartX = 0;
  let dragOffset = 0;
  let isDragging = false;
  let swipeDirection = null;
  
  // Настройки
  let translationExerciseMode = false;
  let showSettings = false;
  
  // Стандартный режим — когда режим перевода выключен
  $: isStandardMode = !translationExerciseMode;
  
  // Функции переключения режимов
  function setStandardMode() {
    translationExerciseMode = false;
    resetCardState();
  }
  
  function toggleTranslationMode() {
    if (!hasAiToken) return;
    if (translationExerciseMode) {
      translationExerciseMode = false;
    } else {
      translationExerciseMode = true;
    }
    resetCardState();
  }
  
  // Режим перевода предложения
  let showSentenceInput = false;
  let sentenceAnswer = '';
  let sentenceResult = null; // null, 'correct', 'incorrect', 'word_error', 'grammar_error'
  let generatedSentence = '';
  let isGeneratingSentence = false;
  let generationError = null;
  let showCardBack = false; // Показать обратную сторону карточки (при "не знаю")
  let displayedCard = null; // Карточка, отображаемая во время переворота
  
  // Проверка ответа
  let isCheckingAnswer = false;
  let wordError = null; // Ошибка в написании слова
  let grammarErrorPart = null; // Часть предложения с ошибкой
  let grammarCorrection = null; // Правильный вариант предложения
  let userSentenceWithError = null; // Введённое предложение для подсветки ошибки
  
  // AI Token
  let aiToken = '';
  $: hasAiToken = aiToken && aiToken.length > 0;
  
  // Загружаем токен при монтировании и следим за изменениями
  import { onMount, onDestroy } from 'svelte';
  
  function checkToken() {
    aiToken = localStorage.getItem('ai_token') || '';
  }
  
  // Обработчики для автообновления токена
  function handleFocus() {
    checkToken();
  }
  
  function handleStorage(e) {
    if (e.key === 'ai_token') {
      checkToken();
    }
  }
  
  // Интервал для проверки токена (для той же вкладки)
  let tokenCheckInterval;
  
  onMount(() => {
    checkToken();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    // Проверяем каждые 500ms когда настройки открыты
    tokenCheckInterval = setInterval(() => {
      if (showSettings) {
        checkToken();
      }
    }, 500);
  });
  
  onDestroy(() => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('storage', handleStorage);
    if (tokenCheckInterval) {
      clearInterval(tokenCheckInterval);
    }
  });
  
  
  // Если токен удалён — выключаем режим перевода предложения
  $: if (!hasAiToken && translationExerciseMode) {
    translationExerciseMode = false;
  }
  
  // Генерация предложения через AI
  async function generateSentence(word, translation) {
    isGeneratingSentence = true;
    generationError = null;
    generatedSentence = '';
    
    const prompt = `You are a ${languageNameEn} language learning assistant. Student level: A1-A2 (beginner).

Task: Create ONE short and simple sentence in RUSSIAN that will need to be translated into ${languageNameEn}.

${languageNameEn} word: "${word}"
Russian translation: "${translation}"

Requirements:
- The sentence must be in Russian
- The sentence must contain the word "${translation}" (or its form)
- Length: 3-10 words
- Simple A1-A2 level grammar
- Use simple tenses (Present Simple, Past Simple, Future Simple, Present Continuous, Present Perfect)
- Avoid complex constructions

Reply ONLY with the sentence in Russian, without quotes or explanations.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiToken}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Ошибка API: ${response.status}`);
      }
      
      const data = await response.json();
      generatedSentence = data.choices[0]?.message?.content?.trim() || '';
      
      if (!generatedSentence) {
        throw new Error('Пустой ответ от AI');
      }
      
      // Расчёт стоимости запроса (gpt-4o-mini)
      // Input: $0.15 / 1M tokens, Output: $0.60 / 1M tokens
      if (data.usage) {
        const inputCost = (data.usage.prompt_tokens / 1000000) * 0.15;
        const outputCost = (data.usage.completion_tokens / 1000000) * 0.60;
        const requestCost = inputCost + outputCost;
        
        // Сохраняем общую стоимость
        const currentTotal = parseFloat(localStorage.getItem('ai_total_cost') || '0');
        const newTotal = currentTotal + requestCost;
        localStorage.setItem('ai_total_cost', newTotal.toString());
      }
    } catch (error) {
      console.error('Ошибка генерации:', error);
      generationError = error.message;
      generatedSentence = '';
    } finally {
      isGeneratingSentence = false;
    }
  }
  
  // Хранит перемешанный порядок карточек
  let shuffledCards = [];
  let lastCardIds = new Set();
  
  // Функция перемешивания (Fisher-Yates shuffle)
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  // Получаем активный словарь из store (реактивно)
  $: currentDictionary = $currentDictionaryStore || 'default';
  
  // Фильтруем карточки по активному словарю
  $: allCards = $cardsStore.unlearned.filter(c => {
    const cardDictId = c.dictionaryId || 'default';
    return cardDictId === currentDictionary;
  });
  
  // Отслеживаем предыдущий словарь для сброса при переключении
  let previousDictionary = currentDictionary;
  
  // Перемешиваем только при изменении набора карточек (добавление/удаление) или при смене словаря
  $: {
    const currentIds = new Set(allCards.map(c => c.id));
    const dictionaryChanged = previousDictionary !== currentDictionary;
    
    // Проверяем, изменился ли набор ID (не порядок) или словарь
    const idsChanged = currentIds.size !== lastCardIds.size || 
      ![...currentIds].every(id => lastCardIds.has(id));
    
    if (dictionaryChanged || idsChanged) {
      // Новые карточки или смена словаря — полностью перемешиваем
      shuffledCards = shuffleArray(allCards);
      lastCardIds = currentIds;
      currentIndex = 0;
      previousDictionary = currentDictionary;
    } else {
      // Набор ID тот же — просто обновляем данные карточек без перемешивания
      shuffledCards = shuffledCards.map(card => {
        const updated = allCards.find(c => c.id === card.id);
        return updated || card;
      });
    }
  }
  
  $: filteredCards = shuffledCards;
  $: currentCard = filteredCards[currentIndex];
  $: hasCards = filteredCards.length > 0;
  // Используем сохранённую карточку во время переворота, иначе текущую
  // Важно: сохраняем карточку, которая отображается во время анимации переворота
  $: cardToDisplay = (translationExerciseMode && showCardBack && displayedCard) ? displayedCard : currentCard;
  
  function handleDragStart(e) {
    isDragging = true;
    dragStartX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    swipeDirection = null;
  }
  
  function handleDragMove(e) {
    if (!isDragging) return;
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    dragOffset = clientX - dragStartX;
    
    if (dragOffset > 50) {
      swipeDirection = 'right';
    } else if (dragOffset < -50) {
      swipeDirection = 'left';
    } else {
      swipeDirection = null;
    }
  }
  
  function handleDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    if (Math.abs(dragOffset) > 100 && currentCard) {
      if (dragOffset > 0) {
        markKnown();
      } else {
        markUnknown();
      }
    }
    
    dragOffset = 0;
    swipeDirection = null;
  }
  
  async function markKnown() {
    if (currentCard) {
      // В режиме перевода предложений - генерируем предложение и показываем ввод
      if (translationExerciseMode && !showSentenceInput) {
        showSentenceInput = true;
        sentenceAnswer = '';
        sentenceResult = null;
        
        // Генерируем предложение через AI
        await generateSentence(currentCard.word, currentCard.translation);
        return;
      }
      
      const dictId = currentCard.dictionaryId || currentDictionary || 'default';
      const lang = $targetLanguage || 'en';
      cardsStore.markAsLearned(currentCard.id, dictId, lang);
      resetCardState();
      if (currentIndex >= filteredCards.length - 1) {
        currentIndex = Math.max(0, filteredCards.length - 2);
      }
    }
  }
  
  function markUnknown() {
    if (currentCard) {
      const cardToMove = currentCard;
      
      // Перемещаем карточку в конец локального списка (без полного перемешивания)
      shuffledCards = [...shuffledCards.filter(c => c.id !== cardToMove.id), cardToMove];
      
      // Обновляем store
      const dictId = cardToMove.dictionaryId || currentDictionary || 'default';
      const lang = $targetLanguage || 'en';
      cardsStore.markAsUnlearned(cardToMove.id, dictId, lang);
      
      resetCardState();
      
      // Переходим к следующей карточке (или остаёмся, если дошли до конца)
      if (currentIndex >= filteredCards.length - 1) {
        currentIndex = 0;
      }
    }
  }
  
  function resetCardState() {
    showTranslation = false;
    showSentenceInput = false;
    sentenceAnswer = '';
    sentenceResult = null;
    generatedSentence = '';
    generationError = null;
    isCheckingAnswer = false;
    wordError = null;
    grammarErrorPart = null;
    grammarCorrection = null;
    userSentenceWithError = null;
    showCardBack = false;
    displayedCard = null;
  }
  
  function skipCard() {
    if (currentCard) {
      // В режиме перевода предложения — сначала показываем обратную сторону
      if (translationExerciseMode && !showCardBack) {
        displayedCard = currentCard; // Сохраняем карточку для отображения во время переворота
        showCardBack = true;
        return;
      }
      
      // Если карточка перевёрнута, ждём завершения анимации перед переходом к следующей
      if (translationExerciseMode && showCardBack) {
        // Анимация переворота длится 0.6 секунды, ждём её завершения
        const cardToMove = displayedCard || currentCard;
        // Перемещаем карточку в конец списка сразу, но продолжаем показывать displayedCard
        shuffledCards = [...shuffledCards.filter(c => c.id !== cardToMove.id), cardToMove];
        const dictId = cardToMove.dictionaryId || currentDictionary || 'default';
        const lang = $targetLanguage || 'en';
        cardsStore.markAsUnlearned(cardToMove.id, dictId, lang);
        
        // Ждём завершения анимации перед переходом к следующей карточке
        setTimeout(() => {
          resetCardState();
          displayedCard = null; // Сбрасываем сохранённую карточку
          if (currentIndex >= filteredCards.length - 1) {
            currentIndex = 0;
          } else {
            // Индекс уже указывает на следующую карточку благодаря перемещению в конец
          }
        }, 600); // Ждём завершения анимации переворота (0.6s)
        return;
      }
      
      const cardToMove = currentCard;
      shuffledCards = [...shuffledCards.filter(c => c.id !== cardToMove.id), cardToMove];
      const dictId = cardToMove.dictionaryId || currentDictionary || 'default';
      const lang = $targetLanguage || 'en';
      cardsStore.markAsUnlearned(cardToMove.id, dictId, lang);
      resetCardState();
      displayedCard = null;
      if (currentIndex >= filteredCards.length - 1) {
        currentIndex = 0;
      }
    }
  }
  
  // Проверка грамматики через AI
  async function checkGrammar(userSentence, russianSentence, expectedWord) {
    const prompt = `You are a ${languageNameEn} language teacher. Check the translation of a sentence from Russian to ${languageNameEn}.

Russian sentence: "${russianSentence}"
Student's translation: "${userSentence}"
Key word that must be used: "${expectedWord}"

Task: check the grammar of the sentence and its correspondence to the translation.
- DO NOT check punctuation (commas, periods)
- Check only grammatical errors (tenses, articles, word order, word forms)
- Check that the meaning matches the translation

Response format:
- If the sentence is grammatically correct and conveys the meaning — reply only: 0
- If there are errors — reply in this format:
ERROR: [part of the sentence with the error]
CORRECTION: [correct version of the entire sentence]

Reply ONLY in the specified format, without additional explanations.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiToken}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 200,
          temperature: 0.3
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Ошибка API: ${response.status}`);
      }
      
      const data = await response.json();
      const result = data.choices[0]?.message?.content?.trim() || '';
      
      // Расчёт стоимости
      if (data.usage) {
        const inputCost = (data.usage.prompt_tokens / 1000000) * 0.15;
        const outputCost = (data.usage.completion_tokens / 1000000) * 0.60;
        const requestCost = inputCost + outputCost;
        const currentTotal = parseFloat(localStorage.getItem('ai_total_cost') || '0');
        localStorage.setItem('ai_total_cost', (currentTotal + requestCost).toString());
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка проверки грамматики:', error);
      throw error;
    }
  }
  
  async function checkSentence() {
    if (!currentCard || !sentenceAnswer.trim()) return;
    
    const userInput = sentenceAnswer.trim();
    const expectedWord = currentCard.word.toLowerCase();
    
    // Шаг 1: Проверяем наличие ключевого слова на клиенте
    // Ищем слово целиком (с учётом форм слова - базовая проверка)
    const userInputLower = userInput.toLowerCase();
    const wordRegex = new RegExp(`\\b${expectedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i');
    const hasCorrectWord = wordRegex.test(userInputLower);
    
    if (!hasCorrectWord) {
      // Слово написано неправильно или отсутствует
      sentenceResult = 'word_error';
      wordError = currentCard.word;
      grammarErrorPart = null;
      grammarCorrection = null;
      
      // Карточка на повторение
      setTimeout(() => {
        const cardToMove = currentCard;
        shuffledCards = [...shuffledCards.filter(c => c.id !== cardToMove.id), cardToMove];
        const dictId = cardToMove.dictionaryId || currentDictionary || 'default';
        const lang = $targetLanguage || 'en';
        cardsStore.markAsUnlearned(cardToMove.id, dictId, lang);
        if (currentIndex >= filteredCards.length - 1) {
          currentIndex = 0;
        }
        resetCardState();
      }, 3000);
      return;
    }
    
    // Шаг 2: Слово правильное - проверяем грамматику через AI
    isCheckingAnswer = true;
    wordError = null;
    grammarErrorPart = null;
    grammarCorrection = null;
    
    try {
      const result = await checkGrammar(userInput, generatedSentence, currentCard.word);
      
      if (result === '0') {
        // Всё правильно
        sentenceResult = 'correct';
        
        setTimeout(() => {
          const dictId = currentCard.dictionaryId || currentDictionary || 'default';
          const lang = $targetLanguage || 'en';
          cardsStore.markAsLearned(currentCard.id, dictId, lang);
          if (currentIndex >= filteredCards.length - 1) {
            currentIndex = Math.max(0, filteredCards.length - 2);
          }
          resetCardState();
        }, 1500);
      } else {
        // Есть грамматические ошибки - парсим ответ AI
        sentenceResult = 'grammar_error';
        userSentenceWithError = userInput;
        
        // Парсим ответ формата:
        // ERROR: [part with error]
        // CORRECTION: [correct version]
        const errorMatch = result.match(/ERROR:\s*(.+)/i);
        const correctionMatch = result.match(/CORRECTION:\s*(.+)/i);
        
        grammarErrorPart = errorMatch ? errorMatch[1].trim() : null;
        grammarCorrection = correctionMatch ? correctionMatch[1].trim() : result;
      }
    } catch (error) {
      // При ошибке API считаем ответ правильным (чтобы не блокировать пользователя)
      sentenceResult = 'correct';
      setTimeout(() => {
        const dictId = currentCard.dictionaryId || currentDictionary || 'default';
        const lang = $targetLanguage || 'en';
        cardsStore.markAsLearned(currentCard.id, dictId, lang);
        if (currentIndex >= filteredCards.length - 1) {
          currentIndex = Math.max(0, filteredCards.length - 2);
        }
        resetCardState();
      }, 1500);
    } finally {
      isCheckingAnswer = false;
    }
  }
  
  
  function handleSentenceKeydown(e) {
    if (e.key === 'Enter' && showSentenceInput && !isCheckingAnswer && sentenceResult !== 'grammar_error') {
      checkSentence();
    }
  }
  
  // Подсветка ошибки в предложении
  function highlightError(sentence, errorPart) {
    if (!errorPart) return sentence;
    
    // Экранируем специальные символы для регулярного выражения
    const escapedError = errorPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedError})`, 'gi');
    
    return sentence.replace(regex, '<span class="highlighted-error">$1</span>');
  }
  
  // Продолжить после просмотра ошибки
  function continueAfterError() {
    if (currentCard) {
      const cardToMove = currentCard;
      shuffledCards = [...shuffledCards.filter(c => c.id !== cardToMove.id), cardToMove];
      const dictId = cardToMove.dictionaryId || currentDictionary || 'default';
      const lang = $targetLanguage || 'en';
      cardsStore.markAsUnlearned(cardToMove.id, dictId, lang);
      if (currentIndex >= filteredCards.length - 1) {
        currentIndex = 0;
      }
      resetCardState();
    }
  }
  
  function toggleTranslation() {
    showTranslation = !showTranslation;
  }
  
  function getCardStyle() {
    if (!isDragging) return '';
    const rotation = dragOffset * 0.05;
    return `transform: translateX(${dragOffset}px) rotate(${rotation}deg);`;
  }
</script>

<div class="flashcards-container">
  <div class="header">
    <div class="header-top">
      <h1>Изучение</h1>
      <button class="settings-btn" on:click={() => showSettings = !showSettings} class:active={showSettings}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
    <p class="subtitle">
      {#if hasCards}
        Осталось карточек: <span class="count">{filteredCards.length}</span>
      {:else}
        Добавьте карточки для начала
      {/if}
    </p>
  </div>
  
  {#if showSettings}
    <div class="settings-overlay" on:click={() => showSettings = false} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && (showSettings = false)}>
      <div class="settings-modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <button class="modal-close-btn" on:click={() => showSettings = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <h2 class="modal-title">Выбери тип упражнения</h2>
        
        <div class="settings-options">
          <button class="exercise-option" class:active={isStandardMode} on:click={setStandardMode}>
            <span class="option-radio" class:checked={isStandardMode}></span>
            <div class="option-content">
              <span class="option-title">Flash Cards</span>
              <span class="option-desc">Классические карточки с переворотом</span>
            </div>
          </button>
          
          <button 
            class="exercise-option" 
            class:active={translationExerciseMode} 
            class:disabled={!hasAiToken}
            on:click={toggleTranslationMode}
          >
            <span class="option-radio" class:checked={translationExerciseMode} class:disabled={!hasAiToken}></span>
            <div class="option-content">
              <span class="option-title">
                Перевод предложения
                {#if !hasAiToken}
                  <span class="ai-badge">AI</span>
                {/if}
              </span>
              <span class="option-desc">
                {#if !hasAiToken}
                  Требуется AI токен
                {:else}
                  Переведите предложение на {languageName.toLowerCase()}
                {/if}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if hasCards && cardToDisplay}
    <div class="card-area" class:translation-mode={translationExerciseMode && showSentenceInput}>
      {#if translationExerciseMode}
        <!-- Режим "перевод предложения" -->
        <div class="translation-exercise-layout" class:with-input={showSentenceInput} class:card-flipped={showCardBack}>
          {#key cardToDisplay?.id}
          <div class="card translation-card" class:correct={sentenceResult === 'correct'} class:incorrect={sentenceResult === 'incorrect'} class:flipped={showCardBack}>
            <div class="card-inner">
              <div class="card-front translation-front">
                <div class="card-text-content">
                  <span class="card-label">Перевод</span>
                  <h2 class="card-word">{cardToDisplay.translation}</h2>
                </div>
                {#if sentenceResult && sentenceResult !== 'grammar_error'}
                  <div class="answer-overlay" 
                       class:correct={sentenceResult === 'correct'} 
                       class:incorrect={sentenceResult === 'word_error'}>
                    {#if sentenceResult === 'correct'}
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>Правильно!</span>
                    {:else if sentenceResult === 'word_error'}
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      <div class="error-details">
                        <span class="error-title">Ошибка в слове</span>
                        <span class="expected-word">Ожидалось: <strong>{wordError}</strong></span>
                      </div>
                    {/if}
                  </div>
                {/if}
                {#if isCheckingAnswer}
                  <div class="answer-overlay checking">
                    <div class="checking-spinner"></div>
                    <span>Проверка...</span>
                  </div>
                {/if}
              </div>
              <div class="card-back translation-back" class:has-image={cardToDisplay.imageUrl}>
                {#if cardToDisplay.imageUrl}
                  <img src={cardToDisplay.imageUrl} alt="" class="card-image" />
                {/if}
                <div class="card-text-content">
                  <span class="card-label">{languageName}</span>
                  <h2 class="card-word">{cardToDisplay.word}</h2>
                  {#if cardToDisplay.association}
                    <div class="association">
                      <span class="association-label">Ассоциация:</span>
                      <p>{cardToDisplay.association}</p>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
          {/key}
          
          {#if showCardBack}
            <!-- Кнопка продолжить после просмотра обратной стороны -->
            <div class="card-back-actions">
              <button class="continue-btn" on:click={skipCard}>
                Продолжить
              </button>
            </div>
          {:else if showSentenceInput}
            <!-- Блок ввода предложения -->
            <div class="sentence-exercise">
              <div class="sentence-prompt" class:loading={isGeneratingSentence} class:error={generationError}>
                <span class="sentence-label">Переведите на {languageName.toLowerCase()}:</span>
                {#if isGeneratingSentence}
                  <div class="sentence-loading">
                    <div class="loading-spinner"></div>
                    <span>Генерация предложения...</span>
                  </div>
                {:else if generationError}
                  <p class="sentence-error">{generationError}</p>
                  <button class="retry-btn" on:click={() => generateSentence(currentCard.word, currentCard.translation)}>
                    Попробовать снова
                  </button>
                {:else}
                  <p class="sentence-text">{generatedSentence}</p>
                {/if}
              </div>
              {#if !isGeneratingSentence && !generationError}
                {#if sentenceResult === 'grammar_error'}
                  <!-- Блок с грамматической ошибкой -->
                  <div class="grammar-error-block">
                    <div class="user-sentence-error">
                      {#if grammarErrorPart}
                        {@html highlightError(userSentenceWithError, grammarErrorPart)}
                      {:else}
                        <span class="error-text">{userSentenceWithError}</span>
                      {/if}
                    </div>
                    <div class="correction-block">
                      <span class="correction-label">Правильный вариант:</span>
                      <p class="correction-text">{grammarCorrection}</p>
                    </div>
                    <button class="continue-btn" on:click={continueAfterError}>
                      Продолжить
                    </button>
                  </div>
                {:else}
                  <div class="answer-input-area">
                    <input 
                      type="text" 
                      class="answer-input sentence-input" 
                      class:correct={sentenceResult === 'correct'}
                      class:incorrect={sentenceResult === 'incorrect'}
                      bind:value={sentenceAnswer}
                      on:keydown={handleSentenceKeydown}
                      placeholder="Введите перевод..."
                      disabled={sentenceResult !== null || isCheckingAnswer}
                    />
                    <button class="check-btn" on:click={checkSentence} disabled={!sentenceAnswer.trim() || sentenceResult !== null || isCheckingAnswer}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                    </button>
                  </div>
                {/if}
              {/if}
              <button class="skip-sentence-btn" on:click={skipCard} disabled={sentenceResult !== null || isGeneratingSentence || isCheckingAnswer}>
                Пропустить
              </button>
            </div>
          {:else}
            <!-- Кнопки Не знаю / Знаю -->
            <div class="action-buttons">
              <button class="action-btn unknown" on:click={skipCard}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </button>
              <button class="action-btn known" on:click={markKnown}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="16 10 11 15 8 12"></polyline>
                </svg>
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Обычный режим -->
        {#key currentCard.id}
          <div 
            class="card"
            class:flipped={showTranslation}
            class:dragging={isDragging}
            class:swipe-left={swipeDirection === 'left'}
            class:swipe-right={swipeDirection === 'right'}
            style={getCardStyle()}
            on:mousedown={handleDragStart}
            on:mousemove={handleDragMove}
            on:mouseup={handleDragEnd}
            on:mouseleave={handleDragEnd}
            on:touchstart={handleDragStart}
            on:touchmove={handleDragMove}
            on:touchend={handleDragEnd}
            on:click={toggleTranslation}
            role="button"
            tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && toggleTranslation()}
          >
            <div class="card-inner">
              <div class="card-front">
                <div class="card-text-content">
                  <span class="card-label">{languageName}</span>
                  <h2 class="card-word">{currentCard.word}</h2>
                  <p class="card-hint">Нажмите, чтобы увидеть перевод</p>
                </div>
              </div>
              <div class="card-back" class:has-image={currentCard.imageUrl}>
                {#if currentCard.imageUrl}
                  <img src={currentCard.imageUrl} alt="" class="card-image" />
                {/if}
                <div class="card-text-content">
                  <span class="card-label">Перевод</span>
                  <h2 class="card-word">{currentCard.translation}</h2>
                  {#if currentCard.association}
                    <div class="association">
                      <span class="association-label">Ассоциация:</span>
                      <p>{currentCard.association}</p>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/key}
        
        <div class="action-buttons">
          <button class="action-btn unknown" on:click={markUnknown}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </button>
          <button class="action-btn known" on:click={markKnown}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="16 10 11 15 8 12"></polyline>
            </svg>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <line x1="9" y1="9" x2="15" y2="15"></line>
          <line x1="15" y1="9" x2="9" y2="15"></line>
        </svg>
      </div>
      <h2>Нет карточек для изучения</h2>
      <p>Добавьте новые слова или верните карточки из списков</p>
    </div>
  {/if}
</div>

<style>
  .flashcards-container {
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem;
    padding-bottom: 100px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  
  /* Desktop: wider container */
  @media (min-width: 768px) {
    .flashcards-container {
      max-width: 520px;
    }
  }
  
  /* Расширяем контейнер на десктопе для режима перевода */
  @media (min-width: 768px) {
    .flashcards-container:has(.translation-exercise-layout.with-input),
    .flashcards-container:has(.translation-exercise-layout.card-flipped) {
      max-width: 920px;
    }
  }
  
  .header {
    text-align: center;
    margin-bottom: 1.5rem;
  }
  
  /* Уменьшаем отступ снизу для Safari */
  @media screen and (-webkit-min-device-pixel-ratio: 0) {
    .flashcards-container .card-area {
      margin-top: 0.5rem;
      justify-content: flex-start;
    }
  }
  
  .header-top {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  
  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }
  
  .settings-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .settings-btn:hover, .settings-btn.active {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: var(--hover-bg);
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin: 0;
  }
  
  .count {
    color: var(--accent-primary);
    font-weight: 600;
  }
  
  .filter-note {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  
  /* Settings Modal */
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }
  
  .settings-modal {
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 20px;
    padding: 1.5rem;
    max-width: 360px;
    width: 100%;
    position: relative;
    animation: slideUp 0.3s ease;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .modal-close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .modal-close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  
  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.25rem 0;
    padding-right: 2rem;
  }
  
  .settings-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .exercise-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1rem 1.25rem;
    background: var(--hover-bg);
    border: 2px solid var(--border-color);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }
  
  .exercise-option:hover:not(.disabled) {
    border-color: var(--accent-primary);
    background: var(--card-bg);
  }
  
  .exercise-option.active {
    border-color: var(--accent-primary);
    background: var(--card-bg);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  
  .exercise-option.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .option-radio {
    width: 22px;
    height: 22px;
    border: 2px solid var(--border-color);
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .option-radio.checked {
    border-color: var(--accent-primary);
    background: var(--gradient-primary);
  }
  
  .option-radio.checked::after {
    content: '';
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
  }
  
  .option-radio.disabled {
    border-color: var(--text-muted);
  }
  
  .option-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .option-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .option-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }
  
  .checkbox-label input {
    display: none;
  }
  
  .checkbox-custom {
    width: 22px;
    height: 22px;
    border: 2px solid var(--border-color);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .checkbox-label input:checked + .checkbox-custom {
    background: var(--gradient-primary);
    border-color: var(--accent-primary);
  }
  
  .checkbox-label input:checked + .checkbox-custom::after {
    content: '';
    width: 6px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-bottom: 2px;
  }
  
  .checkbox-text {
    font-size: 0.9rem;
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .checkbox-text.disabled,
  .checkbox-custom.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .ai-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.4rem;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    color: white;
    border-radius: 4px;
    margin-left: auto;
  }
  
  .settings-hint {
    margin: 0.75rem 0 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.4;
  }
  
  .settings-hint.warning {
    color: var(--warning-text);
  }
  
  .card-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    margin-top: 1rem;
  }
  
  /* Desktop layout for translation exercise mode */
  @media (min-width: 768px) {
    .card-area.translation-mode {
      max-width: 100%;
    }
  }
  
  .translation-exercise-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }
  
  /* Desktop: side-by-side layout when input is shown */
  @media (min-width: 768px) {
    .translation-exercise-layout.with-input {
      flex-direction: row;
      align-items: flex-start;
      justify-content: center;
      gap: 2rem;
    }
    
    .translation-exercise-layout.with-input .sentence-exercise {
      flex: 1;
      max-width: 400px;
      margin-top: 0;
    }
  }
  
  /* Translation Exercise Mode Card */
  .translation-card {
    width: 100%;
    max-width: 340px;
    height: 200px !important;
    cursor: default;
    overflow: hidden;
  }
  
  /* Desktop: wider cards for special modes */
  @media (min-width: 768px) {
    .translation-card {
      max-width: 420px;
      height: 400px !important;
    }
  }
  
  .translation-card .card-inner {
    pointer-events: auto;
  }
  
  .translation-front {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gradient-card);
  }
  
  .translation-front .card-text-content {
    padding: 2rem;
  }
  
  .translation-front .card-label {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .translation-front .card-word {
    color: white;
    font-size: clamp(1.25rem, 6vw, 2rem);
  }
  
  .translation-card.correct .card-inner {
    box-shadow: 0 0 30px rgba(34, 197, 94, 0.5);
  }
  
  .translation-card.incorrect .card-inner {
    box-shadow: 0 0 30px rgba(239, 68, 68, 0.5);
  }
  
  /* Flip animation for translation card */
  .translation-card {
    perspective: 1000px;
  }
  
  .translation-card .card-inner {
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    transform-style: preserve-3d;
  }
  
  .translation-card.flipped .card-inner {
    transform: rotateY(180deg);
  }
  
  .translation-card .card-front,
  .translation-card .card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 24px;
  }
  
  .translation-back {
    transform: rotateY(180deg);
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .translation-back.has-image .card-image {
    width: 100%;
    height: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  
  .translation-back .card-text-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  
  .translation-back.has-image .card-text-content {
    height: 50%;
  }
  
  .translation-back .card-word {
    color: var(--text-primary);
    font-size: clamp(1rem, 5vw, 1.5rem);
  }
  
  .translation-back .card-label {
    color: var(--text-muted);
  }
  
  .translation-back .association {
    margin-top: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 12px;
    text-align: center;
  }
  
  .translation-back .association-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .translation-back .association p {
    color: var(--text-primary);
    margin: 0.375rem 0 0 0;
    font-size: 0.85rem;
    line-height: 1.5;
  }
  
  /* Card back actions */
  .card-back-actions {
    margin-top: 1.5rem;
    width: 100%;
    max-width: 340px;
  }
  
  @media (min-width: 768px) {
    .card-back-actions {
      max-width: 420px;
    }
  }
  
  .card-back-actions .continue-btn {
    width: 100%;
  }
  
  /* Desktop layout when card is flipped */
  @media (min-width: 768px) {
    .translation-exercise-layout.card-flipped {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2rem;
    }
    
    .translation-exercise-layout.card-flipped .card-back-actions {
      margin-top: 0;
      max-width: 420px;
      width: 100%;
    }
  }
  
  .answer-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.3s ease;
  }
  
  .answer-overlay.correct {
    background: rgba(34, 197, 94, 0.85);
  }
  
  .answer-overlay.incorrect {
    background: rgba(239, 68, 68, 0.85);
  }
  
  .answer-overlay.checking {
    background: rgba(99, 102, 241, 0.85);
  }
  
  .answer-overlay svg {
    stroke: white;
  }
  
  .answer-overlay span {
    color: white;
    font-size: 1.25rem;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .checking-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  .error-details {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    padding: 0 1rem;
  }
  
  .error-title {
    color: white;
    font-size: 1rem;
    font-weight: 600;
  }
  
  .expected-word {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
  }
  
  .expected-word strong {
    font-family: 'JetBrains Mono', monospace;
    color: white;
  }
  
  /* Grammar Error Block */
  .grammar-error-block {
    width: 100%;
    margin-top: 1rem;
  }
  
  .user-sentence-error {
    background: var(--danger-bg);
    border: 2px solid var(--danger-text);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    font-size: 1rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
    line-height: 1.5;
    text-align: center;
  }
  
  .user-sentence-error :global(.highlighted-error) {
    background: var(--danger-text);
    color: white;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .user-sentence-error .error-text {
    color: var(--danger-text);
  }
  
  .correction-block {
    margin-top: 1rem;
    background: var(--success-bg);
    border: 2px solid var(--success-text);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    text-align: center;
  }
  
  .correction-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--success-text);
    margin-bottom: 0.5rem;
  }
  
  .correction-text {
    font-size: 1rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.5;
  }
  
  .continue-btn {
    margin-top: 1rem;
    width: 100%;
    padding: 0.875rem;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: inherit;
    color: white;
    background: var(--gradient-primary);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .continue-btn:hover {
    box-shadow: 0 4px 15px var(--accent-glow);
    transform: translateY(-1px);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .answer-input-area {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    width: 100%;
    max-width: 340px;
  }
  
  @media (min-width: 768px) {
    .answer-input-area {
      max-width: 420px;
    }
  }
  
  .answer-input {
    flex: 1;
    padding: 1rem 1.25rem;
    font-size: 1rem;
    font-family: 'JetBrains Mono', monospace;
    border: 2px solid var(--border-color);
    border-radius: 12px;
    background: var(--card-bg);
    color: var(--text-primary);
    transition: all 0.2s ease;
    text-align: center;
  }
  
  .answer-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }
  
  .answer-input::placeholder {
    color: var(--text-muted);
    font-family: 'Outfit', sans-serif;
  }
  
  .answer-input.correct {
    border-color: var(--success-text);
    background: var(--success-bg);
  }
  
  .answer-input.incorrect {
    border-color: var(--danger-text);
    background: var(--danger-bg);
  }
  
  .check-btn {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gradient-primary);
    border: none;
    border-radius: 12px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .check-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 15px var(--accent-glow);
  }
  
  .check-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Sentence Exercise Styles */
  .sentence-exercise {
    width: 100%;
    max-width: 340px;
    margin-top: 1.5rem;
  }
  
  @media (min-width: 768px) {
    .sentence-exercise {
      max-width: 420px;
    }
  }
  
  /* Desktop: выравниваем по верху карточки */
  @media (min-width: 768px) {
    .translation-exercise-layout.with-input .sentence-exercise {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      min-height: 200px;
    }
    
    .translation-exercise-layout.with-input .answer-input-area {
      max-width: 100%;
    }
  }
  
  .sentence-prompt {
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 1rem;
    text-align: center;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .sentence-prompt.loading {
    border-color: var(--accent-primary);
  }
  
  .sentence-prompt.error {
    border-color: var(--danger-text);
    background: var(--danger-bg);
  }
  
  .sentence-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .sentence-error {
    color: var(--danger-text);
    font-size: 0.9rem;
    margin: 0 0 0.75rem 0;
  }
  
  .retry-btn {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--danger-text);
    background: transparent;
    border: 1px solid var(--danger-text);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .retry-btn:hover {
    background: var(--danger-text);
    color: white;
  }
  
  .sentence-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 0.5rem;
  }
  
  .sentence-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.5;
  }
  
  .sentence-input {
    font-size: 0.95rem;
  }
  
  .skip-sentence-btn {
    margin-top: 0.75rem;
    padding: 0.6rem 1.25rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
  }
  
  .skip-sentence-btn:hover:not(:disabled) {
    border-color: var(--danger-text);
    color: var(--danger-text);
    background: var(--danger-bg);
  }
  
  .skip-sentence-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .card {
    width: 100%;
    max-width: 340px;
    height: 400px;
    perspective: 1000px;
    cursor: grab;
    user-select: none;
    transition: transform 0.1s ease;
    z-index: 2;
  }
  
  /* Desktop: wider cards */
  @media (min-width: 768px) {
    .card {
      max-width: 420px;
    }
  }
  
  .card.dragging {
    cursor: grabbing;
    transition: none;
  }
  
  .card.swipe-left .card-inner {
    box-shadow: -10px 0 30px rgba(239, 68, 68, 0.3);
  }
  
  .card.swipe-right .card-inner {
    box-shadow: 10px 0 30px rgba(34, 197, 94, 0.3);
  }
  
  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
    transform-style: preserve-3d;
    border-radius: 24px;
    pointer-events: none;
  }
  
  .card.flipped .card-inner {
    transform: rotateY(180deg);
  }
  
  .card-front, .card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  }
  
  .card-front:not(.has-image), .card-back:not(.has-image) {
    align-items: center;
    justify-content: flex-start;
    padding: 2rem;
    overflow-y: auto;
  }
  
  .card-back {
    transform: rotateY(180deg);
    background: var(--gradient-card);
  }
  
  .card-image {
    width: 100%;
    height: 55%;
    object-fit: cover;
    flex-shrink: 0;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
  }
  
  .card-text-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    position: relative;
    width: 100%;
    box-sizing: border-box;
    pointer-events: none;
    overflow-y: auto;
    min-height: 0;
  }
  
  .has-image .card-text-content {
    background: linear-gradient(to top, var(--card-bg) 90%, transparent);
  }
  
  .card-back.has-image .card-text-content {
    background: linear-gradient(to top, rgba(79, 70, 229, 0.95) 90%, transparent);
  }
  
  .card-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }
  
  .card-front:not(.has-image) .card-label,
  .card-back:not(.has-image) .card-label {
    flex-shrink: 0;
    margin-bottom: 0.75rem;
  }
  
  .card-word {
    font-size: clamp(1rem, 5vw, 1.75rem);
    font-weight: 700;
    text-align: center;
    margin: 0;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    max-width: 100%;
  }
  
  .has-image .card-word {
    font-size: clamp(0.9rem, 4vw, 1.5rem);
  }
  
  .card-back .card-word {
    color: white;
  }
  
  .card-back .card-label {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .card-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0.75rem 0 0 0;
    flex-shrink: 0;
  }
  
  .association {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    text-align: center;
    max-width: 100%;
    word-break: break-word;
    overflow-wrap: break-word;
    flex-shrink: 0;
  }
  
  .has-image .association {
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
  }
  
  .association-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .association p {
    margin: 0.375rem 0 0 0;
    font-size: clamp(0.7rem, 3vw, 0.8rem);
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.4;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  
  .action-buttons {
    display: flex;
    gap: 2rem;
    margin-top: 2rem;
  }
  
  .action-btn {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  
  .action-btn.unknown {
    background: var(--danger-bg);
    color: var(--danger-text);
  }
  
  .action-btn.known {
    background: var(--success-bg);
    color: var(--success-text);
  }
  
  .action-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  .action-btn:active {
    transform: scale(0.95);
  }
  
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
  }
  
  .empty-icon {
    color: var(--text-muted);
    opacity: 0.5;
    margin-bottom: 1.5rem;
  }
  
  .empty-state h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }
  
  .empty-state p {
    color: var(--text-secondary);
    margin: 0;
  }
  
  @media (max-width: 480px) {
    .flashcards-container {
      padding: 1rem;
      padding-bottom: 80px;
    }
    
    .header {
      margin-bottom: 0.75rem;
    }
    
    .header-top {
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    
    h1 {
      font-size: 1.25rem;
    }
    
    .settings-btn {
      width: 32px;
      height: 32px;
    }
    
    .settings-btn svg {
      width: 16px;
      height: 16px;
    }
    
    .subtitle {
      font-size: 0.8rem;
    }
    
    .card-area {
      min-height: 0;
      flex: 1 1 auto;
      overflow: visible;
    }
    
    .card {
      max-width: 100%;
      height: calc(100vh - 200px);
      max-height: 300px;
    }
    
    .translation-card {
      max-width: 100%;
      height: calc(100vh - 200px);
      max-height: 150px;
    }
    
    .translation-front .card-text-content {
      padding: 1rem;
    }
    
    .translation-front .card-word {
      font-size: 1rem;
    }
    
    .translation-front .card-label {
      font-size: 0.65rem;
    }
    
    .action-buttons {
      margin-top: 1rem;
      gap: 1.5rem;
    }
    
    .action-btn {
      width: 56px;
      height: 56px;
    }
  }
</style>

