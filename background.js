/**
 * Background Service Worker
 * Handles keyboard shortcuts and extension state management
 */

// Listen for keyboard shortcut commands
browser.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-extension") {
    // Get the active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (tabs.length > 0 && tabs[0].url.includes("chess.com")) {
      // Send toggle message to content script
      try {
        await browser.tabs.sendMessage(tabs[0].id, { action: "toggle" });
      } catch (error) {
        console.log("Chess Analysis: Content script not ready yet");
      }
    }
  }
});

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Chess Analysis Extension installed successfully");
    
    // Set default state
    browser.storage.local.set({ extensionEnabled: false });
  }
});

// Handle messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getState") {
    browser.storage.local.get("extensionEnabled").then((result) => {
      sendResponse({ enabled: result.extensionEnabled || false });
    });
    return true; // Indicates async response
  }
  
  if (message.action === "setState") {
    browser.storage.local.set({ extensionEnabled: message.enabled });
    sendResponse({ success: true });
    return true;
  }
});