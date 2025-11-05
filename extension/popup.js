class SecurePassPopup {
  constructor() {
    this.isSignupMode = true;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkAuthState();
  }

  bindEvents() {
    const authBtn = document.getElementById('authBtn');
    const toggleAuth = document.getElementById('toggleAuth');
    const logoutBtn = document.getElementById('logoutBtn');
    const generateBtn = document.getElementById('generateBtn');
    const authPassword = document.getElementById('authPassword');
    const eyeIcon = document.getElementById('eyeIcon');

    if (authBtn) {
      authBtn.addEventListener('click', () => this.handleAuth());
    }
    
    if (toggleAuth) {
      toggleAuth.addEventListener('click', () => this.toggleAuthMode());
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.signout());
    }
    
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generatePassword());
    }
    
    if (authPassword) {
      authPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleAuth();
      });
    }

    // Eye icon functionality
    if (eyeIcon && authPassword) {
      let isPasswordVisible = false;

      eyeIcon.addEventListener('click', () => {
        isPasswordVisible = !isPasswordVisible;
        authPassword.type = isPasswordVisible ? 'text' : 'password';
        eyeIcon.innerHTML = isPasswordVisible ? '👁️' : '👁️‍🗨️';
      });

      eyeIcon.addEventListener('mouseenter', () => {
        eyeIcon.style.opacity = '1';
      });

      eyeIcon.addEventListener('mouseleave', () => {
        eyeIcon.style.opacity = '0.6';
      });
    }
  }

  async checkAuthState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      
      if (response.isAuthenticated) {
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
      } else {
        this.showAuthForm();
      }
    } catch (error) {
      this.showAuthForm();
    }
  }

  showAuthForm() {
    document.getElementById('authForm').classList.remove('hidden');
  }

  showMainInterface(user) {
    // Redirect to dashboard instead of showing inline interface
    window.location.href = 'dashboard.html';
  }

  toggleAuthMode() {
    this.isSignupMode = !this.isSignupMode;
    const nameGroup = document.getElementById('nameGroup');
    
    if (this.isSignupMode) {
      document.getElementById('authSubtitle').textContent = 'Sign up to get started';
      document.getElementById('passwordLabel').textContent = 'Create Password';
      document.getElementById('authPassword').placeholder = 'Create a strong password';
      document.getElementById('authBtn').textContent = 'Sign Up';
      document.getElementById('toggleAuth').textContent = 'Already have an account? Sign in';
      nameGroup.style.display = 'block';
    } else {
      document.getElementById('authSubtitle').textContent = 'Sign in to continue';
      document.getElementById('passwordLabel').textContent = 'Password';
      document.getElementById('authPassword').placeholder = 'Enter your password';
      document.getElementById('authBtn').textContent = 'Sign In';
      document.getElementById('toggleAuth').textContent = "Don't have an account? Sign up";
      nameGroup.style.display = 'none';
    }
    
    this.clearError();
  }

  async handleAuth() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('authPassword').value;
    const authBtn = document.getElementById('authBtn');
    
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    if (this.isSignupMode && !name) {
      this.showError('Please enter your name');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showError('Please enter a valid email');
      return;
    }

    if (password.length < 8) {
      this.showError('Password must be at least 8 characters');
      return;
    }

    // Set loading state
    authBtn.disabled = true;
    const originalText = authBtn.textContent;
    authBtn.textContent = 'Loading...';
    authBtn.style.opacity = '0.7';

    try {
      if (this.isSignupMode) {
        await chrome.runtime.sendMessage({
          action: 'signup',
          name,
          email,
          password
        });
      } else {
        await chrome.runtime.sendMessage({
          action: 'signin',
          email,
          password
        });
      }
      
      this.showMainInterface({ name, email });
    } catch (error) {
      this.showError(error.message);
    } finally {
      // Reset button state
      authBtn.disabled = false;
      authBtn.textContent = originalText;
      authBtn.style.opacity = '1';
    }
  }

  async signout() {
    try {
      await chrome.runtime.sendMessage({ action: 'signout' });
      this.showAuthForm();
      this.clearForm();
    } catch (error) {
      console.error('Signout failed:', error);
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
    
    document.getElementById('generatedPassword').value = password;
    
    // Copy to clipboard
    navigator.clipboard.writeText(password).then(() => {
      this.showMessage('Password copied to clipboard!', 'success');
    });
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  showError(message) {
    document.getElementById('authError').textContent = message;
  }

  clearError() {
    document.getElementById('authError').textContent = '';
  }

  clearForm() {
    document.getElementById('name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('authPassword').value = '';
    this.clearError();
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
