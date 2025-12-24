import { MESSAGE_TYPES } from './constants.js';

/**
 * Send a message from background to sidepanel
 */
export async function sendToSidePanel(message) {
  try {
    // Get all windows
    const windows = await chrome.windows.getAll({ populate: true });

    for (const window of windows) {
      // Try to send message to sidepanel in each window
      try {
        await chrome.runtime.sendMessage(message);
      } catch (err) {
        // Sidepanel may not be open in this window, continue
      }
    }
  } catch (error) {
    console.error('Error sending message to sidepanel:', error);
  }
}

/**
 * Send a message to background script
 */
export async function sendToBackground(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('Error sending message to background:', error);
    throw error;
  }
}

/**
 * Send a message to content script in active tab
 */
export async function sendToContentScript(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found');
    }

    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.error('Error sending message to content script:', error);
    throw error;
  }
}

/**
 * Inject content script into active tab
 */
export async function injectContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found');
    }

    // Check if content script is already injected
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      // If no error, script is already injected
      return tab;
    } catch {
      // Script not injected, inject it now
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js'],
      });
      return tab;
    }
  } catch (error) {
    console.error('Error injecting content script:', error);
    throw error;
  }
}

/**
 * Set up message listener
 */
export function addMessageListener(handler) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle message asynchronously
    (async () => {
      try {
        const result = await handler(message, sender);
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    // Return true to indicate async response
    return true;
  });
}

/**
 * Helper to create properly formatted messages
 */
export function createMessage(type, data = {}) {
  return {
    type,
    data,
    timestamp: Date.now(),
  };
}
