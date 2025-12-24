<script>
  import { onMount } from 'svelte';
  import AddCard from './components/AddCard.svelte';
  import FlashCards from './components/FlashCards.svelte';
  import CardLists from './components/CardLists.svelte';
  import { cardsStore } from './stores/cards.js';
  import { targetLanguage, getLanguageName } from './stores/language.js';
  import { loadedDictionaries, currentDictionary as currentDictionaryStore } from './stores/dictionaries.js';
  
  // Обновляем данные словаря при переключении
  $: if (currentDictionary) {
    const dictCards = {
      learned: $cardsStore.learned.filter(c => (c.dictionaryId || 'default') === currentDictionary),
      unlearned: $cardsStore.unlearned.filter(c => (c.dictionaryId || 'default') === currentDictionary),
      draft: ($cardsStore.draft || []).filter(c => (c.dictionaryId || 'default') === currentDictionary)
    };
    loadedDictionaries.updateDictionaryData(currentDictionary, dictCards);
  }
  
  let currentView = 'study';
  
  // AI Token modal
  let showTokenModal = false;
  let aiToken = '';
  let tokenSaved = false;
  let totalAiCost = 0;
  
  // User words modal
  let showUserModal = false;
  let userName = '';
  let userNameError = '';
  let isLoadingWords = false;
  let currentUserName = '';
  
  // Dictionary selector
  let showDictionaryDropdown = false;
  
  $: dictionaries = $loadedDictionaries;
  $: currentDictionary = $currentDictionaryStore;
  
  // Обновляем стоимость при открытии модалки
  function openTokenModal() {
    if (typeof localStorage !== 'undefined') {
      totalAiCost = parseFloat(localStorage.getItem('ai_total_cost') || '0');
    }
    showTokenModal = true;
  }
  
  // Форматируем стоимость для отображения
  function formatCost(cost) {
    if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    } else if (cost < 1) {
      return `$${cost.toFixed(4)}`;
    }
    return `$${cost.toFixed(2)}`;
  }
  
  
  function saveToken() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ai_token', aiToken);
      tokenSaved = true;
      setTimeout(() => {
        tokenSaved = false;
        showTokenModal = false;
      }, 1000);
    }
  }
  
  function clearToken() {
    aiToken = '';
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ai_token');
    }
  }
  
  $: hasToken = aiToken && aiToken.length > 0;
  $: hasUserName = currentUserName && currentUserName.length > 0;
  
  // Функции для работы с пользовательскими словами
  function openUserModal() {
    userName = currentUserName;
    userNameError = '';
    showUserModal = true;
  }
  
  async function loadUserWords() {
    if (!userName.trim()) {
      // Очищаем имя пользователя
      currentUserName = '';
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('user_name');
      }
      showUserModal = false;
      return;
    }
    
    isLoadingWords = true;
    userNameError = '';
    
    try {
      const baseUrl = import.meta.env.BASE_URL;
      const response = await fetch(`${baseUrl}words/${userName.trim()}.json`);
      
      if (!response.ok) {
        throw new Error('Файл не найден');
      }
      
      const data = await response.json();
      
      // Сохраняем язык из файла
      const fileLanguage = data.language || 'en';
      if (data.language) {
        targetLanguage.set(data.language);
      }
      
      // Сохраняем имя пользователя
      currentUserName = userName.trim();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user_name', currentUserName);
      }
      
      // Определяем dictionaryId
      let dictionaryId;
      if (fileLanguage === 'en') {
        dictionaryId = 'default';
        // Объединяем с 'default' - не сбрасываем карточки
      } else {
        dictionaryId = currentUserName;
        // Другой язык - удаляем только карточки этого словаря перед загрузкой нового
        cardsStore.resetDictionary(dictionaryId);
      }
      
      // Импортируем слова с dictionaryId
      cardsStore.importCards(data, dictionaryId);
      
      // Проверяем язык и объединяем с 'default' если английский
      if (fileLanguage === 'en') {
        // Проверяем, есть ли 'default' в списке
        const defaultDict = dictionaries.find(d => d.id === 'default');
        if (!defaultDict) {
          // Создаем 'default' если его нет
          const dictName = `${getLanguageName('en')} (default)`;
          loadedDictionaries.addDictionary('default', dictName, 'en', false);
        }
        
        // Переключаемся на 'default'
        currentDictionaryStore.set('default');
      } else {
        // Создаем отдельный словарь
        const dictName = `${currentUserName} (${getLanguageName(fileLanguage)})`;
        loadedDictionaries.addDictionary(currentUserName, dictName, fileLanguage, false);
        currentDictionaryStore.set(currentUserName);
      }
      
      showUserModal = false;
    } catch (error) {
      userNameError = `Файл "${userName.trim()}.json" не найден`;
    } finally {
      isLoadingWords = false;
    }
  }
  
  async function loadDictionary(dictId) {
    if (!dictId) {
      // Очищаем словарь
      currentDictionaryStore.set('');
      showDictionaryDropdown = false;
      return;
    }
    
    // Проверяем, является ли словарь импортированным или 'default'
    const dict = dictionaries.find(d => d.id === dictId);
    if (dict) {
      // Словарь уже в списке - просто переключаемся (не загружаем заново)
      currentDictionaryStore.set(dictId);
      // Устанавливаем язык словаря
      if (dict.language) {
        targetLanguage.set(dict.language);
      }
      showDictionaryDropdown = false;
      return;
    }
    
    // Сначала пытаемся загрузить с бекенда
    isLoadingWords = true;
    
    try {
      const dictLanguage = dict?.language || 'en';
      
      // Пытаемся загрузить с бекенда
      try {
        await cardsStore.loadDictionaryFromBackend(dictId, dictLanguage);
        
        // Если загрузка успешна, создаем запись в списке словарей
        const dictName = `${dictId} (${getLanguageName(dictLanguage)})`;
        loadedDictionaries.addDictionary(dictId, dictName, dictLanguage, false);
        currentDictionaryStore.set(dictId);
        if (dictLanguage) {
          targetLanguage.set(dictLanguage);
        }
        showDictionaryDropdown = false;
        isLoadingWords = false;
        return;
      } catch (backendError) {
        // Если бекенд не вернул словарь, пробуем загрузить из файла
        console.log('Словарь не найден на бекенде, пробуем загрузить из файла');
      }
      
      // Загружаем словарь из /words/
      const baseUrl = import.meta.env.BASE_URL;
      const response = await fetch(`${baseUrl}words/${dictId}.json`);
      
      if (!response.ok) {
        throw new Error('Файл не найден');
      }
      
      const data = await response.json();
      
      // Сохраняем язык из файла
      const fileLanguage = data.language || 'en';
      if (data.language) {
        targetLanguage.set(data.language);
      }
      
      // Определяем dictionaryId
      let dictionaryId;
      if (fileLanguage === 'en') {
        dictionaryId = 'default';
        // Объединяем с 'default' - не сбрасываем карточки
      } else {
        dictionaryId = dictId;
        // Другой язык - удаляем только карточки этого словаря перед загрузкой нового
        cardsStore.resetDictionary(dictionaryId);
      }
      
      // Импортируем слова с dictionaryId
      cardsStore.importCards(data, dictionaryId);
      
      // Проверяем язык и объединяем с 'default' если английский
      if (fileLanguage === 'en') {
        // Проверяем, есть ли 'default' в списке
        const defaultDict = dictionaries.find(d => d.id === 'default');
        if (!defaultDict) {
          // Создаем 'default' если его нет
          const dictName = `${getLanguageName('en')} (default)`;
          loadedDictionaries.addDictionary('default', dictName, 'en', false);
        }
        
        // Переключаемся на 'default'
        currentDictionaryStore.set('default');
      } else {
        // Создаем отдельный словарь
        const dictName = `${dictId} (${getLanguageName(fileLanguage)})`;
        loadedDictionaries.addDictionary(dictId, dictName, fileLanguage, false);
        
        // Сохраняем выбранный словарь
        currentDictionaryStore.set(dictId);
      }
      
      showDictionaryDropdown = false;
    } catch (error) {
      console.error('Ошибка загрузки словаря:', error);
      alert(`Ошибка загрузки словаря "${dictId}"`);
    } finally {
      isLoadingWords = false;
    }
  }
  
  function selectDictionary(dictId) {
    if (dictId === currentDictionary) {
      showDictionaryDropdown = false;
      return;
    }
    loadDictionary(dictId);
  }
  
  // Обновляем currentDictionary при изменении словарей, если он пустой
  $: if (dictionaries.length > 0 && (!currentDictionary || currentDictionary === '')) {
    const defaultDict = dictionaries.find(d => d.id === 'default');
    if (defaultDict) {
      currentDictionaryStore.set('default');
    } else if (dictionaries.length > 0) {
      currentDictionaryStore.set(dictionaries[0].id);
    }
  }
  
  $: currentDictionaryName = dictionaries.find(d => d.id === currentDictionary)?.name || (dictionaries.length > 0 ? 'Выберите словарь' : 'Нет словарей');
  
  // Загружаем словарь при старте, если он был сохранен
  onMount(async () => {
    // При инициализации создаем словарь "Английский (default)", если его нет
    const defaultDict = dictionaries.find(d => d.id === 'default');
    if (!defaultDict) {
      const dictName = `${getLanguageName('en')} (default)`;
      loadedDictionaries.addDictionary('default', dictName, 'en', false);
      // Устанавливаем 'default' как активный словарь, если нет другого
      if (!currentDictionary || currentDictionary === '') {
        currentDictionaryStore.set('default');
      }
    }
    
    if (currentDictionary) {
      // Проверяем, есть ли словарь в списке загруженных
      const dict = dictionaries.find(d => d.id === currentDictionary);
      if (dict && (dict.isImported || currentDictionary === 'default')) {
        // Импортированный словарь или 'default' уже в cardsStore
        // Пытаемся загрузить с бекенда для синхронизации
        try {
          await cardsStore.loadDictionaryFromBackend(currentDictionary, dict.language || 'en');
        } catch (error) {
          // Если ошибка - продолжаем работу с локальными данными
          console.log('Не удалось загрузить словарь с бекенда, используем локальные данные');
        }
        
        if (dict.language) {
          targetLanguage.set(dict.language);
        }
      } else {
        // Загружаем словарь из /words/ или с бекенда
        loadDictionary(currentDictionary);
      }
    } else {
      // Если нет активного словаря, устанавливаем 'default'
      currentDictionaryStore.set('default');
      const dict = dictionaries.find(d => d.id === 'default');
      
      // Пытаемся загрузить 'default' с бекенда
      try {
        await cardsStore.loadDictionaryFromBackend('default', 'en');
      } catch (error) {
        // Если ошибка - продолжаем работу с локальными данными
        console.log('Не удалось загрузить словарь с бекенда, используем локальные данные');
      }
      
      if (dict && dict.language) {
        targetLanguage.set(dict.language);
      }
    }
  });
  
  // Закрываем dropdown при клике вне его
  function handleClickOutside(event) {
    if (showDictionaryDropdown && !event.target.closest('.dictionary-selector')) {
      showDictionaryDropdown = false;
    }
  }
  
  function clearUserName() {
    userName = '';
    currentUserName = '';
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('user_name');
    }
  }
  
  // Вспомогательная функция для фильтрации карточек по активному словарю
  const getCardsByDictionary = (cards, dictId) => {
    return cards.filter(c => (c.dictionaryId || 'default') === dictId);
  };
  
  // Подсчитываем только карточки активного словаря
  $: activeLearned = getCardsByDictionary($cardsStore.learned, currentDictionary);
  $: activeUnlearned = getCardsByDictionary($cardsStore.unlearned, currentDictionary);
  $: activeDraft = getCardsByDictionary($cardsStore.draft || [], currentDictionary);
  
  $: totalCards = activeLearned.length + activeUnlearned.length + activeDraft.length;
  $: studyCount = activeUnlearned.length;
  $: draftCount = activeDraft.length;
