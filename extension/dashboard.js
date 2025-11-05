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
    if (!query.trim()) {
      this.filteredPasswords = [...this.passwords];
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredPasswords = this.passwords.filter(password => 
        password.website.toLowerCase().includes(lowerQuery) ||
        (password.username && password.username.toLowerCase().includes(lowerQuery))
      );
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
          <button class="action-btn" onclick="passwordDashboard.copyPassword('${password.id}')" title="Copy password">📋</button>
          <button class="action-btn" onclick="passwordDashboard.editPassword('${password.id}')" title="Edit">✏️</button>
          <button class="action-btn" onclick="passwordDashboard.deletePassword('${password.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
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
    // You can implement a toast notification here
    console.error(message);
  }

  showSuccess(message) {
    // You can implement a toast notification here
    console.log(message);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize dashboard
const passwordDashboard = new PasswordDashboard();
