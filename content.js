(function() {
  // Prevent duplicate injection
  if (window.radarPriceSelectorActive) return;
  window.radarPriceSelectorActive = true;

  let hoveredElement = null;
  let highlightOverlay = null;
  let tooltipLabel = null;
  let topControlBar = null;

  // Add styles to the document (updated with Modal styles)
  const styleEl = document.createElement('style');
  styleEl.id = 'radar-price-selector-styles';
  styleEl.textContent = `
    .radar-price-overlay {
      position: absolute;
      pointer-events: none;
      border: 2px solid #06b6d4;
      background-color: rgba(6, 182, 212, 0.15);
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.4);
      border-radius: 4px;
      z-index: 2147483640;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    .radar-price-tooltip {
      position: absolute;
      pointer-events: none;
      background-color: #090d16;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      z-index: 2147483641;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      white-space: nowrap;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .radar-price-bar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      background-color: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 30px;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 2147483642;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.1) inset;
      font-family: system-ui, -apple-system, sans-serif;
      color: #f1f5f9;
      font-size: 13px;
      pointer-events: auto;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .radar-price-bar.visible {
      transform: translateX(-50%) translateY(0);
    }

    .radar-price-bar-text {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .radar-price-bar-dot {
      width: 8px;
      height: 8px;
      background-color: #06b6d4;
      border-radius: 50%;
      box-shadow: 0 0 8px #06b6d4;
      animation: radar-bar-pulse 1.5s infinite;
    }

    .radar-price-btn-cancel {
      background-color: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .radar-price-btn-cancel:hover {
      background-color: #ef4444;
      color: #ffffff;
      border-color: #ef4444;
    }

    /* Modal Styles */
    .radar-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(9, 13, 22, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483645;
      font-family: system-ui, -apple-system, sans-serif;
      animation: radar-fade-in 0.25s ease-out;
    }

    .radar-modal-box {
      background-color: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      width: 360px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
      color: #f1f5f9;
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: radar-scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .radar-modal-title {
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, #06b6d4, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }

    .radar-modal-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin: -8px 0 4px 0;
      line-height: 1.4;
    }

    .radar-modal-option {
      background-color: rgba(30, 41, 59, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .radar-modal-radio-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      cursor: pointer;
      user-select: none;
    }

    .radar-modal-radio-label input[type="radio"] {
      accent-color: #06b6d4;
      cursor: pointer;
    }

    .radar-modal-input-group {
      margin-left: 22px;
      transition: all 0.2s;
    }

    .radar-modal-input-group.radar-disabled {
      opacity: 0.4;
      pointer-events: none;
    }

    .radar-modal-text-input, .radar-modal-select-input {
      width: 100%;
      background-color: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      font-family: inherit;
      box-sizing: border-box;
    }

    .radar-modal-text-input:focus, .radar-modal-select-input:focus {
      border-color: #06b6d4;
      box-shadow: 0 0 6px rgba(6, 182, 212, 0.3);
    }

    .radar-modal-buttons {
      display: flex;
      gap: 10px;
      margin-top: 8px;
    }

    .radar-modal-btn {
      flex: 1;
      padding: 10px;
      border-radius: 8px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }

    .radar-btn-save {
      background: linear-gradient(135deg, #06b6d4, #3b82f6);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
    }

    .radar-btn-save:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .radar-btn-cancel {
      background-color: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
    }

    .radar-btn-cancel:hover {
      background-color: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    @keyframes radar-bar-pulse {
      0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(6, 182, 212, 0); }
      100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
    }

    @keyframes radar-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes radar-scale-in {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);

  // Initialize UI components
  function initUI() {
    // Create overlay
    highlightOverlay = document.createElement('div');
    highlightOverlay.className = 'radar-price-overlay';
    document.body.appendChild(highlightOverlay);

    // Create tooltip
    tooltipLabel = document.createElement('div');
    tooltipLabel.className = 'radar-price-tooltip';
    tooltipLabel.textContent = 'Selecionar preço';
    tooltipLabel.style.display = 'none';
    document.body.appendChild(tooltipLabel);

    // Create control bar
    topControlBar = document.createElement('div');
    topControlBar.className = 'radar-price-bar';
    topControlBar.innerHTML = `
      <div class="radar-price-bar-text">
        <span class="radar-price-bar-dot"></span>
        Radar de Preços: Passe o mouse e clique no preço do produto
      </div>
      <button class="radar-price-btn-cancel">Cancelar</button>
    `;
    document.body.appendChild(topControlBar);

    // Show control bar with delay for slide-in effect
    setTimeout(() => {
      topControlBar.classList.add('visible');
    }, 100);

    // Bind cancel action
    topControlBar.querySelector('.radar-price-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      cleanup();
    });
  }

  // Handle message from popup to start selection
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start-selection') {
      initUI();
      bindEvents();
    }
  });

  function bindEvents() {
    window.addEventListener('mouseover', onMouseOver, true);
    window.addEventListener('mouseout', onMouseOut, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, true);
  }

  function unbindEvents() {
    window.removeEventListener('mouseover', onMouseOver, true);
    window.removeEventListener('mouseout', onMouseOut, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('scroll', onScroll, true);
  }

  function onMouseOver(e) {
    if (e.target.closest('.radar-price-overlay') || 
        e.target.closest('.radar-price-tooltip') || 
        e.target.closest('.radar-price-bar') ||
        e.target.closest('.radar-modal-backdrop') ||
        e.target.closest('.radar-toast')) {
      return;
    }

    hoveredElement = e.target;
    updateHighlight(hoveredElement);
  }

  function onMouseOut(e) {
    if (e.target === hoveredElement) {
      hoveredElement = null;
      hideHighlight();
    }
  }

  function onScroll() {
    if (hoveredElement) {
      updateHighlight(hoveredElement);
    }
  }

  function updateHighlight(element) {
    if (!element) return;

    const rect = element.getBoundingClientRect();
    
    // Position overlay
    highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.display = 'block';

    // Position tooltip
    tooltipLabel.style.display = 'block';
    tooltipLabel.style.top = `${rect.top + window.scrollY - 28}px`;
    tooltipLabel.style.left = `${rect.left + window.scrollX}px`;
    
    if (rect.top + window.scrollY - 28 < window.scrollY + 10) {
      tooltipLabel.style.top = `${rect.bottom + window.scrollY + 6}px`;
    }
  }

  function hideHighlight() {
    if (highlightOverlay) highlightOverlay.style.display = 'none';
    if (tooltipLabel) tooltipLabel.style.display = 'none';
  }

  function onClick(e) {
    if (e.target.closest('.radar-price-bar') || 
        e.target.closest('.radar-modal-backdrop') || 
        e.target.closest('.radar-toast')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    const priceText = element.innerText || element.textContent;
    const parsedVal = parsePrice(priceText);

    if (parsedVal === null) {
      alert('Não conseguimos identificar um preço válido nesse elemento. Tente clicar exatamente no valor numérico do preço (ex: R$ 99,90).');
      return;
    }

    // Capture product info
    const selector = getUniqueSelector(element);
    const title = getProductTitle();
    const imageUrl = getProductImage(element);
    const url = window.location.href;
    const domain = window.location.hostname.replace('www.', '');

    unbindEvents();
    hideHighlight();
    if (topControlBar) {
      topControlBar.classList.remove('visible');
      setTimeout(() => topControlBar.remove(), 400);
    }

    // Open Save Modal Overlay
    openSaveModal({
      title: title,
      imageUrl: imageUrl,
      url: url,
      domain: domain,
      selector: selector,
      price: parsedVal
    });
  }

  // Create and present the beautiful Save Modal
  function openSaveModal(selectedDetails) {
    chrome.storage.local.get({ products: [] }, (result) => {
      const existingProducts = result.products;

      const backdrop = document.createElement('div');
      backdrop.className = 'radar-modal-backdrop';

      backdrop.innerHTML = `
        <div class="radar-modal-box">
          <h3 class="radar-modal-title">Radar de Preços</h3>
          <p class="radar-modal-subtitle">Escolha onde deseja salvar o preço deste produto.</p>
          
          <!-- Option A: New Group -->
          <div class="radar-modal-option">
            <label class="radar-modal-radio-label">
              <input type="radio" name="radar-save-type" value="new" checked>
              Criar novo grupo de produto
            </label>
            <div id="radar-group-new-input-container" class="radar-modal-input-group">
              <input type="text" id="radar-txt-group-name" class="radar-modal-text-input" placeholder="Ex: PlayStation 5 Slim">
            </div>
          </div>

          <!-- Option B: Existing Group -->
          <div class="radar-modal-option">
            <label class="radar-modal-radio-label">
              <input type="radio" name="radar-save-type" value="link" id="radar-radio-link">
              Vincular a produto existente
            </label>
            <div id="radar-group-select-container" class="radar-modal-input-group radar-disabled">
              <select id="radar-select-product" class="radar-modal-select-input" disabled>
                <!-- Populated dynamically -->
              </select>
            </div>
          </div>

          <div class="radar-modal-buttons">
            <button id="radar-btn-confirm" class="radar-modal-btn radar-btn-save">Salvar</button>
            <button id="radar-btn-dismiss" class="radar-modal-btn radar-btn-cancel">Cancelar</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      // Pre-fill fields
      const txtGroupName = document.getElementById('radar-txt-group-name');
      txtGroupName.value = selectedDetails.title;

      const selectProduct = document.getElementById('radar-select-product');
      const radioLink = document.getElementById('radar-radio-link');

      if (existingProducts.length === 0) {
        // Disable existing product link if none track yet
        radioLink.disabled = true;
        radioLink.parentElement.style.color = '#64748b';
        radioLink.parentElement.style.cursor = 'not-allowed';
      } else {
        // Populate dropdown
        existingProducts.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.title;
          selectProduct.appendChild(opt);
        });
      }

      // Handle radio changes
      const radioTypes = backdrop.querySelectorAll('input[name="radar-save-type"]');
      const newContainer = document.getElementById('radar-group-new-input-container');
      const selectContainer = document.getElementById('radar-group-select-container');

      radioTypes.forEach((radio) => {
        radio.addEventListener('change', (e) => {
          if (e.target.value === 'new') {
            newContainer.classList.remove('radar-disabled');
            txtGroupName.disabled = false;
            selectContainer.classList.add('radar-disabled');
            selectProduct.disabled = true;
          } else {
            newContainer.classList.add('radar-disabled');
            txtGroupName.disabled = true;
            selectContainer.classList.remove('radar-disabled');
            selectProduct.disabled = false;
          }
        });
      });

      // Save action
      document.getElementById('radar-btn-confirm').addEventListener('click', () => {
        const selectedRadio = backdrop.querySelector('input[name="radar-save-type"]:checked').value;
        
        let targetProductsList = [...existingProducts];
        let saveTitle = '';

        const newSource = {
          id: 'src_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
          url: selectedDetails.url,
          domain: selectedDetails.domain,
          selector: selectedDetails.selector,
          originalPrice: selectedDetails.price,
          currentPrice: selectedDetails.price,
          priceHistory: [
            { price: selectedDetails.price, date: new Date().toISOString() }
          ],
          lastChecked: new Date().toISOString()
        };

        if (selectedRadio === 'new') {
          // Option A: Create a new product entry containing this source
          const groupName = txtGroupName.value.trim() || selectedDetails.title;
          saveTitle = groupName;
          
          const newProductGroup = {
            id: 'prod_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
            title: groupName,
            imageUrl: selectedDetails.imageUrl,
            sources: [newSource]
          };

          targetProductsList.push(newProductGroup);
        } else {
          // Option B: Append this source to an existing product entry
          const targetId = selectProduct.value;
          const targetIndex = targetProductsList.findIndex(p => p.id === targetId);

          if (targetIndex !== -1) {
            const product = targetProductsList[targetIndex];
            saveTitle = product.title;

            // Prevent duplicate site URLs in the same product
            const existingSourceIdx = product.sources.findIndex(s => s.url === newSource.url);
            if (existingSourceIdx !== -1) {
              const oldSource = product.sources[existingSourceIdx];
              // Overwrite current but maintain original price and records
              newSource.originalPrice = oldSource.originalPrice;
              newSource.priceHistory = [...oldSource.priceHistory, ...newSource.priceHistory];
              product.sources[existingSourceIdx] = newSource;
            } else {
              product.sources.push(newSource);
            }

            // Fallback for missing image
            if (!product.imageUrl) {
              product.imageUrl = selectedDetails.imageUrl;
            }
          }
        }

        chrome.storage.local.set({ products: targetProductsList }, () => {
          backdrop.remove();
          cleanupStyles();
          showToast(saveTitle, selectedDetails.price);
        });
      });

      // Dismiss action
      document.getElementById('radar-btn-dismiss').addEventListener('click', () => {
        backdrop.remove();
        cleanupStyles();
      });
    });
  }

  // Helper: Get unique CSS Selector
  function getUniqueSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    let path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.nodeName.toLowerCase();
      
      if (element.className) {
        const classes = Array.from(element.classList)
          .filter(c => !c.startsWith('radar-') && !c.includes('active') && !c.includes('hover'))
          .join('.');
        if (classes) {
          selector += `.${classes}`;
        }
      }
      
      let sibling = element;
      let sibCount = 0;
      let sibIndex = 0;
      while (sibling) {
        if (sibling.nodeName === element.nodeName) {
          sibCount++;
        }
        if (sibling === element) {
          sibIndex = sibCount;
        }
        sibling = sibling.previousElementSibling;
      }
      
      if (sibCount > 1) {
        selector += `:nth-of-type(${sibIndex})`;
      }
      
      path.unshift(selector);
      element = element.parentNode;
    }
    
    return path.join(' > ');
  }

  // Helper: Extract price from element text
  function parsePrice(priceStr) {
    if (!priceStr) return null;
    
    let cleanStr = priceStr.replace(/[^\d.,]/g, '').trim();
    if (!cleanStr) return null;

    const lastDot = cleanStr.lastIndexOf('.');
    const lastComma = cleanStr.lastIndexOf(',');

    if (lastDot !== -1 && lastComma !== -1) {
      if (lastComma > lastDot) {
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      } else {
        cleanStr = cleanStr.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      cleanStr = cleanStr.replace(',', '.');
    } else if (lastDot !== -1) {
      const afterDot = cleanStr.substring(lastDot + 1);
      if (afterDot.length === 3 && cleanStr.indexOf('.') === lastDot) {
        cleanStr = cleanStr.replace('.', '');
      }
    }

    const val = parseFloat(cleanStr);
    return isNaN(val) ? null : val;
  }

  // Helper: Heuristic to get product title
  function getProductTitle() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) return ogTitle.content.trim();

    const schemaName = document.querySelector('[itemprop="name"]');
    if (schemaName && schemaName.innerText) return schemaName.innerText.trim();

    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText && h1.innerText.trim().length > 3) {
      return h1.innerText.trim();
    }

    return document.title.split('-')[0].split('|')[0].trim();
  }

  // Helper: Heuristic to find product image
  function getProductImage(priceEl) {
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg && ogImg.content) return ogImg.content;

    const images = Array.from(document.querySelectorAll('img'));
    
    if (priceEl) {
      images.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const pRect = priceEl.getBoundingClientRect();
        
        const distA = Math.hypot((aRect.left + aRect.width/2) - (pRect.left + pRect.width/2), (aRect.top + aRect.height/2) - (pRect.top + pRect.height/2));
        const distB = Math.hypot((bRect.left + bRect.width/2) - (pRect.left + pRect.width/2), (bRect.top + bRect.height/2) - (pRect.top + pRect.height/2));
        
        return distA - distB;
      });
    }

    for (let img of images) {
      if (img.naturalWidth > 100 || img.width > 100) {
        if (img.src && img.src.startsWith('http')) {
          return img.src;
        }
      }
    }

    const firstImg = document.querySelector('img');
    return (firstImg && firstImg.src.startsWith('http')) ? firstImg.src : '';
  }

  // Cleanup UI and events
  function cleanup() {
    unbindEvents();
    hideHighlight();
    
    if (highlightOverlay) highlightOverlay.remove();
    if (tooltipLabel) tooltipLabel.remove();
    if (topControlBar) {
      topControlBar.classList.remove('visible');
      setTimeout(() => topControlBar.remove(), 400);
    }
    
    cleanupStyles();
    window.radarPriceSelectorActive = false;
  }

  function cleanupStyles() {
    const styleEl = document.getElementById('radar-price-selector-styles');
    if (styleEl) styleEl.remove();
  }

  // Show dynamic toast banner
  function showToast(title, price) {
    const toast = document.createElement('div');
    toast.className = 'radar-toast';
    
    const formattedPrice = price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    toast.innerHTML = `
      <div class="radar-toast-header">✓ Radar de Preços</div>
      <div class="radar-toast-body">
        Preço do produto <strong>${title.substring(0, 45)}${title.length > 45 ? '...' : ''}</strong> cadastrado!<br>
        Valor: <strong>${formattedPrice}</strong>
      </div>
    `;
    
    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
      .radar-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background-color: #0f172a;
        border: 1px solid #10b981;
        border-left: 5px solid #10b981;
        border-radius: 8px;
        padding: 16px 20px;
        color: #f1f5f9;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 320px;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .radar-toast.visible {
        transform: translateY(0);
        opacity: 1;
      }
      .radar-toast-header {
        font-size: 13.5px;
        font-weight: 700;
        color: #10b981;
        margin-bottom: 2px;
      }
      .radar-toast-body {
        font-size: 12px;
        color: #cbd5e1;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(toastStyle);
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('visible');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        toast.remove();
        toastStyle.remove();
      }, 400);
    }, 4500);
  }
})();
