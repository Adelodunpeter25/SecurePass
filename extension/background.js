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

    // Load existing session on startup
    await this.loadStoredSession();
  }

  async loadStoredSession() {
    const result = await chrome.storage.local.get(['authToken', 'masterKey', 'userSalt']);
    this.authToken = result.authToken || null;
    this.masterKey = result.masterKey || null;
    this.userSalt = result.userSalt || null;
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
        case 'getAllPasswords':
          const allPasswords = await this.getAllPasswords();
          sendResponse({ passwords: allPasswords });
          break;
        case 'updatePassword':
          await this.updatePassword(request.id, request.data);
          sendResponse({ success: true });
          break;
        case 'deletePassword':
          await this.deletePassword(request.id);
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async checkAuthState() {
    console.log('Checking auth state...');
    const result = await chrome.storage.local.get(['authToken', 'masterKey']);
    console.log('Storage result:', result);
    
    if (!result.authToken) {
      console.log('No auth token found');
      return { isAuthenticated: false, user: null };
    }

    this.authToken = result.authToken;
    this.masterKey = result.masterKey;
    console.log('Token loaded:', this.authToken ? 'Yes' : 'No');

    try {
      console.log('Verifying with backend...');
      const response = await fetch(`${this.apiUrl}/verify`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      console.log('Verify response status:', response.status);
      if (response.ok) {
        const user = await response.json();
        console.log('User verified:', user);
        return { isAuthenticated: true, user };
      } else {
        console.log('Token invalid, clearing storage');
        await chrome.storage.local.clear();
        return { isAuthenticated: false, user: null };
      }
    } catch (error) {
      console.error('Backend error:', error);
      return { isAuthenticated: false, user: null };
    }
  }

  async signup(name, email, password) {
    const salt = this.generateSalt();
    const response = await fetch(`${this.apiUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password, salt })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const data = await response.json();
    this.authToken = data.token;
    this.masterKey = password;
    this.userSalt = salt;

    await chrome.storage.local.set({
      authToken: this.authToken,
      masterKey: this.masterKey,
      userSalt: salt
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
    this.userSalt = data.salt;

    await chrome.storage.local.set({
      authToken: this.authToken,
      masterKey: this.masterKey,
      userSalt: data.salt
    });
  }

  async signout() {
    if (this.authToken) {
      try {
        await fetch(`${this.apiUrl}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    
    this.authToken = null;
    this.masterKey = null;
    await chrome.storage.local.clear();
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

  async getAllPasswords() {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.apiUrl}/passwords`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch passwords');
    }

    return await response.json();
  }

  async updatePassword(id, data) {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const encrypted = await this.encrypt(data.password);
    
    const response = await fetch(`${this.apiUrl}/passwords/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        website: data.website,
        username: data.username,
        password_blob: encrypted
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update password');
    }
  }

  async deletePassword(id) {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.apiUrl}/passwords/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete password');
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

  generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
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
    
    const salt = this.userSalt || 'securepass-salt';
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
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
