class SecurePassPopup {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.getCurrentTab();
  }

  bindEvents() {
    document.getElementById('unlockBtn').addEventListener('click', () => this.unlock());
    document.getElementById('saveBtn').addEventListener('click', () => this.savePassword());
    document.getElementById('generateBtn').addEventListener('click', () => this.generatePassword());
    
    document.getElementById('masterPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.unlock();
    });
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const url = new URL(tab.url);
      document.getElementById('website').value = url.hostname;
    }
  }

  async unlock() {
    const masterPassword = document.getElementById('masterPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!masterPassword) {
      errorDiv.textContent = 'Please enter master password';
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'setMasterKey',
        key: masterPassword
      });
      
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('mainInterface').classList.remove('hidden');
    } catch (error) {
      errorDiv.textContent = 'Invalid master password';
    }
  }

  async savePassword() {
    const website = document.getElementById('website').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');

    if (!website || !username || !password) {
      messageDiv.textContent = 'Please fill all fields';
      messageDiv.className = 'error';
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'saveCredentials',
        data: {
          domain: website,
          username: username,
          password: password
        }
      });
      
      messageDiv.textContent = 'Password saved successfully!';
      messageDiv.className = 'success';
      
      // Clear form
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
    } catch (error) {
      messageDiv.textContent = 'Failed to save password';
      messageDiv.className = 'error';
    }
  }

  generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    document.getElementById('password').value = password;
  }
}

new SecurePassPopup();
