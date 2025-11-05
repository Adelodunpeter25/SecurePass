class SecurePassContent {
  constructor() {
    this.domain = window.location.hostname;
    this.init();
  }

  init() {
    this.detectLoginForms();
    this.observeFormChanges();
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

  findUsernameField(form, passwordField) {
    const selectors = [
      'input[type="email"]',
      'input[type="text"]',
      'input[name*="user"]',
      'input[name*="email"]'
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
    const button = document.createElement('div');
    button.innerHTML = '🔐';
    button.style.cssText = `
      position: absolute;
      right: 5px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      z-index: 10000;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 3px;
      padding: 2px 5px;
    `;
    
    usernameField.style.position = 'relative';
    usernameField.parentNode.style.position = 'relative';
    usernameField.parentNode.appendChild(button);
    
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
      }
    } catch (error) {
      console.error('SecurePass: Failed to get credentials', error);
    }
  }

  observeFormChanges() {
    const observer = new MutationObserver(() => {
      this.detectLoginForms();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

new SecurePassContent();
