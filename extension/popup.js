class SecurePassPopup {
  constructor() {
    this.currentDomain = '';
    this.isFirstTime = false;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.getCurrentTab();
    await this.checkLoginState();
  }

  bindEvents() {
    document.getElementById('unlockBtn').addEventListener('click', () => this.handleAuth());
    document.getElementById('saveBtn').addEventListener('click', () => this.savePassword());
    document.getElementById('generateBtn').addEventListener('click', () => this.generatePassword());
    
    document.getElementById('masterPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleAuth();
    });
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        this.currentDomain = url.hostname;
        document.getElementById('currentSite').textContent = this.currentDomain;
      }
    } catch (error) {
      document.getElementById('currentSite').textContent = 'Unknown site';
    }
  }

  async checkLoginState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkLoginState' });
      
      if (response.isLoggedIn) {
        this.showMainInterface();
        await this.loadExistingCredentials();
      } else {
        await this.checkIfFirstTime();
      }
    } catch (error) {
      await this.checkIfFirstTime();
    }
  }

  async checkIfFirstTime() {
    try {
      // Try to login with empty password to check if user exists
      await chrome.runtime.sendMessage({ 
        action: 'login', 
        password: '' 
      });
    } catch (error) {
      if (error.message && error.message.includes('No master password set')) {
        this.isFirstTime = true;
        this.showSetupInterface();
      } else {
        this.showLoginInterface();
      }
    }
  }

  showSetupInterface() {
    document.querySelector('.header h2').textContent = '🔐 Setup SecurePass';
    document.querySelector('.header p').textContent = 'Create your master password';
    document.querySelector('label').textContent = 'Create Master Password';
    document.getElementById('masterPassword').placeholder = 'Create a strong master password';
    document.getElementById('unlockBtn').textContent = 'Create Vault';
  }

  showLoginInterface() {
    document.querySelector('.header h2').textContent = '🔐 SecurePass';
    document.querySelector('.header p').textContent = 'Enter your master password';
    document.querySelector('label').textContent = 'Master Password';
    document.getElementById('masterPassword').placeholder = 'Enter your master password';
    document.getElementById('unlockBtn').textContent = 'Unlock Vault';
  }

  showMainInterface() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('mainInterface').classList.remove('hidden');
  }

  async handleAuth() {
    const masterPassword = document.getElementById('masterPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!masterPassword) {
      errorDiv.textContent = 'Please enter a master password';
      return;
    }

    if (masterPassword.length < 8) {
      errorDiv.textContent = 'Master password must be at least 8 characters';
      return;
    }

    try {
      if (this.isFirstTime) {
        await chrome.runtime.sendMessage({
          action: 'setupMasterPassword',
          password: masterPassword
        });
      } else {
        await chrome.runtime.sendMessage({
          action: 'login',
          password: masterPassword
        });
      }
      
      this.showMainInterface();
      await this.loadExistingCredentials();
    } catch (error) {
      errorDiv.textContent = error.message || 'Authentication failed';
    }
  }

  async loadExistingCredentials() {
    if (!this.currentDomain) return;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: this.currentDomain
      });
      
      if (response.credentials) {
        document.getElementById('username').value = response.credentials.username || '';
        document.getElementById('statusText').textContent = `Credentials found for ${this.currentDomain}`;
      } else {
        document.getElementById('statusText').textContent = `No saved credentials for ${this.currentDomain}`;
      }
    } catch (error) {
      document.getElementById('statusText').textContent = 'Ready to save passwords';
    }
  }

  async savePassword() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!this.currentDomain) {
      this.showMessage('Unable to detect current website', 'error');
      return;
    }

    if (!username || !password) {
      this.showMessage('Please fill in both username and password', 'error');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'saveCredentials',
        data: {
          domain: this.currentDomain,
          username: username,
          password: password
        }
      });
      
      this.showMessage('Password saved successfully!', 'success');
      document.getElementById('statusText').textContent = `Credentials saved for ${this.currentDomain}`;
      
      // Clear password field after saving
      document.getElementById('password').value = '';
    } catch (error) {
      this.showMessage('Failed to save password', 'error');
    }
  }

  generatePassword() {
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
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    document.getElementById('password').value = password;
    this.showMessage('Strong password generated!', 'success');
  }

  showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = type;
    
    setTimeout(() => {
      messageDiv.textContent = '';
      messageDiv.className = '';
    }, 3000);
  }
}

new SecurePassPopup();
