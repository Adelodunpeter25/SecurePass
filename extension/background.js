class SecurePassBackground {
  constructor() {
    this.apiUrl = 'http://localhost:3000/api';
    this.authToken = null;
    this.masterKey = null;
    this.init();
  }

  async init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // Check for existing session
    const result = await chrome.storage.local.get(['authToken', 'masterKey']);
    this.authToken = result.authToken;
    this.masterKey = result.masterKey;
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'checkAuth':
          const authState = await this.checkAuthState();
          sendResponse(authState);
          break;
        case 'signup':
          await this.signup(request.name, request.email, request.password);
          sendResponse({ success: true });
          break;
        case 'signin':
          await this.signin(request.email, request.password);
          sendResponse({ success: true });
          break;
        case 'signout':
          await this.signout();
          sendResponse({ success: true });
          break;
        case 'getCredentials':
          const credentials = await this.getCredentials(request.domain);
          sendResponse({ credentials });
          break;
        case 'saveCredentials':
          await this.saveCredentials(request.data);
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async checkAuthState() {
    if (!this.authToken) {
      return { isAuthenticated: false, user: null };
    }

    try {
      // Verify token with backend
      const response = await fetch(`${this.apiUrl}/verify`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (response.ok) {
        const user = await response.json();
        return { isAuthenticated: true, user };
      } else {
        // Token invalid, clear it
        await this.signout();
        return { isAuthenticated: false, user: null };
      }
    } catch (error) {
      return { isAuthenticated: false, user: null };
    }
  }

  async signup(name, email, password) {
    const response = await fetch(`${this.apiUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const data = await response.json();
    this.authToken = data.token;
    this.masterKey = password;

    // Store session
    await chrome.storage.local.set({
      authToken: this.authToken,
      masterKey: this.masterKey,
      user: { name, email }
    });
  }

  async signin(email, password) {
    const response = await fetch(`${this.apiUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signin failed');
    }

    const data = await response.json();
    this.authToken = data.token;
    this.masterKey = password;

    // Store session
    await chrome.storage.local.set({
      authToken: this.authToken,
      masterKey: this.masterKey,
      user: { name: data.name, email }
    });
  }

  async signout() {
    this.authToken = null;
    this.masterKey = null;
    await chrome.storage.local.remove(['authToken', 'masterKey', 'user']);
  }

  async getCredentials(domain) {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.apiUrl}/passwords/${domain}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch credentials');
    }

    const data = await response.json();
    const decrypted = await this.decrypt(data.password_blob);
    
    return {
      username: data.username,
      password: decrypted
    };
  }

  async saveCredentials(data) {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const encrypted = await this.encrypt(data.password);
    
    const response = await fetch(`${this.apiUrl}/passwords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        website: data.domain,
        username: data.username,
        password_blob: encrypted
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save credentials');
    }
  }

  async encrypt(plaintext) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const key = await this.deriveKey(this.masterKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...result));
  }

  async decrypt(encryptedData) {
    const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    
    const key = await this.deriveKey(this.masterKey);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  }

  async deriveKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('securepass-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

new SecurePassBackground();
