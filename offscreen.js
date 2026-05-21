// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if message is for us
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
 * Fetches HTML from target URL and extracts inner text from CSS selector
 * @param {string} url 
 * @param {string} selector 
 */
async function scrapePrice(url, selector) {
  // Set up standard headers to mimic a normal browser request
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar página: Status ${response.status}`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Try to find the exact selector
  let element = doc.querySelector(selector);
  
  if (!element) {
    // Fallback search: in case the DOM is slightly different (e.g. wrapper classes added),
    // let's try a few selector simplification strategies if it is a compound class selector
    if (selector.includes('.')) {
      // Try using the last class name or first class name
      const parts = selector.split(' > ');
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) {
        const classNames = lastPart.split('.');
        const tagName = classNames[0];
        // Try selecting by tagName and first class only
        const simplifiedSelector = tagName + '.' + classNames[1];
        element = doc.querySelector(simplifiedSelector);
      }
    }
  }

  if (!element) {
    throw new Error(`Preço não encontrado com o seletor: ${selector}`);
  }

  // Get raw price text
  const rawText = element.innerText || element.textContent || '';
  return rawText.trim();
}
