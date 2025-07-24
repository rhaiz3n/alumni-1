// session-utils.js

export function setupSignOut(requiredRole = null) {
  window.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');

    // 🔒 Enforce role access if required
    if (requiredRole && role !== requiredRole) {
      window.location.href = 'homepage.html';
      return;
    }

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        sessionStorage.clear();

        const toast = document.createElement('div');
        toast.textContent = '👋 You have been signed out!';
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.background = '#333';
        toast.style.color = '#fff';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.zIndex = '9999';
        document.body.appendChild(toast);

        setTimeout(() => {
          window.location.href = 'homepage.html';
        }, 3000);
      });
    }
  });
}
