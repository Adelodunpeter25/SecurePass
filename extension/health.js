class PasswordHealth {
  constructor() {
    this.passwords = [];
    this.init();
  }

  async init() {
    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
    await this.loadPasswords();
    this.analyzeHealth();
  }

  async loadPasswords() {
    const response = await chrome.runtime.sendMessage({ action: 'getAllPasswords' });
    this.passwords = response.passwords || [];
    
    for (let pwd of this.passwords) {
      const creds = await chrome.runtime.sendMessage({
        action: 'getCredentials',
        domain: pwd.website
      });
      pwd.decryptedPassword = creds?.password || '';
    }
  }

  analyzeHealth() {
    const weak = [];
    const reused = [];
    const old = [];
    const passwordMap = {};

    this.passwords.forEach(pwd => {
      if (this.isWeakPassword(pwd.decryptedPassword)) {
        weak.push(pwd);
      }
      
      if (passwordMap[pwd.decryptedPassword]) {
        if (!reused.find(p => p.decryptedPassword === pwd.decryptedPassword)) {
          reused.push(passwordMap[pwd.decryptedPassword]);
        }
        reused.push(pwd);
      } else {
        passwordMap[pwd.decryptedPassword] = pwd;
      }
      
      if (this.isOldPassword(pwd.updated_at || pwd.created_at)) {
        old.push(pwd);
      }
    });

    const score = Math.max(0, 100 - (weak.length * 10) - (reused.length * 5) - (old.length * 3));
    
    const scoreEl = document.getElementById('healthScore');
    scoreEl.textContent = score;
    scoreEl.className = 'health-score';
    if (score >= 80) scoreEl.classList.add('good');
    else if (score >= 50) scoreEl.classList.add('warning');
    else scoreEl.classList.add('danger');

    document.getElementById('healthSummary').textContent = 
      score >= 80 ? 'Excellent password security!' :
      score >= 50 ? 'Good, but room for improvement' :
      'Action needed to improve security';

    this.renderList('weakList', 'weakCount', weak, 'weak');
    this.renderList('reusedList', 'reusedCount', reused, 'reused');
    this.renderList('oldList', 'oldCount', old, 'old');
  }

  isWeakPassword(password) {
    if (!password || password.length < 8) return true;
    let strength = 0;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength < 3;
  }

  isOldPassword(date) {
    if (!date) return false;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return new Date(date) < sixMonthsAgo;
  }

  renderList(listId, countId, items, type) {
    document.getElementById(countId).textContent = items.length;
    const container = document.getElementById(listId);
    
    if (items.length === 0) {
      container.innerHTML = '<div style="color: #71717a; font-size: 13px; padding: 12px;">None found</div>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="health-item">
        <div>
          <div style="font-weight: 600; color: #e4e4e7; font-size: 14px;">${this.escapeHtml(item.website)}</div>
          <div style="color: #a1a1aa; font-size: 12px;">${this.escapeHtml(item.username || 'No username')}</div>
        </div>
        <span class="health-badge ${type}">${type.toUpperCase()}</span>
      </div>
    `).join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

new PasswordHealth();
