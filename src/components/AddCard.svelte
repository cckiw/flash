<script>
  import { cardsStore } from '../stores/cards.js';
  import { targetLanguage, getLanguageName } from '../stores/language.js';
  import { loadedDictionaries, currentDictionary as currentDictionaryStore } from '../stores/dictionaries.js';
  
  $: languageName = getLanguageName($targetLanguage);
  
  let word = '';
  let translation = '';
  let association = '';
  let imageUrl = '';
  let showSuccess = false;
  let showImageModal = false;
  let tempImageUrl = '';
  let imageError = false;
  let importCount = 0;
  let showImportSuccess = false;
  
  // Bulk import modal state
  let showBulkModal = false;
  let bulkWords = '';
  let bulkImportCount = 0;
  let showBulkSuccess = false;
  
  function handleSubmit() {
    if (word.trim() && translation.trim()) {
      // Получаем активный словарь
      let activeDict = typeof localStorage !== 'undefined' 
        ? localStorage.getItem('current_dictionary') || ''
        : '';
      
      // Проверяем, есть ли вообще словари
      const hasDictionaries = $loadedDictionaries.length > 0;
      
      // Если словарей нет или активный словарь не установлен, создаем 'default' и устанавливаем его активным
      if (!hasDictionaries || !activeDict || activeDict === '') {
        const dictName = `${getLanguageName('en')} (default)`;
        loadedDictionaries.addDictionary('default', dictName, 'en', false);
        currentDictionaryStore.set('default');
        activeDict = 'default';
      }
      
      const dictionaryId = activeDict || 'default';
      const currentLanguage = $targetLanguage || 'en';
      cardsStore.addCard(word.trim(), translation.trim(), association.trim(), imageUrl.trim(), dictionaryId, currentLanguage);
      
      word = '';
      translation = '';
      association = '';
      imageUrl = '';
      showSuccess = true;
      setTimeout(() => showSuccess = false, 2000);
    }
  }
  
  function openImageModal() {
    tempImageUrl = imageUrl;
    imageError = false;
    showImageModal = true;
  }
  
  function saveImage() {
    if (tempImageUrl.trim()) {
      imageUrl = tempImageUrl.trim();
    }
    showImageModal = false;
  }
  
  function removeImage() {
    imageUrl = '';
    tempImageUrl = '';
    showImageModal = false;
  }
  
  function handleImageError() {
    imageError = true;
  }
  
  function handleImageLoad() {
    imageError = false;
  }
  
  let fileInput;
  
  function handleImportClick() {
    fileInput.click();
  }
  
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Используем имя файла (без расширения) как ID словаря
        const fileName = file.name.replace(/\.json$/i, '');
        
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
          dictionaryId = fileName;
          // Другой язык - удаляем только карточки этого словаря перед импортом нового
          cardsStore.resetDictionary(dictionaryId);
        }
        
        // Импортируем слова с dictionaryId
        const totalBefore = ($cardsStore.learned?.length || 0) + ($cardsStore.unlearned?.length || 0) + ($cardsStore.draft?.length || 0);
        cardsStore.importCards(data, dictionaryId);
        
        // Проверяем язык и объединяем с 'default' если английский
        if (fileLanguage === 'en') {
          // Объединяем с 'default'
          const defaultDict = $loadedDictionaries.find(d => d.id === 'default');
          if (!defaultDict) {
            // Создаем 'default' если его нет
            const dictName = `${getLanguageName('en')} (default)`;
            loadedDictionaries.addDictionary('default', dictName, 'en', true);
          }
          currentDictionaryStore.set('default');
        } else {
          // Другой язык - создаем отдельный словарь
          const dictName = `${fileName} (${getLanguageName(fileLanguage)})`;
          loadedDictionaries.addDictionary(fileName, dictName, fileLanguage, true);
          currentDictionaryStore.set(fileName);
        }
        
        // Подсчитаем сколько добавлено
        setTimeout(() => {
          const totalAfter = ($cardsStore.learned?.length || 0) + ($cardsStore.unlearned?.length || 0) + ($cardsStore.draft?.length || 0);
          importCount = totalAfter - totalBefore;
          showImportSuccess = true;
          setTimeout(() => showImportSuccess = false, 3000);
        }, 100);
      } catch (error) {
        alert('Ошибка чтения файла. Убедитесь, что это корректный JSON файл.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
  
  function openBulkModal() {
    bulkWords = '';
    showBulkModal = true;
  }
  
  function closeBulkModal() {
    showBulkModal = false;
    bulkWords = '';
  }
  
  function handleBulkImport() {
    const words = bulkWords
      .split('\n')
      .map(w => w.trim())
      .filter(w => w.length > 0);
    
    if (words.length > 0) {
      // Получаем активный словарь
      const activeDict = typeof localStorage !== 'undefined' 
        ? localStorage.getItem('current_dictionary') || 'default'
        : 'default';
      
      // Если словаря нет, создаем 'default' и устанавливаем его активным
      if (!activeDict || activeDict === '') {
        const dictName = `${getLanguageName('en')} (default)`;
        loadedDictionaries.addDictionary('default', dictName, 'en', false);
        currentDictionaryStore.set('default');
      }
      
      const dictionaryId = activeDict || 'default';
      const currentLanguage = $targetLanguage || 'en';
      const draftBefore = $cardsStore.draft?.length || 0;
      cardsStore.addDraftCards(words, dictionaryId, currentLanguage);
      
      setTimeout(() => {
        const draftAfter = $cardsStore.draft?.length || 0;
        bulkImportCount = draftAfter - draftBefore;
        showBulkSuccess = true;
        setTimeout(() => showBulkSuccess = false, 3000);
      }, 100);
    }
    
    closeBulkModal();
  }
  
  $: wordCount = bulkWords.split('\n').filter(w => w.trim().length > 0).length;
</script>

<input 
  type="file" 
  accept=".json"
  bind:this={fileInput}
  on:change={handleFileSelect}
  style="display: none;"
/>

<div class="add-card-container">
  <div class="header">
    <div class="header-top">
      <h1>Новая карточка</h1>
      <div class="header-actions">
        <button type="button" class="import-btn bulk" on:click={openBulkModal} title="Загрузить список слов">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
        <button type="button" class="import-btn" on:click={handleImportClick} title="Импорт из JSON">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </button>
      </div>
    </div>
    <p class="subtitle">Добавьте слово для изучения</p>
  </div>
  
  <div class="card-editor">
    <form on:submit|preventDefault={handleSubmit} class="form">
      <div class="input-group">
        <label for="word">
          Слово ({languageName.toLowerCase()})
          <span class="char-count" class:limit={word.length >= 35}>{word.length}/35</span>
        </label>
        <input 
          id="word"
          type="text" 
          bind:value={word}
          placeholder="например: serendipity"
          maxlength="35"
          required
        />
      </div>
      
      <div class="input-group">
        <label for="translation">
          Перевод
          <span class="char-count" class:limit={translation.length >= 50}>{translation.length}/50</span>
        </label>
        <input 
          id="translation"
          type="text" 
          bind:value={translation}
          placeholder="например: счастливая случайность"
          maxlength="50"
          required
        />
      </div>
      
      <div class="input-group">
        <label for="association">
          Ассоциация 
          <span class="optional">(необязательно)</span>
          <span class="char-count" class:limit={association.length >= 95}>{association.length}/95</span>
        </label>
        <textarea 
          id="association"
          bind:value={association}
          placeholder="например: представьте, как вы случайно находите клад под деревом"
          maxlength="95"
          rows="2"
        />
      </div>
      
      <button type="submit" class="submit-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Добавить карточку
      </button>
    </form>
    
    <div class="card-preview-wrapper">
      <span class="preview-label">Превью карточки</span>
      <button 
        type="button"
        class="card-preview" 
        on:click={openImageModal}
        class:has-image={imageUrl}
      >
        {#if imageUrl}
          <img src={imageUrl} alt="Превью" class="preview-image" on:error={handleImageError} />
        {:else}
          <div class="image-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Нажмите, чтобы добавить изображение</span>
          </div>
        {/if}
        
        <div class="card-content-preview">
          <div class="preview-word">{word || 'Слово'}</div>
          <div class="preview-translation">{translation || 'Перевод'}</div>
        </div>
      </button>
    </div>
  </div>
  
  {#if showSuccess}
    <div class="success-toast">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Карточка добавлена!
    </div>
  {/if}
  
  {#if showImportSuccess}
    <div class="success-toast import">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      {importCount > 0 ? `Импортировано ${importCount} карточек!` : 'Новых карточек не найдено'}
    </div>
  {/if}
  
  {#if showBulkSuccess}
    <div class="success-toast bulk">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
      {bulkImportCount > 0 ? `Добавлено ${bulkImportCount} слов на проработку!` : 'Новых слов не найдено (возможно дубликаты)'}
    </div>
  {/if}
</div>

{#if showImageModal}
  <div class="modal-overlay" on:click={() => showImageModal = false} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && (showImageModal = false)}>
    <div class="modal" on:click|stopPropagation role="dialog">
      <div class="modal-header">
        <h2>Добавить изображение</h2>
        <button class="modal-close" on:click={() => showImageModal = false}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="input-group">
          <label for="imageUrl">
            Ссылка на изображение
            <span class="optional">(необязательно)</span>
          </label>
          <input 
            id="imageUrl"
            type="url" 
            bind:value={tempImageUrl}
            placeholder="https://example.com/image.jpg"
          />
        </div>
        
        {#if tempImageUrl}
          <div class="image-preview-container">
            {#if imageError}
              <div class="image-error">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Не удалось загрузить изображение</span>
              </div>
            {:else}
              <img 
                src={tempImageUrl} 
                alt="Превью изображения" 
                class="modal-image-preview"
                on:error={handleImageError}
                on:load={handleImageLoad}
              />
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="modal-actions">
        {#if imageUrl}
          <button class="btn-secondary danger" on:click={removeImage}>
            Удалить
          </button>
        {/if}
        <button class="btn-secondary" on:click={() => showImageModal = false}>
          Отмена
        </button>
        <button class="btn-primary" on:click={saveImage} disabled={imageError && tempImageUrl}>
          Сохранить
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showBulkModal}
  <div class="modal-overlay" on:click={closeBulkModal} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && closeBulkModal()}>
    <div class="modal bulk-modal" on:click|stopPropagation role="dialog">
      <div class="modal-header">
        <h2>Загрузить список слов</h2>
        <button class="modal-close" on:click={closeBulkModal}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="bulk-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <p>Введите слова списком — каждое слово на новой строке. Слова будут добавлены в раздел "На проработку", где вы сможете добавить перевод и изображение.</p>
        </div>
        
        <div class="input-group">
          <label for="bulkWords">
            Слова
            {#if wordCount > 0}
              <span class="word-count">{wordCount} {wordCount === 1 ? 'слово' : wordCount < 5 ? 'слова' : 'слов'}</span>
            {/if}
          </label>
          <textarea 
            id="bulkWords"
            bind:value={bulkWords}
            placeholder="serendipity
ephemeral
ubiquitous
eloquent
resilient"
            rows="10"
            class="bulk-textarea"
          />
        </div>
      </div>
      
      <div class="modal-actions">
        <button class="btn-secondary" on:click={closeBulkModal}>
          Отмена
        </button>
        <button class="btn-primary" on:click={handleBulkImport} disabled={wordCount === 0}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Добавить {wordCount > 0 ? wordCount : ''} {wordCount === 1 ? 'слово' : wordCount > 1 && wordCount < 5 ? 'слова' : wordCount >= 5 ? 'слов' : ''}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .add-card-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
    padding-bottom: 150px;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .add-card-container::-webkit-scrollbar {
    display: none;
  }
  
  .header {
    text-align: center;
    margin-bottom: 2.5rem;
  }
  
  .header-top {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  /* Desktop: кнопки рядом с заголовком */
  @media (min-width: 768px) {
    .header-top {
      flex-direction: row;
      justify-content: center;
      gap: 1rem;
    }
  }
  
  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }
  
  .import-btn {
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
  
  .import-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: var(--hover-bg);
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin: 0;
  }
  
  .card-editor {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 2rem;
    align-items: start;
  }
  
  @media (max-width: 768px) {
    .card-editor {
      grid-template-columns: 1fr;
    }
    
    .card-preview-wrapper {
      order: -1;
    }
  }
  
  .form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  label {
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
  
  input, textarea {
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
  
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }
  
  input::placeholder, textarea::placeholder {
    color: var(--text-muted);
  }
  
  textarea {
    resize: vertical;
    min-height: 80px;
  }
  
  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    padding: 1rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    font-family: inherit;
    color: white;
    background: var(--gradient-primary);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 2rem;
    margin-top: 0.5rem;
  }
  
  .submit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px var(--accent-glow);
  }
  
  .submit-btn:active {
    transform: translateY(0);
  }
  
  /* Card Preview */
  .card-preview-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .preview-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-align: center;
  }
  
  .card-preview {
    position: relative;
    width: 100%;
    aspect-ratio: 3/4;
    background: var(--card-bg);
    border: 2px dashed var(--border-color);
    border-radius: 20px;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    padding: 0;
    font-family: inherit;
    color: inherit;
  }
  
  .card-preview:hover {
    border-color: var(--accent-primary);
    box-shadow: 0 8px 30px rgba(99, 102, 241, 0.15);
    transform: translateY(-4px);
  }
  
  .card-preview.has-image {
    border-style: solid;
  }
  
  .preview-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 60%;
    object-fit: cover;
  }
  
  .image-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--text-muted);
    padding: 1rem;
    text-align: center;
  }
  
  .image-placeholder span {
    font-size: 0.8rem;
    line-height: 1.4;
  }
  
  .card-content-preview {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1.25rem;
    background: linear-gradient(to top, var(--card-bg) 70%, transparent);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .card-preview.has-image .card-content-preview {
    background: linear-gradient(to top, rgba(15, 15, 20, 0.95) 60%, transparent);
  }
  
  .preview-word {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }
  
  .preview-translation {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal {
    width: 100%;
    max-width: 480px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    overflow: hidden;
    animation: modalIn 0.3s ease;
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
  
  .image-preview-container {
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
  
  .btn-secondary.danger {
    background: var(--danger-bg);
    color: var(--danger-text);
  }
  
  .btn-secondary.danger:hover {
    background: rgba(239, 68, 68, 0.25);
  }
  
  /* Success Toast */
  .success-toast {
    position: fixed;
    top: 5rem;
    right: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: var(--success-bg);
    color: var(--success-text);
    border-radius: 12px;
    font-weight: 500;
    animation: slideIn 0.3s ease, fadeOut 0.3s ease 1.7s forwards;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 500;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes fadeOut {
    to {
      opacity: 0;
      transform: translateX(20px);
    }
  }
  
  .success-toast.import {
    background: var(--hover-bg);
    color: var(--accent-primary);
    border: 1px solid var(--accent-primary);
    animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
  }
  
  .success-toast.bulk {
    background: rgba(245, 158, 11, 0.15);
    color: var(--warning-text);
    border: 1px solid var(--warning-text);
    animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .import-btn.bulk {
    background: rgba(245, 158, 11, 0.1);
    border-color: var(--warning-text);
    color: var(--warning-text);
  }
  
  .import-btn.bulk:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: var(--warning-text);
    color: var(--warning-text);
  }
  
  .bulk-modal {
    max-width: 520px;
  }
  
  .bulk-info {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--hover-bg);
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }
  
  .bulk-info svg {
    flex-shrink: 0;
    color: var(--accent-primary);
  }
  
  .bulk-info p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }
  
  .bulk-textarea {
    min-height: 200px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.6;
  }
  
  .word-count {
    font-weight: 400;
    color: var(--accent-primary);
    margin-left: 0.5rem;
  }
  
  @media (max-width: 480px) {
    .add-card-container {
      padding: 1rem;
      padding-bottom: 80px;
    }
    
    .header {
      margin-bottom: 1rem;
    }
    
    .header-top {
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    
    h1 {
      font-size: 1.25rem;
    }
    
    .subtitle {
      font-size: 0.8rem;
    }
    
    .import-btn {
      width: 32px;
      height: 32px;
    }
    
    .import-btn svg {
      width: 16px;
      height: 16px;
    }
    
    .card-preview-wrapper {
      gap: 0.5rem;
    }
    
    .preview-label {
      font-size: 0.75rem;
    }
    
    .card-preview {
      border-radius: 16px;
      border-width: 1.5px;
      max-height: 200px;
      aspect-ratio: 3/4;
    }
    
    .card-preview-wrapper {
      max-width: 150px;
      margin: 0 auto;
    }
    
    .card-content-preview {
      display: none;
    }
    
    .card-content-preview {
      padding: 1rem;
      gap: 0.25rem;
    }
    
    .preview-word {
      font-size: 1rem;
    }
    
    .preview-translation {
      font-size: 0.8rem;
    }
    
    .image-placeholder {
      gap: 0.375rem;
      padding: 0.5rem;
    }
    
    .image-placeholder svg {
      width: 24px;
      height: 24px;
    }
    
    .image-placeholder span {
      font-size: 0.65rem;
    }
  }
</style>
