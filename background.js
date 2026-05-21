const ALARM_NAME = 'price-monitor-alarm';
let creatingOffscreenPromise = null;

// Initialize on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Radar de Preços instalado com sucesso!');
  setupAlarm();
});

// Initialize on browser startup
chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
});

// Listener for background alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('Alarme ativado. Iniciando verificação de preços...');
    checkAllPrices();
  }
});

// Handle incoming message requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'reschedule-alarm') {
    setupAlarm(message.interval);
    sendResponse({ success: true });
  } else if (message.action === 'check-prices-now') {
    checkAllPrices().then((results) => {
      sendResponse({ success: true, results });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep message channel open for async response
  }
});

// Monitor notification clicks to open the specific store page
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get({ products: [] }, (result) => {
    // Find the source that matches the notificationId
    for (let product of result.products) {
      const source = product.sources.find(s => s.id === notificationId);
      if (source) {
        chrome.tabs.create({ url: source.url });
        break;
      }
    }
  });
});

/**
 * Configure background check alarm
 * @param {number} [intervalMinutes] 
 */
function setupAlarm(intervalMinutes) {
  chrome.storage.local.get({ checkInterval: '60' }, (result) => {
    const minutes = intervalMinutes || parseInt(result.checkInterval, 10) || 60;
    
    chrome.alarms.clear(ALARM_NAME, () => {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: minutes,
        periodInMinutes: minutes
      });
      console.log(`Verificação em segundo plano agendada para cada ${minutes} minutos.`);
    });
  });
}

/**
 * Open or connect to offscreen document
 */
async function setupOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (contexts.length > 0) {
    return;
  }

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.DOM_PARSING],
    justification: 'Fazer scraping de preços em segundo plano usando seletores DOM na página HTML.'
  });
  
  await creatingOffscreenPromise;
  creatingOffscreenPromise = null;
}

/**
 * Close offscreen document
 */
async function closeOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (contexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

/**
 * Checks all products and their nested sources for price changes
 */
async function checkAllPrices() {
  const data = await chrome.storage.local.get({ products: [] });
  const products = data.products;
  
  if (products.length === 0) {
    console.log('Nenhum produto cadastrado para monitoramento.');
    return [];
  }

  await setupOffscreenDocument();
  const results = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    for (let j = 0; j < product.sources.length; j++) {
      const source = product.sources[j];
      console.log(`Verificando: "${product.title}" no site ${source.domain} (${source.url})`);
      
      try {
        // Send scraping request to offscreen
        const scrapeResponse = await chrome.runtime.sendMessage({
          target: 'offscreen-doc',
          action: 'scrape-price',
          url: source.url,
          selector: source.selector
        });

        if (scrapeResponse && scrapeResponse.success) {
          const rawPriceText = scrapeResponse.priceText;
          const newPrice = parsePrice(rawPriceText);
          
          if (newPrice !== null) {
            const oldPrice = source.currentPrice;
            
            if (newPrice !== oldPrice) {
              source.currentPrice = newPrice;
              
              // Add entry to history
              source.priceHistory.push({
                price: newPrice,
                date: new Date().toISOString()
              });

              // Trigger alert if price dropped
              if (newPrice < oldPrice) {
                triggerPriceDropNotification(product.title, source, oldPrice, newPrice);
              }
            }

            source.lastChecked = new Date().toISOString();
            results.push({ productId: product.id, sourceId: source.id, status: 'success', price: newPrice });
          } else {
            console.warn(`Não foi possível analisar o preço extraído: "${rawPriceText}"`);
            results.push({ productId: product.id, sourceId: source.id, status: 'parse_error' });
          }
        } else {
          console.error(`Erro ao obter preço do offscreen: ${scrapeResponse ? scrapeResponse.error : 'Sem resposta'}`);
          results.push({ productId: product.id, sourceId: source.id, status: 'scrape_error', error: scrapeResponse ? scrapeResponse.error : 'Sem resposta' });
        }
      } catch (err) {
        console.error(`Erro no scraping do link ${source.id} de "${product.title}":`, err);
        results.push({ productId: product.id, sourceId: source.id, status: 'runtime_error', error: err.message });
      }
    }
  }

  // Save updated product details
  await chrome.storage.local.set({ products: products });
  
  // Close the offscreen document
  await closeOffscreenDocument();

  return results;
}

/**
 * Triggers a native system notification for price drops on a specific store link
 * @param {string} productTitle 
 * @param {object} source 
 * @param {number} oldPrice 
 * @param {number} newPrice 
 */
function triggerPriceDropNotification(productTitle, source, oldPrice, newPrice) {
  const formatCurrency = (val) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const oldPriceStr = formatCurrency(oldPrice);
  const newPriceStr = formatCurrency(newPrice);
  const percentDrop = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

  chrome.notifications.create(source.id, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: '📉 Queda de Preço Detectada!',
    message: `${productTitle} está mais barato no site ${source.domain}!\nDe: ${oldPriceStr} por: ${newPriceStr} (-${percentDrop}%)`,
    contextMessage: source.domain,
    priority: 2,
    requireInteraction: true
  });
}

/**
 * Price parser utility BRL/USD
 * @param {string} priceStr 
 */
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
