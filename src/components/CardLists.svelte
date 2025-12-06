<script>
  import { cardsStore } from '../stores/cards.js';
  
  let activeTab = 'draft';
  let searchQuery = '';
  
  // Edit modal state
  let showEditModal = false;
  let editingCard = null;
  let editWord = '';
  let editTranslation = '';
  let editAssociation = '';
  let editImageUrl = '';
  let imageError = false;
  
  // Original values to track changes
  let originalWord = '';
  let originalTranslation = '';
  let originalAssociation = '';
  let originalImageUrl = '';
  
  $: hasUnsavedChanges = editingCard && (
    editWord !== originalWord ||
    editTranslation !== originalTranslation ||
    editAssociation !== originalAssociation ||
    editImageUrl !== originalImageUrl
  );
  
  $: learned = $cardsStore.learned;
  $: unlearned = $cardsStore.unlearned;
  $: draft = $cardsStore.draft || [];
  $: baseList = activeTab === 'learned' ? learned : activeTab === 'unlearned' ? unlearned : draft;
  
  // Фильтрация по поиску
  $: currentList = searchQuery.trim() 
    ? baseList.filter(card => 
        card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.translation && card.translation.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : baseList;
  
  function moveToStudy(cardId) {
    cardsStore.moveToStudy(cardId);
  }
  
  function deleteCard(cardId) {
    cardsStore.deleteCard(cardId, activeTab);
  }
  
  function openEditModal(card) {
    editingCard = card;
    editWord = card.word;
    editTranslation = card.translation || '';
    editAssociation = card.association || '';
    editImageUrl = card.imageUrl || '';
    
    // Save original values
    originalWord = card.word;
    originalTranslation = card.translation || '';
    originalAssociation = card.association || '';
    originalImageUrl = card.imageUrl || '';
    
    imageError = false;
    showEditModal = true;
  }
  
  function closeEditModal(force = false) {
    if (!force && hasUnsavedChanges) {
      if (!confirm('У вас есть несохранённые изменения. Закрыть без сохранения?')) {
        return;
      }
    }
    showEditModal = false;
    editingCard = null;
  }
  
  function forceCloseEditModal() {
    showEditModal = false;
    editingCard = null;
  }
  
  function saveEdit() {
    if (editWord.trim() && editingCard) {
      if (activeTab === 'draft') {
        // Для draft карточек используем специальный метод
        cardsStore.editDraftCard(editingCard.id, {
          word: editWord.trim(),
          translation: editTranslation.trim(),
          association: editAssociation.trim(),
          imageUrl: editImageUrl.trim()
        });
      } else if (editTranslation.trim()) {
        cardsStore.editCard(editingCard.id, activeTab, {
          word: editWord.trim(),
          translation: editTranslation.trim(),
          association: editAssociation.trim(),
          imageUrl: editImageUrl.trim()
        });
      }
      forceCloseEditModal();
    }
  }
  
  function isCardReady(card) {
    return card.translation?.trim() && card.imageUrl?.trim();
  }
  
  function handleImageError() {
    imageError = true;
  }
  
  function handleImageLoad() {
    imageError = false;
  }
  
  function removeImage() {
    editImageUrl = '';
  }
  
  function exportToJson() {
    const data = {
      learned: $cardsStore.learned,
      unlearned: $cardsStore.unlearned,
      draft: $cardsStore.draft || [],
      exportedAt: new Date().toISOString()
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flash-words-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function moveAllToStudy() {
    if (learned.length > 0 && confirm(`Отправить все ${learned.length} слов на повторение?`)) {
      cardsStore.moveAllToStudy();
    }
  }
</script>

<div class="lists-container">
  <div class="header">
    <div class="header-top">
      <h1>Мои карточки</h1>
      <button class="export-btn" on:click={exportToJson} title="Экспорт в JSON">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    </div>
    <p class="subtitle">Управляйте вашими словами</p>
  </div>
  
  <div class="tabs">
    <button 
      class="tab" 
      class:active={activeTab === 'draft'}
      on:click={() => activeTab = 'draft'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      На проработку
      <span class="badge">{draft.length}</span>
    </button>
    <button 
      class="tab" 
      class:active={activeTab === 'unlearned'}
      on:click={() => activeTab = 'unlearned'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      На повторение
      <span class="badge">{unlearned.length}</span>
    </button>
    <button 
      class="tab" 
      class:active={activeTab === 'learned'}
      on:click={() => activeTab = 'learned'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Изученные
      <span class="badge">{learned.length}</span>
    </button>
  </div>
  
  <div class="search-box">
    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    <input 
      type="text" 
      class="search-input"
      bind:value={searchQuery}
      placeholder="Поиск слова..."
    />
    {#if searchQuery}
      <button class="search-clear" on:click={() => searchQuery = ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </div>
  
  {#if activeTab === 'learned' && learned.length > 0}
    <div class="bulk-actions">
      <button class="bulk-action-btn" on:click={moveAllToStudy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        Отправить все на повторение
      </button>
    </div>
  {/if}
  
  <div class="cards-list">
    {#if currentList.length > 0}
      {#each currentList as card (card.id)}
        <div class="card-item" class:draft-card={activeTab === 'draft'}>
          {#if card.imageUrl}
            <div class="card-thumbnail">
              <img src={card.imageUrl} alt="" />
            </div>
          {:else if activeTab === 'draft'}
            <div class="card-thumbnail missing">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
          {/if}
          <div class="card-content">
            <h3 class="card-word">{card.word}</h3>
            {#if card.translation}
              <p class="card-translation">{card.translation}</p>
            {:else if activeTab === 'draft'}
              <p class="card-translation missing-text">Добавьте перевод</p>
            {/if}
            {#if card.association}
              <p class="card-association">{card.association}</p>
            {/if}
            {#if activeTab === 'draft'}
              <div class="draft-status">
                <span class="status-item" class:complete={card.translation?.trim()}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {#if card.translation?.trim()}
                      <polyline points="20 6 9 17 4 12"></polyline>
                    {:else}
                      <circle cx="12" cy="12" r="10"></circle>
                    {/if}
                  </svg>
                  Перевод
                </span>
                <span class="status-item" class:complete={card.imageUrl?.trim()}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {#if card.imageUrl?.trim()}
                      <polyline points="20 6 9 17 4 12"></polyline>
                    {:else}
                      <circle cx="12" cy="12" r="10"></circle>
                    {/if}
                  </svg>
                  Картинка
                </span>
              </div>
            {/if}
          </div>
          <div class="card-actions">
            <button class="action-btn edit" on:click={() => openEditModal(card)} title="Редактировать">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            {#if activeTab === 'learned'}
              <button class="action-btn return" on:click={() => moveToStudy(card.id)} title="Вернуть на повторение">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
              </button>
            {/if}
            <button class="action-btn delete" on:click={() => deleteCard(card.id)} title="Удалить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          {#if activeTab === 'learned'}
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="16 10 11 15 8 12"></polyline>
            </svg>
          {:else if activeTab === 'draft'}
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          {:else}
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          {/if}
        </div>
        <h2>
          {#if activeTab === 'learned'}
            Пока нет изученных слов
          {:else if activeTab === 'draft'}
            Нет слов на проработку
          {:else}
            Нет слов на повторение
          {/if}
        </h2>
        <p>
          {#if activeTab === 'learned'}
            Изучайте карточки, чтобы они появились здесь
          {:else if activeTab === 'draft'}
            Загрузите список слов на странице добавления
          {:else}
            Все слова успешно изучены!
          {/if}
        </p>
      </div>
    {/if}
  </div>
</div>

{#if showEditModal}
  <div class="modal-overlay" on:click={() => closeEditModal()} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && closeEditModal()}>
    <div class="modal" on:click|stopPropagation role="dialog">
      <div class="modal-header">
        <h2>Редактировать карточку</h2>
        <button class="modal-close" on:click={() => closeEditModal()}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="input-group">
          <label for="editWord">
            Слово на английском
            <span class="char-count" class:limit={editWord.length >= 35}>{editWord.length}/35</span>
          </label>
          <input 
            id="editWord"
            type="text" 
            bind:value={editWord}
            placeholder="например: serendipity"
            maxlength="35"
            required
          />
        </div>
        
        <div class="input-group">
          <label for="editTranslation">
            Перевод
            <span class="char-count" class:limit={editTranslation.length >= 50}>{editTranslation.length}/50</span>
          </label>
          <input 
            id="editTranslation"
            type="text" 
            bind:value={editTranslation}
            placeholder="например: счастливая случайность"
            maxlength="50"
            required
          />
        </div>
        
        <div class="input-group">
          <label for="editAssociation">
            Ассоциация 
            <span class="optional">(необязательно)</span>
            <span class="char-count" class:limit={editAssociation.length >= 95}>{editAssociation.length}/95</span>
          </label>
          <textarea 
            id="editAssociation"
            bind:value={editAssociation}
            placeholder="например: представьте, как вы случайно находите клад"
            maxlength="95"
            rows="2"
          />
        </div>
        
        <div class="input-group">
          <label for="editImageUrl">
            Изображение 
            <span class="optional">(URL)</span>
          </label>
          <input 
            id="editImageUrl"
            type="url" 
            bind:value={editImageUrl}
            placeholder="https://example.com/image.jpg"
          />
        </div>
        
        {#if editImageUrl}
          <div class="image-preview-container">
            {#if imageError}
              <div class="image-error">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Ошибка загрузки</span>
              </div>
            {:else}
              <img 
                src={editImageUrl} 
                alt="Превью" 
                class="modal-image-preview"
                on:error={handleImageError}
                on:load={handleImageLoad}
              />
            {/if}
            <button class="remove-image-btn" on:click={removeImage} title="Удалить изображение">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        {/if}
      </div>
      
      <div class="modal-actions">
        {#if activeTab === 'draft' && editTranslation.trim() && editImageUrl.trim()}
          <span class="ready-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Карточка будет активирована
          </span>
        {/if}
        <button class="btn-secondary" on:click={() => closeEditModal()}>
          Отмена
        </button>
        <button class="btn-primary" on:click={saveEdit} disabled={!editWord.trim() || (activeTab !== 'draft' && !editTranslation.trim())}>
          Сохранить
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .lists-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    padding-bottom: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .header {
    text-align: center;
    margin-bottom: 2rem;
    flex-shrink: 0;
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
  
  .export-btn {
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
  
  .export-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: var(--hover-bg);
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin: 0;
  }
  
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    background: var(--card-bg);
    padding: 0.5rem;
    border-radius: 16px;
    border: 2px solid var(--border-color);
    flex-shrink: 0;
    overflow: hidden;
  }
  
  .tab {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.75rem 0.5rem;
    font-size: 0.8rem;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  
  .tab:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }
  
  .tab.active {
    color: white;
    background: var(--gradient-primary);
    box-shadow: 0 4px 15px var(--accent-glow);
  }
  
  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.2);
  }
  
  .tab:not(.active) .badge {
    background: var(--hover-bg);
  }
  
  /* Search Box */
  .search-box {
    position: relative;
    margin-bottom: 1rem;
    flex-shrink: 0;
  }
  
  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }
  
  .search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 2.75rem;
    font-size: 0.95rem;
    font-family: inherit;
    border: 2px solid var(--border-color);
    border-radius: 12px;
    background: var(--card-bg);
    color: var(--text-primary);
    transition: all 0.2s ease;
    box-sizing: border-box;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }
  
  .search-input::placeholder {
    color: var(--text-muted);
  }
  
  .search-clear {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hover-bg);
    border: none;
    border-radius: 8px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .search-clear:hover {
    background: var(--border-color);
    color: var(--text-primary);
  }
  
  .bulk-actions {
    margin-bottom: 1rem;
    flex-shrink: 0;
  }
  
  .bulk-action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    color: var(--accent-primary);
    background: var(--accent-glow);
    border: 2px solid var(--accent-primary);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .bulk-action-btn:hover {
    background: var(--accent-primary);
    color: white;
  }
  
  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    overflow-y: auto;
    padding-bottom: 150px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .cards-list::-webkit-scrollbar {
    display: none;
  }
  
  .card-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 16px;
    transition: all 0.2s ease;
  }
  
  .card-item:hover {
    border-color: var(--accent-primary);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }
  
  .card-thumbnail {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--bg-secondary);
  }
  
  .card-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .card-content {
    flex: 1;
    min-width: 0;
  }
  
  .card-word {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .card-translation {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
  }
  
  .card-association {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0.5rem 0 0 0;
    font-style: italic;
  }
  
  .card-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  
  .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .action-btn.edit {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
  
  .action-btn.return {
    background: var(--accent-glow);
    color: var(--accent-primary);
  }
  
  .action-btn.delete {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
  
  .action-btn:hover {
    transform: scale(1.1);
  }
  
  /* Draft card styles */
  .draft-card {
    border-color: var(--warning-text);
    border-style: dashed;
  }
  
  .card-thumbnail.missing {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    background: var(--hover-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    border: 2px dashed var(--border-color);
    flex-shrink: 0;
  }
  
  .missing-text {
    color: var(--text-muted);
    font-style: italic;
  }
  
  .draft-status {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 0.125rem 0.5rem;
    background: var(--hover-bg);
    border-radius: 6px;
  }
  
  .status-item.complete {
    color: var(--success-text);
    background: var(--success-bg);
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem 2rem;
  }
  
  .empty-icon {
    color: var(--text-muted);
    opacity: 0.5;
    margin-bottom: 1.5rem;
  }
  
  .empty-state h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }
  
  .empty-state p {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.9rem;
  }
  
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 9999;
    padding: 2rem 1rem;
    overflow-y: auto;
  }
  
  .modal {
    width: 100%;
    max-width: 480px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    animation: modalIn 0.3s ease;
    margin: auto;
    flex-shrink: 0;
  }
  
  @keyframes modalIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
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
    font-size: 1.125rem;
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
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .input-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .optional {
    color: var(--text-muted);
    font-weight: 400;
  }
  
  .char-count {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-left: auto;
  }
  
  .char-count.limit {
    color: var(--warning-text);
  }
  
  .input-group input,
  .input-group textarea {
    width: 100%;
    padding: 0.875rem 1rem;
    font-size: 1rem;
    font-family: inherit;
    border: 2px solid var(--border-color);
    border-radius: 12px;
    background: var(--card-bg);
    color: var(--text-primary);
    transition: all 0.2s ease;
    box-sizing: border-box;
  }
  
  .input-group input:focus,
  .input-group textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }
  
  .input-group input::placeholder,
  .input-group textarea::placeholder {
    color: var(--text-muted);
  }
  
  .input-group textarea {
    resize: vertical;
    min-height: 70px;
  }
  
  .image-preview-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16/10;
    background: var(--card-bg);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .modal-image-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .image-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--danger-text);
    text-align: center;
    font-size: 0.875rem;
  }
  
  .remove-image-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .remove-image-btn:hover {
    background: rgba(239, 68, 68, 0.8);
  }
  
  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color);
    background: var(--card-bg);
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }
  
  .btn-primary {
    background: var(--gradient-primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 4px 15px var(--accent-glow);
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  
  .btn-secondary:hover {
    background: var(--border-color);
  }
  
  .ready-hint {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--success-text);
    margin-right: auto;
  }
</style>
