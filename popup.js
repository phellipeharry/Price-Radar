document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const trackBtn = document.getElementById('track-btn');
  const refreshAllBtn = document.getElementById('refresh-all-btn');
  const productsList = document.getElementById('products-list');
  const emptyState = document.getElementById('empty-state');
  const productsCount = document.getElementById('products-count');
  const intervalSelect = document.getElementById('interval-select');

  // Initialize
  loadProducts();
  loadSettings();

  // Event Listeners
  trackBtn.addEventListener('click', startTracking);
  refreshAllBtn.addEventListener('click', refreshAllPrices);
  intervalSelect.addEventListener('change', updateInterval);

  // Load and render products
  function loadProducts() {
    chrome.storage.local.get({ products: [] }, (result) => {
      const products = result.products;
      productsCount.textContent = products.length;

      // Clear previous list cards
      const cards = productsList.querySelectorAll('.product-card');
      cards.forEach(card => card.remove());

      if (products.length === 0) {
        emptyState.style.display = 'flex';
      } else {
        emptyState.style.display = 'none';
        
        products.forEach((product) => {
          if (product.sources && product.sources.length > 0) {
            const card = createProductCard(product);
            productsList.appendChild(card);
          }
        });
      }
    });
  }

  // Load check interval settings
  function loadSettings() {
    chrome.storage.local.get({ checkInterval: '60' }, (result) => {
      intervalSelect.value = result.checkInterval;
    });
  }

  // Update check interval in background
  function updateInterval() {
    const val = intervalSelect.value;
    chrome.storage.local.set({ checkInterval: val }, () => {
      chrome.runtime.sendMessage({ action: 'reschedule-alarm', interval: parseInt(val, 10) });
    });
  }

  // Currency formatting helper
  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Find the cheapest source in a product group
  function getCheapestSource(sources) {
    if (!sources || sources.length === 0) return null;
    return sources.reduce((min, src) => (src.currentPrice < min.currentPrice) ? src : min, sources[0]);
  }

  // Create expandable card
  function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;

    const sources = product.sources;
    const cheapestSource = getCheapestSource(sources);
    if (!cheapestSource) return card;

    const bestPriceFormatted = formatCurrency(cheapestSource.currentPrice);
    
    // Check if the cheapest source price dropped below its original price
    const isDropped = cheapestSource.currentPrice < cheapestSource.originalPrice;
    let dropBadgeHtml = '';
    if (isDropped && cheapestSource.originalPrice > 0) {
      const percent = Math.round(((cheapestSource.originalPrice - cheapestSource.currentPrice) / cheapestSource.originalPrice) * 100);
      if (percent > 0) {
        dropBadgeHtml = `<span class="badge-drop">-${percent}%</span>`;
      }
    }

    const sitesCountLabel = sources.length === 1 ? '1 site' : `${sources.length} sites`;
    const cheapestDomain = cheapestSource.domain;
    const imgSrc = product.imageUrl || 'icon128.png';

    // Build card shell
    card.innerHTML = `
      <div class="product-card-header">
        <img src="${imgSrc}" alt="${product.title}" class="product-thumb" onerror="this.src='icon128.png'">
        <div class="product-info">
          <h3 class="product-title" title="${product.title}">${product.title}</h3>
          
          <div class="product-meta-row">
            <span class="sources-count">${sitesCountLabel}</span>
            <span class="cheapest-badge" title="Melhor preço no site ${cheapestDomain}">no ${cheapestDomain}</span>
          </div>

          <div class="price-summary-row">
            <span class="price-label">Melhor Preço:</span>
            <span class="price-best ${isDropped ? 'dropped' : ''}">${bestPriceFormatted}</span>
            ${dropBadgeHtml}
          </div>
        </div>
        <div class="card-chevron">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      <!-- Collapsible panel listing all sources -->
      <div class="product-sources-panel">
        <div class="sources-table-title">Comparação de Lojas</div>
        <div class="sources-list">
          <!-- Rows injected dynamically -->
        </div>
      </div>
    `;

    // Toggle expansion when clicking the header section
    const header = card.querySelector('.product-card-header');
    header.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });

    // Populate comparison rows
    const sourcesList = card.querySelector('.sources-list');
    sources.forEach((src) => {
      const row = createSourceRow(product.id, src, src.id === cheapestSource.id);
      sourcesList.appendChild(row);
    });

    return card;
  }

  // Create single comparison table row
  function createSourceRow(productId, source, isCheapest) {
    const row = document.createElement('div');
    row.className = `source-row ${isCheapest ? 'is-cheapest' : ''}`;

    const currentFormatted = formatCurrency(source.currentPrice);
    const originalFormatted = formatCurrency(source.originalPrice);
    const hasDrop = source.currentPrice < source.originalPrice;

    // Time helper
    const formatDate = (isoStr) => {
      if (!isoStr) return '';
      const date = new Date(isoStr);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
             date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    row.innerHTML = `
      <div class="source-store-info">
        <span class="source-domain ${isCheapest ? 'cheapest-text' : ''}" title="${source.domain}">${source.domain}</span>
        <span class="source-last-check">Verificado: ${formatDate(source.lastChecked)}</span>
      </div>
      <div class="source-prices">
        <span class="source-price-current ${hasDrop ? 'dropped' : ''}">${currentFormatted}</span>
        ${hasDrop ? `<span class="source-price-original">${originalFormatted}</span>` : ''}
      </div>
      <div class="source-actions">
        <button class="source-btn source-btn-go" title="Abrir link da loja">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
        <button class="source-btn source-btn-delete" title="Excluir este link">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;

    // Click direct row to open link
    row.addEventListener('click', (e) => {
      if (e.target.closest('.source-btn')) return; // let buttons handle their own click
      chrome.tabs.create({ url: source.url });
    });

    // Handle Open Link Button
    row.querySelector('.source-btn-go').addEventListener('click', () => {
      chrome.tabs.create({ url: source.url });
    });

    // Handle Delete Source Link Button
    row.querySelector('.source-btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSource(productId, source.id);
    });

    return row;
  }

  // Delete a specific source link inside a product group
  function deleteSource(productId, sourceId) {
    chrome.storage.local.get({ products: [] }, (result) => {
      const products = result.products;
      
      const productIdx = products.findIndex(p => p.id === productId);
      if (productIdx !== -1) {
        const product = products[productIdx];
        
        // Remove the specific source
        product.sources = product.sources.filter(s => s.id !== sourceId);
        
        // If there are no sources left for this product, delete the whole product group
        if (product.sources.length === 0) {
          products.splice(productIdx, 1);
        } else {
          products[productIdx] = product;
        }

        chrome.storage.local.set({ products: products }, () => {
          loadProducts();
        });
      }
    });
  }

  // Inject selector script in tab
  function startTracking() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) return;

      if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://') || activeTab.url.startsWith('https://chrome.google.com/webstore')) {
        alert('O monitoramento não funciona em páginas internas do sistema ou na Chrome Web Store. Visite uma loja online para testar.');
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          alert('Erro ao injetar seletor de preço: ' + chrome.runtime.lastError.message);
          return;
        }
        
        chrome.tabs.sendMessage(activeTab.id, { action: 'start-selection' });
        window.close();
      });
    });
  }

  // Manual refresh trigger
  function refreshAllPrices() {
    refreshAllBtn.classList.add('spinning');
    refreshAllBtn.disabled = true;

    chrome.runtime.sendMessage({ action: 'check-prices-now' }, (response) => {
      setTimeout(() => {
        loadProducts();
        refreshAllBtn.classList.remove('spinning');
        refreshAllBtn.disabled = false;
      }, 1500);
    });
  }

  // Storage listener to update UI live
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.products) {
      loadProducts();
    }
  });
});
