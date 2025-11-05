class SecurePassContent {
  constructor() {
    this.domain = window.location.hostname;
    this.init();
  }

  init() {
    this.detectLoginForms();
    this.observeFormChanges();
    this.detectPasswordFields();
  }

  detectLoginForms() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    passwordFields.forEach(passwordField => {
      const form = passwordField.closest('form');
      const usernameField = this.findUsernameField(form, passwordField);
      
      if (usernameField) {
        this.addAutoFillButton(usernameField, passwordField);
      }
    });
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

    // Add generate password button
    const generateBtn = this.createPasswordButton('🎲', 'Generate password');
    generateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.generatePasswordForField(passwordField);
    });

    // Add save password button (appears after typing)
    const saveBtn = this.createPasswordButton('💾', 'Save password');
    saveBtn.style.right = '35px';
    saveBtn.style.display = 'none';
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.savePasswordFromField(passwordField);
    });

    wrapper.appendChild(generateBtn);
    wrapper.appendChild(saveBtn);

    // Show save button when password is entered
    passwordField.addEventListener('input', () => {
      if (passwordField.value.length > 0) {
        saveBtn.style.display = 'block';
      } else {
        saveBtn.style.display = 'none';
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

  createPasswordButton(icon, title) {
    const button = document.createElement('div');
    button.innerHTML = icon;
    button.title = title;
    button.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      z-index: 10000;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 4px 6px;
      font-size: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: all 0.2s;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f0f0f0';
      button.style.transform = 'translateY(-50%) scale(1.1)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = '#fff';
      button.style.transform = 'translateY(-50%) scale(1)';
    });

    return button;
  }

  generatePasswordForField(passwordField) {
    const password = this.generateStrongPassword();
    passwordField.value = password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Show notification
    this.showNotification('Strong password generated!', 'success');
  }

  async savePasswordFromField(passwordField) {
    const form = passwordField.closest('form');
    const usernameField = this.findUsernameField(form, passwordField);
    
    if (!usernameField || !usernameField.value || !passwordField.value) {
      this.showNotification('Please fill in both username and password', 'error');
      return;
    }

    try {
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
      this.showNotification('Failed to save password', 'error');
    }
  }

  generateStrongPassword() {
    const length = 16;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
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

  addAutoFillButton(usernameField, passwordField) {
    // Skip if button already exists
    if (usernameField.parentNode.querySelector('.securepass-autofill')) return;

    const button = document.createElement('div');
    button.innerHTML = '🔐';
    button.className = 'securepass-autofill';
    button.title = 'Auto-fill with SecurePass';
    button.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      z-index: 10000;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 6px;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: all 0.2s;
    `;
    
    usernameField.style.position = 'relative';
    usernameField.parentNode.style.position = 'relative';
    usernameField.parentNode.appendChild(button);
    
    button.addEventListener('mouseenter', () => {
      button.style.background = '#5a67d8';
      button.style.transform = 'translateY(-50%) scale(1.1)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = '#667eea';
      button.style.transform = 'translateY(-50%) scale(1)';
    });
    
    button.addEventListener('click', () => {
      this.requestCredentials(usernameField, passwordField);
    });
  }

  async requestCredentials(usernameField, passwordField) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: this.domain
      });
      
      if (response.credentials) {
        usernameField.value = response.credentials.username;
        passwordField.value = response.credentials.password;
        
        // Trigger change events
        [usernameField, passwordField].forEach(field => {
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
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 3000);
  }

  observeFormChanges() {
    const observer = new MutationObserver(() => {
      this.detectLoginForms();
      this.detectPasswordFields();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

new SecurePassContent();
