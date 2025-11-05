class SecurePassBackground {
  constructor() {
    this.masterKey = null;
    this.isLoggedIn = false;
    this.dbName = 'securepass_db';
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
    
    this.initDatabase();
  }

  async initDatabase() {
    // Create tables if they don't exist
    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        master_password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS passwords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website TEXT NOT NULL,
        username TEXT,
        password_blob TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async executeSQL(query, params = []) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.dbName], (result) => {
        let db = result[this.dbName] || { users: [], passwords: [] };
        
        try {
          if (query.includes('CREATE TABLE')) {
            // Tables are created in memory structure
            resolve();
          } else if (query.includes('INSERT INTO users')) {
            const id = db.users.length + 1;
            db.users.push({
              id,
              master_password_hash: params[0],
              created_at: new Date().toISOString()
            });
            chrome.storage.local.set({ [this.dbName]: db }, () => resolve({ insertId: id }));
          } else if (query.includes('SELECT * FROM users')) {
            resolve({ rows: db.users });
          } else if (query.includes('INSERT INTO passwords')) {
            const id = db.passwords.length + 1;
            db.passwords.push({
              id,
              website: params[0],
              username: params[1],
              password_blob: params[2],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            chrome.storage.local.set({ [this.dbName]: db }, () => resolve({ insertId: id }));
          } else if (query.includes('SELECT * FROM passwords WHERE website')) {
            const website = params[0];
            const passwords = db.passwords.filter(p => p.website === website);
            resolve({ rows: passwords });
          } else if (query.includes('SELECT * FROM passwords')) {
            resolve({ rows: db.passwords });
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'checkLoginState':
          sendResponse({ isLoggedIn: this.isLoggedIn });
          break;
        case 'setupMasterPassword':
          await this.setupMasterPassword(request.password);
          sendResponse({ success: true });
          break;
        case 'login':
          const loginResult = await this.login(request.password);
          sendResponse(loginResult);
          break;
        case 'getCredentials':
          const credentials = await this.getCredentials(request.domain);
          sendResponse({ credentials });
          break;
        case 'saveCredentials':
          await this.saveCredentials(request.data);
          sendResponse({ success: true });
          break;
        case 'logout':
          this.logout();
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async setupMasterPassword(password) {
    const hashedPassword = await this.hashPassword(password);
    await this.executeSQL(
      'INSERT INTO users (master_password_hash) VALUES (?)',
      [hashedPassword]
    );
    
    this.masterKey = password;
    this.isLoggedIn = true;
  }

  async login(password) {
    const result = await this.executeSQL('SELECT * FROM users');
    
    if (result.rows.length === 0) {
      throw new Error('No master password set. Please set up SecurePass first.');
    }

    const user = result.rows[0];
    const isValid = await this.verifyPassword(password, user.master_password_hash);
    
    if (!isValid) {
      throw new Error('Invalid master password');
    }

    this.masterKey = password;
    this.isLoggedIn = true;
    return { success: true };
  }

  logout() {
    this.masterKey = null;
    this.isLoggedIn = false;
  }

  async getCredentials(domain) {
    if (!this.isLoggedIn) {
      throw new Error('Not logged in');
    }

    const result = await this.executeSQL(
      'SELECT * FROM passwords WHERE website = ?',
      [domain]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const passwordData = result.rows[0];
    const decrypted = await this.decrypt(passwordData.password_blob);
    
    return {
      username: passwordData.username,
      password: decrypted
    };
  }

  async saveCredentials(credentialData) {
    if (!this.isLoggedIn) {
      throw new Error('Not logged in');
    }

    const encrypted = await this.encrypt(credentialData.password);
    
    await this.executeSQL(
      'INSERT INTO passwords (website, username, password_blob) VALUES (?, ?, ?)',
      [credentialData.domain, credentialData.username, encrypted]
    );
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }

  async verifyPassword(password, hash) {
    const hashedInput = await this.hashPassword(password);
    return hashedInput === hash;
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
