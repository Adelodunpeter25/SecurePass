class SecurePassBackground {
  constructor() {
    this.apiUrl = 'http://localhost:3000/api';
    this.masterKey = null;
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getCredentials':
          const credentials = await this.getCredentials(request.domain);
          sendResponse({ credentials });
          break;
        case 'saveCredentials':
          await this.saveCredentials(request.data);
          sendResponse({ success: true });
          break;
        case 'setMasterKey':
          this.masterKey = request.key;
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async getCredentials(domain) {
    if (!this.masterKey) {
      throw new Error('Master key not set');
    }

    const response = await fetch(`${this.apiUrl}/passwords/${domain}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch credentials');
    }

    const data = await response.json();
    if (data.password_blob) {
      const decrypted = await this.decrypt(data.password_blob);
      return {
        username: data.username,
        password: decrypted
      };
    }
    return null;
  }

  async saveCredentials(credentialData) {
    if (!this.masterKey) {
      throw new Error('Master key not set');
    }

    const encrypted = await this.encrypt(credentialData.password);
    
    const response = await fetch(`${this.apiUrl}/passwords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify({
        website: credentialData.domain,
        username: credentialData.username,
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

  async getAuthToken() {
    const result = await chrome.storage.local.get(['authToken']);
    return result.authToken;
  }
}

new SecurePassBackground();
