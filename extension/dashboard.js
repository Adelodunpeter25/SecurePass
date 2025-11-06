class PasswordDashboard {
  constructor() {
    this.passwords = [];
    this.filteredPasswords = [];
    this.editingPassword = null;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadUserInfo();
    await this.loadPasswords();
  }

  bindEvents() {
    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterPasswords(e.target.value);
    });

    // Health dashboard
    document.getElementById('healthBtn').addEventListener('click', () => {
      window.location.href = 'health.html';
    });

    // Import/Export
    document.getElementById('importExportBtn').addEventListener('click', () => {
      this.showImportExportModal();
    });

    // Add password
    document.getElementById('addPasswordBtn').addEventListener('click', () => {
      this.showAddModal();
    });

    // Modal events
    document.getElementById('closeModal').addEventListener('click', () => {
      this.hideModal();
    });
    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.hideModal();
    });
    document.getElementById('savePasswordBtn').addEventListener('click', () => {
      this.savePassword();
    });

    // Delete modal events
    document.getElementById('closeDeleteModal').addEventListener('click', () => {
      this.hideDeleteModal();
    });
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
      this.hideDeleteModal();
    });
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
      this.confirmDelete();
    });

    // Password generation and visibility
    document.getElementById('generatePasswordBtn').addEventListener('click', () => {
      this.generatePassword();
    });
    document.getElementById('togglePasswordBtn').addEventListener('click', () => {
      this.togglePasswordVisibility();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });
  }

  async loadUserInfo() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      if (response.isAuthenticated && response.user) {
        document.getElementById('userName').textContent = response.user.name || response.user.email;
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  }

  async loadPasswords() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllPasswords' });
      this.passwords = response.passwords || [];
      this.filteredPasswords = [...this.passwords];
      this.renderPasswords();
    } catch (error) {
      console.error('Failed to load passwords:', error);
      this.showError('Failed to load passwords');
    }
  }

  filterPasswords(query) {
    const searchQuery = query.trim().toLowerCase();
    
    if (!searchQuery) {
      this.filteredPasswords = [...this.passwords];
    } else {
      this.filteredPasswords = this.passwords.filter(password => {
        const website = (password.website || '').toLowerCase();
        const username = (password.username || '').toLowerCase();
        return website.includes(searchQuery) || username.includes(searchQuery);
      });
    }
    
    this.renderPasswords();
  }

  renderPasswords() {
    const container = document.getElementById('passwordList');
    
    if (this.filteredPasswords.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          ${this.passwords.length === 0 ? 
            'No passwords saved yet. Click "Add Password" to get started.' : 
            'No passwords match your search.'}
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredPasswords.map(password => `
      <div class="password-item" data-id="${password.id}">
        <div class="password-info">
          <div class="password-website">${this.escapeHtml(password.website)}</div>
          <div class="password-username">${this.escapeHtml(password.username || 'No username')}</div>
        </div>
        <div class="password-actions">
          <button class="action-btn copy-btn" data-id="${password.id}" title="Copy password">📋</button>
          <button class="action-btn edit-btn" data-id="${password.id}" title="Edit">✏️</button>
          <button class="action-btn delete-btn" data-id="${password.id}" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');

    // Add event listeners to the buttons
    container.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyPassword(btn.dataset.id);
      });
    });

    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editPassword(btn.dataset.id);
      });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePassword(btn.dataset.id);
      });
    });
  }

  showAddModal() {
    this.editingPassword = null;
    document.getElementById('modalTitle').textContent = 'Add Password';
    document.getElementById('modalWebsite').value = '';
    document.getElementById('modalUsername').value = '';
    document.getElementById('modalPassword').value = '';
    document.getElementById('passwordModal').classList.remove('hidden');
  }

  async editPassword(id) {
    const password = this.passwords.find(p => p.id === id);
    if (!password) return;

    try {
      // Get decrypted password
      const response = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: password.website
      });

      this.editingPassword = password;
      document.getElementById('modalTitle').textContent = 'Edit Password';
      document.getElementById('modalWebsite').value = password.website;
      document.getElementById('modalUsername').value = password.username || '';
      document.getElementById('modalPassword').value = response.credentials?.password || '';
      document.getElementById('passwordModal').classList.remove('hidden');
    } catch (error) {
      this.showError('Failed to load password for editing');
    }
  }

  async copyPassword(id) {
    const password = this.passwords.find(p => p.id === id);
    if (!password) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: password.website
      });

      if (response.credentials?.password) {
        await navigator.clipboard.writeText(response.credentials.password);
        this.showSuccess('Password copied to clipboard!');
      }
    } catch (error) {
      this.showError('Failed to copy password');
    }
  }

  deletePassword(id) {
    const password = this.passwords.find(p => p.id === id);
    if (!password) return;

    this.deletingPasswordId = id;
    document.getElementById('deleteWebsite').textContent = password.website;
    document.getElementById('deleteModal').classList.remove('hidden');
  }

  async confirmDelete() {
    if (!this.deletingPasswordId) return;

    try {
      await chrome.runtime.sendMessage({
        action: 'deletePassword',
        id: this.deletingPasswordId
      });

      this.passwords = this.passwords.filter(p => p.id !== this.deletingPasswordId);
      this.filterPasswords(document.getElementById('searchInput').value);
      this.hideDeleteModal();
      this.showSuccess('Password deleted successfully!');
    } catch (error) {
      this.showError('Failed to delete password');
    }
  }

  async savePassword() {
    const website = document.getElementById('modalWebsite').value.trim();
    const username = document.getElementById('modalUsername').value.trim();
    const password = document.getElementById('modalPassword').value;

    if (!website || !password) {
      this.showError('Website and password are required');
      return;
    }

    try {
      if (this.editingPassword) {
        await chrome.runtime.sendMessage({
          action: 'updatePassword',
          id: this.editingPassword.id,
          data: { website, username, password }
        });
        this.showSuccess('Password updated successfully!');
      } else {
        await chrome.runtime.sendMessage({
          action: 'saveCredentials',
          data: { domain: website, username, password }
        });
        this.showSuccess('Password saved successfully!');
      }

      this.hideModal();
      await this.loadPasswords();
    } catch (error) {
      this.showError('Failed to save password');
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
    
    document.getElementById('modalPassword').value = password;
  }

  togglePasswordVisibility() {
    const passwordField = document.getElementById('modalPassword');
    const toggleBtn = document.getElementById('togglePasswordBtn');
    
    if (passwordField.type === 'password') {
      passwordField.type = 'text';
      toggleBtn.textContent = '👁️';
    } else {
      passwordField.type = 'password';
      toggleBtn.textContent = '👁️‍🗨️';
    }
  }

  hideModal() {
    document.getElementById('passwordModal').classList.add('hidden');
  }

  hideDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    this.deletingPasswordId = null;
  }

  async logout() {
    try {
      await chrome.runtime.sendMessage({ action: 'signout' });
      window.location.href = 'popup.html';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showToast(message, type) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      ${type === 'success' ? 'background: #10b981;' : 'background: #ef4444;'}
    `;

    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }

  showImportExportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Import / Export</h3>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <button id="exportBtn" class="btn btn-primary" style="margin-bottom: 12px;">Export to CSV</button>
          <button id="importBtn" class="btn btn-secondary">Import from CSV</button>
          <input type="file" id="importFile" accept=".csv" style="display: none;">
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#exportBtn').addEventListener('click', () => this.exportPasswords());
    modal.querySelector('#importBtn').addEventListener('click', () => {
      modal.querySelector('#importFile').click();
    });
    modal.querySelector('#importFile').addEventListener('change', (e) => this.importPasswords(e));
  }

  async exportPasswords() {
    const passwords = [];
    for (let pwd of this.passwords) {
      const creds = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: pwd.website
      });
      passwords.push({
        name: pwd.website,
        url: `https://${pwd.website}`,
        username: pwd.username || '',
        password: creds?.password || ''
      });
    }

    const csv = 'name,url,username,password\n' + passwords.map(p => 
      `"${p.name}","${p.url}","${p.username}","${p.password}"`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securepass-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showSuccess('Passwords exported successfully!');
  }

  async importPasswords(event) {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').slice(1);
    let imported = 0;

    for (let line of lines) {
      if (!line.trim()) continue;
      const match = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);      if (match) {
        const [, name, url, username, password] = match;
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          await chrome.runtime.sendMessage({
            action: 'saveCredentials',
            data: { domain, username, password }
          });
          imported++;
        } catch (e) {
          console.error('Import error:', e);
        }
      }
    }

    document.querySelector('.modal').remove();
    this.showSuccess(`Imported ${imported} passwords!`);
    await this.loadPasswords();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize dashboard
const passwordDashboard = new PasswordDashboard();