</script>

<div class="app" on:click={handleClickOutside}>
  <div class="background-pattern"></div>
  
  <nav class="navbar">
    <div class="nav-brand">
      <svg width="32" height="32" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1"/>
            <stop offset="100%" style="stop-color:#a855f7"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="url(#logoGrad)"/>
        <text x="50" y="65" font-family="Arial" font-size="50" font-weight="bold" fill="white" text-anchor="middle">F</text>
      </svg>
      <span class="brand-name">Flash Words</span>
    </div>
    
    <div class="nav-stats">
      <button class="user-btn" class:has-user={hasUserName} on:click={openUserModal} title="Ввести промокод">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
        </svg>
        {#if hasUserName}
          <span class="user-indicator"></span>
        {/if}
      </button>
      <button class="ai-token-btn" class:has-token={hasToken} on:click={openTokenModal} title="Настройка AI токена">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
          <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
          <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        {#if hasToken}
          <span class="token-indicator"></span>
        {/if}
      </button>
      <div class="dictionary-selector">
        <button 
          class="dictionary-btn" 
          class:has-dictionary={currentDictionary}
          on:click|stopPropagation={() => showDictionaryDropdown = !showDictionaryDropdown}
          title="Выбрать словарь"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span class="dictionary-label">{currentDictionaryName}</span>
          <svg class="dropdown-arrow" class:open={showDictionaryDropdown} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        
        {#if showDictionaryDropdown}
          <div class="dictionary-dropdown" on:click|stopPropagation>
            {#if dictionaries.length === 0}
              <div class="dropdown-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <p>Загрузите словарь или добавьте карточку слова</p>
              </div>
            {:else}
              {#each dictionaries as dict}
                <button 
                  class="dropdown-item" 
                  class:active={currentDictionary === dict.id}
                  on:click={() => selectDictionary(dict.id)}
                >
                  <span>{dict.name}</span>
                  {#if currentDictionary === dict.id}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </nav>
  
  {#if showTokenModal}
    <div class="modal-overlay" on:click={() => showTokenModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>AI Токен</h2>
          <button class="modal-close" on:click={() => showTokenModal = false}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Введите ваш API ключ для использования AI-функций</p>
          <div class="token-input-wrapper">
            <input 
              type="password" 
              class="token-input" 
              bind:value={aiToken}
              placeholder="sk-..."
            />
            {#if hasToken}
              <button class="clear-token-btn" on:click={clearToken} title="Очистить токен">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            {/if}
          </div>
          
          {#if totalAiCost > 0}
            <div class="cost-info">
              <div class="cost-row">
                <span class="cost-label">Стоимость всех запросов:</span>
                <span class="cost-value">{formatCost(totalAiCost)}</span>
              </div>
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" on:click={() => showTokenModal = false}>Отмена</button>
          <button class="save-btn" class:saved={tokenSaved} on:click={saveToken} disabled={!aiToken.trim()}>
            {#if tokenSaved}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Сохранено
            {:else}
              Сохранить
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if showUserModal}
    <div class="modal-overlay" on:click={() => showUserModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>Загрузить слова</h2>
          <button class="modal-close" on:click={() => showUserModal = false}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Введите код для загрузки слов из персонального файла</p>
          <div class="token-input-wrapper">
            <input 
              type="text" 
              class="token-input user-input" 
              class:error={userNameError}
              bind:value={userName}
              placeholder="например: mycode"
              on:keydown={(e) => e.key === 'Enter' && loadUserWords()}
            />
            {#if userName}
              <button class="clear-token-btn" on:click={clearUserName} title="Очистить">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            {/if}
          </div>
          
          {#if userNameError}
            <p class="error-text">{userNameError}</p>
          {/if}
          
          {#if currentUserName}
            <div class="current-user-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Загружены слова: <strong>{currentUserName}</strong></span>
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" on:click={() => showUserModal = false}>Отмена</button>
          <button class="save-btn" on:click={loadUserWords} disabled={isLoadingWords}>
            {#if isLoadingWords}
              <span class="loading-spinner-small"></span>
              Загрузка...
            {:else}
              Загрузить
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <main class="main-content">
    {#if currentView === 'add'}
      <AddCard />
    {:else if currentView === 'study'}
      <FlashCards />
    {:else if currentView === 'lists'}
      <CardLists />
    {/if}
  </main>
  
  <nav class="bottom-nav">
    <button 
      class="nav-item" 
      class:active={currentView === 'add'}
      on:click={() => currentView = 'add'}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      <span>Добавить</span>
    </button>
    
    <button 
      class="nav-item study" 
      class:active={currentView === 'study'}
      on:click={() => currentView = 'study'}
    >
      <div class="study-btn-inner">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
          <path d="M12 8v8"></path>
          <path d="M8 12h8"></path>
        </svg>
        {#if studyCount > 0}
          <span class="study-badge">{studyCount}</span>
        {/if}
      </div>
      <span>Изучать</span>
    </button>
    
    <button 
      class="nav-item" 
      class:active={currentView === 'lists'}
      on:click={() => currentView = 'lists'}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
      <span>Списки</span>
    </button>
  </nav>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(html, body) {
    height: 100%;
    overflow: hidden;
  }
  
  :global(body) {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  :global(#app) {
    height: 100%;
  }
  
  :global(:root) {
    --bg-primary: #0f0f14;
    --bg-secondary: #16161d;
    --card-bg: #1a1a24;
    --border-color: #2a2a3a;
    --hover-bg: rgba(99, 102, 241, 0.1);
    
    --text-primary: #f0f0f5;
    --text-secondary: #a0a0b0;
    --text-muted: #606070;
    
    --accent-primary: #6366f1;
    --accent-secondary: #a855f7;
    --accent-glow: rgba(99, 102, 241, 0.2);
    
    --gradient-primary: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    --gradient-card: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    
    --success-bg: rgba(34, 197, 94, 0.15);
    --success-text: #22c55e;
    --danger-bg: rgba(239, 68, 68, 0.15);
    --danger-text: #ef4444;
    --warning-text: #f59e0b;
  }
  
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  
  .background-pattern {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }
  
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: rgba(15, 15, 20, 0.8);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .brand-name {
    font-size: 1.25rem;
    font-weight: 700;
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .nav-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .dictionary-selector {
    position: relative;
  }
  
  .dictionary-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--text-secondary);
    padding: 0.5rem 1rem;
    background: var(--card-bg);
    border-radius: 20px;
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  
  .dictionary-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: var(--hover-bg);
  }
  
  .dictionary-btn.has-dictionary {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  
  .dictionary-label {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .dropdown-arrow {
    transition: transform 0.2s ease;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .dropdown-arrow.open {
    transform: rotate(180deg);
  }
  
  .dictionary-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    min-width: 200px;
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
    z-index: 1000;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    animation: dropdownIn 0.2s ease;
  }
  
  @keyframes dropdownIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 1px solid var(--border-color);
  }
  
  .dropdown-item:last-child {
    border-bottom: none;
  }
  
  .dropdown-item:hover {
    background: var(--hover-bg);
  }
  
  .dropdown-item.active {
    background: var(--hover-bg);
    color: var(--accent-primary);
  }
  
  .dropdown-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem 1.5rem;
    text-align: center;
    color: var(--text-secondary);
  }
  
  .dropdown-empty svg {
    color: var(--text-muted);
    opacity: 0.5;
  }
  
  .dropdown-empty p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.4;
  }
  
  .ai-token-btn,
  .user-btn {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .ai-token-btn:hover,
  .user-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: var(--hover-bg);
  }
  
  .ai-token-btn.has-token {
    border-color: var(--success-text);
    color: var(--success-text);
  }
  
  .user-btn.has-user {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  
  .token-indicator,
  .user-indicator {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    background: var(--success-text);
    border-radius: 50%;
    border: 2px solid var(--bg-primary);
  }
  
  .user-indicator {
    background: var(--accent-primary);
  }
  
  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .modal {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
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
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  
  .modal-close {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 10px;
    transition: all 0.2s ease;
  }
  
  .modal-close:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .modal-description {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
  }
  
  .token-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .token-input {
    width: 100%;
    padding: 1rem 1.25rem;
    padding-right: 3rem;
    font-size: 1rem;
    font-family: 'JetBrains Mono', monospace;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    color: var(--text-primary);
    transition: all 0.2s ease;
  }
  
  .token-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }
  
  .token-input::placeholder {
    color: var(--text-muted);
  }
  
  .clear-token-btn {
    position: absolute;
    right: 0.75rem;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--danger-bg);
    border: none;
    border-radius: 8px;
    color: var(--danger-text);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .clear-token-btn:hover {
    background: var(--danger-text);
    color: white;
  }
  
  .cost-info {
    margin-top: 1.25rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
  }
  
  .cost-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .cost-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .cost-value {
    font-size: 1rem;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    color: var(--accent-primary);
  }
  
  .modal-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem 1.5rem;
  }
  
  .cancel-btn, .save-btn {
    flex: 1;
    padding: 0.875rem 1.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: inherit;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .cancel-btn {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    color: var(--text-secondary);
  }
  
  .cancel-btn:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }
  
  .save-btn {
    background: var(--gradient-primary);
    border: none;
    color: white;
  }
  
  .save-btn:hover:not(:disabled) {
    box-shadow: 0 4px 15px var(--accent-glow);
    transform: translateY(-1px);
  }
  
  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .save-btn.saved {
    background: var(--success-text);
  }
  
  /* User modal styles */
  .user-input {
    font-family: inherit;
  }
  
  .user-input.error {
    border-color: var(--danger-text);
  }
  
  .error-text {
    color: var(--danger-text);
    font-size: 0.85rem;
    margin: 0.75rem 0 0 0;
  }
  
  .current-user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: var(--success-bg);
    border: 1px solid var(--success-text);
    border-radius: 10px;
    font-size: 0.85rem;
    color: var(--success-text);
  }
  
  .current-user-info strong {
    font-family: 'JetBrains Mono', monospace;
  }
  
  .loading-spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .main-content {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0.5rem 1rem 0.75rem;
    background: rgba(15, 15, 20, 0.95);
    backdrop-filter: blur(15px);
    border-top: 1px solid var(--border-color);
    z-index: 100;
  }
  
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 12px;
  }
  
  .nav-item:not(.study) svg {
    width: 20px;
    height: 20px;
  }
  
  .nav-item:hover {
    color: var(--text-secondary);
  }
  
  .nav-item.active {
    color: var(--accent-primary);
  }
  
  .nav-item.study {
    position: relative;
    margin-bottom: 0;
  }
  
  .study-btn-inner {
    position: relative;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gradient-primary);
    border-radius: 50%;
    box-shadow: 0 4px 20px var(--accent-glow);
    transition: all 0.3s ease;
  }
  
  .nav-item.study .study-btn-inner svg {
    stroke: white;
    width: 22px;
    height: 22px;
  }
  
  .nav-item.study:hover .study-btn-inner {
    transform: scale(1.05);
    box-shadow: 0 6px 25px rgba(99, 102, 241, 0.4);
  }
  
  .nav-item.study.active .study-btn-inner {
    box-shadow: 0 6px 30px rgba(99, 102, 241, 0.5);
  }
  
  .study-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: white !important;
    background: #ef4444;
    border-radius: 10px;
    padding: 0 0.375rem;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  }
  
  .nav-item.study span:last-child {
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }
  
  .nav-item.study.active span:last-child {
    color: var(--accent-primary);
  }
  
  @media (max-width: 480px) {
    .brand-name {
      display: none;
    }
    
    .navbar {
      padding: 0.75rem 1rem;
    }
    
    .dictionary-btn {
      padding: 0.4rem 0.6rem;
      font-size: 0.75rem;
      max-width: 120px;
    }
    
    .dictionary-label {
      max-width: 80px;
    }
    
    .bottom-nav {
      padding: 0.5rem 0.75rem 0.75rem;
      height: auto;
    }
    
    .nav-item {
      flex-direction: row;
      gap: 0.25rem;
      padding: 0;
      font-size: 0;
      width: 36px;
      height: 36px;
      min-width: 36px;
      justify-content: center;
      align-items: center;
    }
    
    .nav-item span {
      display: none;
    }
    
    .nav-item.study {
      margin-bottom: 0;
      width: auto;
      height: auto;
      min-width: auto;
    }
    
    .study-btn-inner {
      width: 40px;
      height: 40px;
    }
    
    .nav-item.study .study-btn-inner svg {
      width: 20px;
      height: 20px;
    }
    
    .nav-item:not(.study) svg {
      width: 22px;
      height: 22px;
    }
  }
</style>

