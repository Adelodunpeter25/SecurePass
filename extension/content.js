class SecurePassContent {
  constructor() {
    this.domain = window.location.hostname;
    this.currentSuggestion = null;
    this.init();
  }

  init() {
    this.detectPasswordFields();
    this.detectLoginForms();
    this.observeFormChanges();
  }

  detectPasswordFields() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    passwordFields.forEach(passwordField => {
      this.enhancePasswordField(passwordField);
    });
  }

  enhancePasswordField(passwordField) {
    // Skip if already enhanced
    if (passwordField.dataset.securepassEnhanced) return;
    passwordField.dataset.securepassEnhanced = 'true';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; display: inline-block; width: 100%;';
    
    passwordField.parentNode.insertBefore(wrapper, passwordField);
    wrapper.appendChild(passwordField);

    // Add SecurePass icon
    const spIcon = this.createSecurePassIcon();
    wrapper.appendChild(spIcon);

    // Show suggestions on focus
    passwordField.addEventListener('focus', () => {
      this.showPasswordSuggestion(passwordField);
    });

    // Hide suggestions on blur (with delay for clicking)
    passwordField.addEventListener('blur', () => {
      setTimeout(() => this.hideSuggestion(), 150);
    });

    // Auto-save functionality
    passwordField.addEventListener('input', () => {
      if (passwordField.value.length > 0) {
        this.showSavePrompt(passwordField);
      }
    });

    // Auto-save on form submit
    const form = passwordField.closest('form');
    if (form) {
      form.addEventListener('submit', () => {
        if (passwordField.value.length > 0) {
          setTimeout(() => this.savePasswordFromField(passwordField), 100);
        }
      });
    }
  }

  createSecurePassIcon() {
    const icon = document.createElement('div');
    icon.innerHTML = '🔐';
    icon.title = 'SecurePass';
    icon.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      z-index: 10000;
      font-size: 16px;
      user-select: none;
      opacity: 0.6;
      transition: opacity 0.2s;
    `;
    
    icon.addEventListener('mouseenter', () => {
      icon.style.opacity = '1';
    });
    
    icon.addEventListener('mouseleave', () => {
      icon.style.opacity = '0.6';
    });

    return icon;
  }

  async showPasswordSuggestion(passwordField) {
    const authState = await this.checkAuthState();
    if (!authState.isAuthenticated) return;

    // Check if we have existing credentials
    const existing = await this.getExistingCredentials();
    
    // Generate a strong password
    const suggestedPassword = this.generateStrongPassword();
    
    this.currentSuggestion = this.createSuggestionDropdown(passwordField, existing, suggestedPassword);
  }

  createSuggestionDropdown(passwordField, existingCredentials, suggestedPassword) {
    // Remove existing dropdown
    this.hideSuggestion();

    const dropdown = document.createElement('div');
    dropdown.className = 'securepass-suggestion-dropdown';
    
    let content = '';
    
    // Show existing password if available
    if (existingCredentials) {
      content += `
        <div class="suggestion-item" data-action="use-existing">
          <div class="suggestion-icon">🔑</div>
          <div class="suggestion-text">
            <div class="suggestion-title">Use saved password</div>
            <div class="suggestion-subtitle">${existingCredentials.username}</div>
          </div>
        </div>
      `;
    }
    
    // Show generated password suggestion
    content += `
      <div class="suggestion-item" data-action="use-generated" data-password="${suggestedPassword}">
        <div class="suggestion-icon">✨</div>
        <div class="suggestion-text">
          <div class="suggestion-title">Use strong password</div>
          <div class="suggestion-subtitle">${suggestedPassword.substring(0, 8)}...</div>
        </div>
      </div>
    `;
    
    dropdown.innerHTML = content;
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10001;
      margin-top: 4px;
      overflow: hidden;
    `;

    // Add styles if not exists
    if (!document.querySelector('#securepass-suggestion-styles')) {
      const style = document.createElement('style');
      style.id = 'securepass-suggestion-styles';
      style.textContent = `
        .suggestion-item {
          display: flex;
          align-items: center;
          padding: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
          border-bottom: 1px solid #f3f4f6;
        }
        .suggestion-item:last-child {
          border-bottom: none;
        }
        .suggestion-item:hover {
          background-color: #f9fafb;
        }
        .suggestion-icon {
          font-size: 16px;
          margin-right: 12px;
        }
        .suggestion-text {
          flex: 1;
        }
        .suggestion-title {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }
        .suggestion-subtitle {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }
      `;
      document.head.appendChild(style);
    }

    // Position dropdown
    const wrapper = passwordField.parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(dropdown);

    // Handle clicks
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (!item) return;

      const action = item.dataset.action;
      
      if (action === 'use-existing' && existingCredentials) {
        this.fillExistingCredentials(passwordField, existingCredentials);
      } else if (action === 'use-generated') {
        const password = item.dataset.password;
        this.fillGeneratedPassword(passwordField, password);
      }
      
      this.hideSuggestion();
    });

    return dropdown;
  }

  async fillExistingCredentials(passwordField, credentials) {
    const form = passwordField.closest('form');
    const usernameField = this.findUsernameField(form, passwordField);
    
    if (usernameField) {
      usernameField.value = credentials.username;
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    passwordField.value = credentials.password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    
    this.showNotification('Credentials filled from SecurePass!', 'success');
  }

  async fillGeneratedPassword(passwordField, password) {
    passwordField.value = password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Auto-save the generated password
    setTimeout(() => {
      this.showSavePrompt(passwordField);
    }, 500);
    
    this.showNotification('Strong password generated!', 'success');
  }

  generateStrongPassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special
    
    // Fill the rest
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  hideSuggestion() {
    if (this.currentSuggestion) {
      this.currentSuggestion.remove();
      this.currentSuggestion = null;
    }
  }

  async showSavePrompt(passwordField) {
    const authState = await this.checkAuthState();
    if (!authState.isAuthenticated) return;

    const form = passwordField.closest('form');
    const usernameField = this.findUsernameField(form, passwordField);
    
    if (!usernameField || !usernameField.value) return;

    // Check if already saved
    const existing = await this.getExistingCredentials();
    if (existing && existing.username === usernameField.value) return;

    // Show save prompt
    this.showSaveNotification(passwordField, usernameField);
  }

  showSaveNotification(passwordField, usernameField) {
    // Remove existing notification
    const existing = document.querySelector('.securepass-save-prompt');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'securepass-save-prompt';
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>🔐</span>
        <span>Save password to SecurePass?</span>
        <button id="saveYes" style="background: #667eea; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Save</button>
        <button id="saveNo" style="background: #6b7280; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Not now</button>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Handle save action
    notification.querySelector('#saveYes').addEventListener('click', () => {
      this.savePasswordFromField(passwordField);
      notification.remove();
    });
    
    notification.querySelector('#saveNo').addEventListener('click', () => {
      notification.remove();
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  detectLoginForms() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    passwordFields.forEach(passwordField => {
      const form = passwordField.closest('form');
      const usernameField = this.findUsernameField(form, passwordField);
      
      if (usernameField) {
        this.addAutoFillButton(usernameField);
      }
    });
  }

  addAutoFillButton(usernameField) {
    // Skip if button already exists
    if (usernameField.parentNode.querySelector('.securepass-autofill')) return;

    const button = document.createElement('div');
    button.innerHTML = '🔐';
    button.className = 'securepass-autofill';
    button.title = 'Auto-fill with SecurePass';
    button.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      z-index: 10000;
      font-size: 16px;
      opacity: 0.6;
      transition: opacity 0.2s;
    `;
    
    usernameField.style.position = 'relative';
    usernameField.parentNode.style.position = 'relative';
    usernameField.parentNode.appendChild(button);
    
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.opacity = '0.6';
    });
    
    button.addEventListener('click', () => {
      this.requestCredentials(usernameField);
    });
  }

  async requestCredentials(usernameField) {
    try {
      const authState = await this.checkAuthState();
      if (!authState.isAuthenticated) {
        this.showNotification('Please sign in to SecurePass first', 'error');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: this.domain
      });
      
      if (response.credentials) {
        const passwordField = this.findPasswordField(usernameField);
        
        usernameField.value = response.credentials.username;
        if (passwordField) {
          passwordField.value = response.credentials.password;
        }
        
        // Trigger change events
        [usernameField, passwordField].filter(Boolean).forEach(field => {
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        this.showNotification('Credentials filled from SecurePass!', 'success');
      } else {
        this.showNotification('No saved credentials for this site', 'info');
      }
    } catch (error) {
      this.showNotification('Failed to get credentials', 'error');
    }
  }

  async savePasswordFromField(passwordField) {
    const form = passwordField.closest('form');
    const usernameField = this.findUsernameField(form, passwordField);
    
    if (!usernameField || !usernameField.value || !passwordField.value) {
      return;
    }

    try {
      const authState = await this.checkAuthState();
      if (!authState.isAuthenticated) {
        return;
      }

      await chrome.runtime.sendMessage({
        action: 'saveCredentials',
        data: {
          domain: this.domain,
          username: usernameField.value,
          password: passwordField.value
        }
      });
      
      this.showNotification('Password saved to SecurePass!', 'success');
    } catch (error) {
      console.error('Failed to save password:', error);
    }
  }

  async checkAuthState() {
    try {
      return await chrome.runtime.sendMessage({ action: 'checkAuth' });
    } catch (error) {
      return { isAuthenticated: false };
    }
  }

  async getExistingCredentials() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: this.domain
      });
      return response.credentials;
    } catch (error) {
      return null;
    }
  }

  findUsernameField(form, passwordField) {
    const selectors = [
      'input[type="email"]',
      'input[type="text"]',
      'input[name*="user"]',
      'input[name*="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]'
    ];
    
    for (const selector of selectors) {
      const field = form?.querySelector(selector) || 
                   document.querySelector(selector);
      if (field && field.offsetParent !== null) {
        return field;
      }
    }
    return null;
  }

  findPasswordField(usernameField) {
    const form = usernameField.closest('form');
    return form?.querySelector('input[type="password"]') || 
           document.querySelector('input[type="password"]');
  }

  showNotification(message, type) {
    // Remove existing notification
    const existing = document.querySelector('.securepass-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'securepass-notification';
    notification.textContent = message;
    
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation
    if (!document.querySelector('#securepass-styles')) {
      const style = document.createElement('style');
      style.id = 'securepass-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  observeFormChanges() {
    const observer = new MutationObserver(() => {
      this.detectPasswordFields();
      this.detectLoginForms();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

new SecurePassContent();
