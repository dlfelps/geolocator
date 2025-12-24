/**
 * Content script for extracting text from web pages
 * Injected into active tab when user triggers the extension
 */

const MAX_TEXT_LENGTH = 50000; // Limit text to avoid performance issues

/**
 * Extract visible text from the page
 */
function extractPageText() {
  let text = '';

  // Priority 1: Try to find <article> tag (common in articles/blogs)
  const article = document.querySelector('article');
  if (article) {
    text = article.innerText;
    console.log('✓ Extracted text from <article> tag');
  }

  // Priority 2: Try <main> tag
  if (!text) {
    const main = document.querySelector('main');
    if (main) {
      text = main.innerText;
      console.log('✓ Extracted text from <main> tag');
    }
  }

  // Priority 3: Look for content-specific divs
  if (!text) {
    const contentSelectors = [
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main-content',
      '.post-content',
      '.article-content',
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        text = element.innerText;
        console.log(`✓ Extracted text from ${selector}`);
        break;
      }
    }
  }

  // Priority 4: Fallback to body, but exclude common non-content elements
  if (!text) {
    // Clone body to manipulate it
    const bodyClone = document.body.cloneNode(true);

    // Remove non-content elements
    const excludeSelectors = [
      'nav',
      'header',
      'footer',
      'aside',
      'script',
      'style',
      'noscript',
      'iframe',
      '.navigation',
      '.menu',
      '.sidebar',
      '.advertisement',
      '.ad',
      '[class*="cookie"]',
      '[class*="popup"]',
    ];

    for (const selector of excludeSelectors) {
      const elements = bodyClone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    }

    text = bodyClone.innerText;
    console.log('✓ Extracted text from <body> (filtered)');
  }

  // Clean up the text
  text = cleanText(text);

  // Limit length to avoid performance issues
  if (text.length > MAX_TEXT_LENGTH) {
    console.warn(`Text length (${text.length}) exceeds max (${MAX_TEXT_LENGTH}), truncating...`);
    text = text.substring(0, MAX_TEXT_LENGTH);
  }

  return text;
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text) {
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ');

  // Remove excessive newlines
  text = text.replace(/\n\s*\n/g, '\n');

  // Trim
  text = text.trim();

  return text;
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message;

  if (type === 'PING') {
    // Respond to ping (used to check if script is injected)
    sendResponse({ pong: true });
    return true;
  }

  if (type === 'EXTRACT_TEXT') {
    try {
      console.log('📄 Extracting text from page...');

      const text = extractPageText();
      const url = window.location.href;

      console.log(`✅ Extracted ${text.length} characters from ${url}`);

      sendResponse({
        success: true,
        text: text,
        url: url,
        length: text.length,
      });
    } catch (error) {
      console.error('❌ Error extracting text:', error);

      sendResponse({
        success: false,
        error: error.message,
      });
    }

    return true; // Keep channel open for async response
  }

  return false;
});

console.log('📝 Content script loaded');
