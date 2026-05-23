// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen-doc') return false;

  if (message.action === 'scrape-price') {
    scrapePrice(message.url, message.selector)
      .then(priceText => {
        sendResponse({ success: true, priceText: priceText });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for asynchronous response
  }
});

/**
 * Fetches HTML from target URL and extracts price using CSS selector or JSON-LD schema
 * @param {string} url 
 * @param {string} selector 
 */
async function scrapePrice(url, selector) {
  // Use AbortController for a 15-second timeout on fetches
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Falha ao buscar página: Status ${response.status}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let rawText = '';
    let element = doc.querySelector(selector);
    
    if (element) {
      rawText = element.innerText || element.textContent || '';
    } else {
      // Fallback 1: simplified class selector matching
      if (selector.includes('.')) {
        const parts = selector.split(' > ');
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) {
          const classNames = lastPart.split('.');
          const tagName = classNames[0];
          const simplifiedSelector = tagName + '.' + classNames[1];
          element = doc.querySelector(simplifiedSelector);
          if (element) {
            rawText = element.innerText || element.textContent || '';
          }
        }
      }
    }

    // Fallback 2: Check if parsed price is valid. If selector failed or returned non-numeric,
    // use structured JSON-LD data as a high-fidelity fallback.
    let parsedPrice = parsePrice(rawText);
    if (parsedPrice === null) {
      console.log('Seletor falhou ou retornou texto inválido. Tentando JSON-LD fallback...');
      const schemaPrice = extractPriceFromJSONLD(doc);
      if (schemaPrice !== null) {
        console.log(`Preço extraído via JSON-LD: ${schemaPrice}`);
        // Return structured price formatted for the background parser
        return `R$ ${schemaPrice.toFixed(2).replace('.', ',')}`;
      }
    }

    if (!element && parsedPrice === null) {
      throw new Error(`Não foi possível encontrar o preço usando o seletor ou dados estruturados da página.`);
    }

    return rawText.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('A requisição expirou (Timeout de 15 segundos).');
    }
    throw err;
  }
}

/**
 * Extracts product price from application/ld+json scripts
 * @param {Document} doc 
 */
function extractPriceFromJSONLD(doc) {
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (let script of scripts) {
      const text = (script.textContent || script.innerText || '').trim();
      if (!text) continue;
      
      // Remove HTML comments inside scripts (sometimes injected by templates)
      let cleanText = text.replace(/<!--[\s\S]*?-->/g, '');
      
      let data;
      try {
        data = JSON.parse(cleanText);
      } catch (err) {
        continue;
      }
      
      const items = Array.isArray(data) ? data : [data];
      
      for (let item of items) {
        // Handle @graph schema arrays
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          for (let graphItem of item['@graph']) {
            const price = findPriceInSchema(graphItem);
            if (price !== null) return price;
          }
        }
        
        const price = findPriceInSchema(item);
        if (price !== null) return price;
      }
    }
  } catch (e) {
    console.error('Erro ao processar JSON-LD:', e);
  }
  return null;
}

/**
 * Helper to recursively search for price values in a parsed schema object
 * @param {object} item 
 */
function findPriceInSchema(item) {
  if (!item || typeof item !== 'object') return null;
  
  // Check Product or offers
  if (item['@type'] === 'Product' || item.offers) {
    const offers = item.offers;
    if (offers) {
      const offersList = Array.isArray(offers) ? offers : [offers];
      for (let offer of offersList) {
        if (offer.price !== undefined && offer.price !== null) {
          let pVal = typeof offer.price === 'string' ? parseFloat(offer.price.replace(',', '.')) : parseFloat(offer.price);
          if (!isNaN(pVal) && pVal > 0) return pVal;
        }
        if (offer.lowPrice !== undefined && offer.lowPrice !== null) {
          let pVal = typeof offer.lowPrice === 'string' ? parseFloat(offer.lowPrice.replace(',', '.')) : parseFloat(offer.lowPrice);
          if (!isNaN(pVal) && pVal > 0) return pVal;
        }
      }
    }
  }
  
  // Check Offer
  if (item['@type'] === 'Offer' && item.price !== undefined && item.price !== null) {
    let pVal = typeof item.price === 'string' ? parseFloat(item.price.replace(',', '.')) : parseFloat(item.price);
    if (!isNaN(pVal) && pVal > 0) return pVal;
  }
  
  // Recurse into nested children keys
  for (let key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key) && typeof item[key] === 'object' && item[key] !== null) {
      const price = findPriceInSchema(item[key]);
      if (price !== null) return price;
    }
  }
  
  return null;
}

/**
 * Helper to parse price float
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
