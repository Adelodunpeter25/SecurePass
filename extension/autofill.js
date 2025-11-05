class SecurePassAutoFill {
  constructor() {
    this.domain = window.location.hostname;
    this.promptShown = false;
    this.init();
  }

  async init() {
    // Check immediately
    this.checkForAutoFill();
    
    // Also check after short delays for dynamic forms
    setTimeout(() => this.checkForAutoFill(), 500);
  }

  async checkForAutoFill() {
    // Prevent duplicate prompts
    if (this.promptShown) return;
    
    try {
      // Check if user is authenticated
      const authState = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      if (!authState.isAuthenticated) {
        return;
      }

      // Get credentials for this domain
      const response = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: this.domain
      });

      if (response.credentials) {
        this.promptShown = true;
        this.showAutoFillPrompt(response.credentials);
      }
    } catch (error) {
      console.log('SecurePass: Auto-fill check failed', error);
    }
  }

  showAutoFillPrompt(credentials) {
    // Find login form fields first
    const passwordField = document.querySelector('input[type="password"]');
    const usernameField = this.findUsernameField(passwordField);
    
    if (!passwordField || !usernameField) {
      return;
    }

    // Create confirmation prompt
    const prompt = document.createElement('div');
    const promptId = 'securepass-prompt-' + Date.now();
    prompt.id = promptId;
    prompt.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;

    const yesId = 'autoFillYes-' + Date.now();
    const noId = 'autoFillNo-' + Date.now();

    prompt.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span>🔐</span>
        <strong>SecurePass</strong>
      </div>
      <div style="margin-bottom: 12px; color: #374151;">
        Auto-fill login for <strong>${this.domain}</strong>?
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="${yesId}" style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Fill</button>
        <button id="${noId}" style="background: #6b7280; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Not now</button>
      </div>
    `;

    document.body.appendChild(prompt);

    // Handle user choice
    document.getElementById(yesId).addEventListener('click', () => {
      this.fillLoginForm(credentials, usernameField, passwordField);
      prompt.remove();
    });

    document.getElementById(noId).addEventListener('click', () => {
      prompt.remove();
    });

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.getElementById(promptId)) {
        prompt.remove();
      }
    }, 10000);
  }

  fillLoginForm(credentials, usernameField, passwordField) {
    // Fill both fields
    if (usernameField && credentials.username) {
      usernameField.value = credentials.username;
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (passwordField && credentials.password) {
      passwordField.value = credentials.password;
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    console.log('SecurePass: Auto-filled credentials for', this.domain);
  }

  findUsernameField(passwordField) {
    if (!passwordField) return null;
    
    const form = passwordField.closest('form');
    
    const selectors = [
      'input[type="email"]',
      'input[type="text"]',
      'input[name*="user"]',
      'input[name*="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]'
    ];
    
    for (const selector of selectors) {
      const field = form?.querySelector(selector) || document.querySelector(selector);
      if (field && field.offsetParent !== null) {
        return field;
      }
    }
    return null;
  }
}

new SecurePassAutoFill();
