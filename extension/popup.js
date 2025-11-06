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
      authPassword.addEventListener('input', () => this.checkPasswordStrength());
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
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      if (response.isAuthenticated) {
        window.location.href = 'dashboard.html';
      } else {
        this.showAuthForm();
      }
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      this.showAuthForm();
    }
  }

  showAuthForm() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('authForm').classList.remove('hidden');
  }

  showMainInterface(user) {
    // Redirect to dashboard instead of showing inline interface
    window.location.href = 'dashboard.html';
  }

  checkPasswordStrength() {
    const password = document.getElementById('authPassword').value;
    const meter = document.getElementById('strengthMeter');
    const bar = meter.querySelector('.strength-bar');
    const text = meter.querySelector('.strength-text');
    
    if (!password || !this.isSignupMode) {
      meter.classList.add('hidden');
      return;
    }
    
    meter.classList.remove('hidden');
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    bar.className = 'strength-bar';
    text.className = 'strength-text';
    
    if (strength <= 2) {
      bar.classList.add('weak');
      text.classList.add('weak');
      text.textContent = 'Weak password';
    } else if (strength <= 4) {
      bar.classList.add('medium');
      text.classList.add('medium');
      text.textContent = 'Medium strength';
    } else {
      bar.classList.add('strong');
      text.classList.add('strong');
      text.textContent = 'Strong password';
    }
  }

  toggleAuthMode() {
    this.isSignupMode = !this.isSignupMode;
    const nameGroup = document.getElementById('nameGroup');
    const meter = document.getElementById('strengthMeter');
    
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
      meter.classList.add('hidden');
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
      console.log('Calling background script...');
      const response = await chrome.runtime.sendMessage({
        action: this.isSignupMode ? 'signup' : 'signin',
        name,
        email,
        password
      });
      
      console.log('Background response:', response);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Only redirect on successful authentication
      console.log('Authentication successful, redirecting...');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Auth error:', error);
      this.showError(error.message || 'Authentication failed');
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
