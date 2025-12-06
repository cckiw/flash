<script>
  import AddCard from './components/AddCard.svelte';
  import FlashCards from './components/FlashCards.svelte';
  import CardLists from './components/CardLists.svelte';
  import { cardsStore } from './stores/cards.js';
  import { targetLanguage } from './stores/language.js';
  
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
  
  // Загружаем токен, стоимость и имя пользователя из localStorage при старте
  if (typeof localStorage !== 'undefined') {
    aiToken = localStorage.getItem('ai_token') || '';
    totalAiCost = parseFloat(localStorage.getItem('ai_total_cost') || '0');
    currentUserName = localStorage.getItem('user_name') || '';
    userName = currentUserName;
  }
  
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
      const response = await fetch(`/words/${userName.trim()}.json`);
      
      if (!response.ok) {
        throw new Error('Файл не найден');
      }
      
      const data = await response.json();
      
      // Сохраняем язык из файла
      if (data.language) {
        targetLanguage.set(data.language);
      }
      
      // Импортируем слова
      cardsStore.importCards(data);
      
      // Сохраняем имя пользователя
      currentUserName = userName.trim();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user_name', currentUserName);
      }
      
      showUserModal = false;
    } catch (error) {
      userNameError = `Файл "${userName.trim()}.json" не найден`;
    } finally {
      isLoadingWords = false;
    }
  }
  
  function clearUserName() {
    userName = '';
    currentUserName = '';
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('user_name');
    }
  }
  
  $: totalCards = $cardsStore.learned.length + $cardsStore.unlearned.length + ($cardsStore.draft?.length || 0);
  $: studyCount = $cardsStore.unlearned.length;
  $: draftCount = $cardsStore.draft?.length || 0;
</script>

<div class="app">
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
      <button class="user-btn" class:has-user={hasUserName} on:click={openUserModal} title="Загрузить слова пользователя">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
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
      <button class="stat" on:click={() => currentView = 'lists'}>{totalCards} слов</button>
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
          <p class="modal-description">Введите имя для загрузки персональных слов из файла</p>
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
  
  .stat {
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--text-secondary);
    padding: 0.5rem 1rem;
    background: var(--card-bg);
    border-radius: 20px;
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .stat:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: var(--hover-bg);
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
    align-items: flex-end;
    justify-content: space-around;
    padding: 0.75rem 1rem 1.25rem;
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
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 12px;
  }
  
  .nav-item:hover {
    color: var(--text-secondary);
  }
  
  .nav-item.active {
    color: var(--accent-primary);
  }
  
  .nav-item.study {
    position: relative;
    margin-bottom: 0.5rem;
  }
  
  .study-btn-inner {
    position: relative;
    width: 56px;
    height: 56px;
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
    color: white;
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
  }
</style>

