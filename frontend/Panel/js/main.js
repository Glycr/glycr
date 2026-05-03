// ===============================================
// INITIALIZATION & EVENT LISTENERS
// ===============================================

// DOMContentLoaded listener (for elements that exist on page load)
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing session
  if (sessionStorage.getItem('glycr_admin_auth') === 'true') {
    const token   = sessionStorage.getItem('glycr_admin_token');
    const userStr = sessionStorage.getItem('glycr_admin_user');
    if (token && userStr) {
      authToken    = token;
      currentAdmin = { ...JSON.parse(userStr) };
      currentAdmin.role = currentAdmin.role || 'customer';
      _showPanel();
      initSession();
      loadPlatformFee().then(() => loadData());
    }
  }

  // Export range listeners
  document.querySelectorAll('input[name="export-range"]').forEach(r =>
    r.addEventListener('change', () => {
      const isCustom = document.querySelector('input[name="export-range"]:checked')?.value === 'custom';
      document.getElementById('custom-date-range').style.display = isCustom ? 'block' : 'none';
      updateExportPreview();
    })
  );
  document.querySelectorAll('input[name="export-format"]').forEach(r => r.addEventListener('change', updateExportPreview));
  document.getElementById('export-date-from')?.addEventListener('change', updateExportPreview);
  document.getElementById('export-date-to')?.addEventListener('change', updateExportPreview);
  document.getElementById('new-password')?.addEventListener('input', checkPasswordStrength);
  document.querySelectorAll('input[name="broadcast-audience"]').forEach(r =>
    r.addEventListener('change', updateBroadcastAudiencePreview)
  );

  // Modal close on background click
  document.querySelectorAll('.modal').forEach(modal =>
    modal.addEventListener('click', e => {
      if (['custom-confirm-modal','custom-alert-modal','custom-prompt-modal'].includes(modal.id)) return;
      if (e.target === modal) modal.classList.remove('show');
    })
  );
  // Escape key closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(m => {
        if (!['custom-confirm-modal','custom-alert-modal','custom-prompt-modal'].includes(m.id)) {
          m.classList.remove('show');
        }
      });
    }
  });
});

// Global keydown for login and prompt
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') handleLogin();
  if (e.key === 'Enter' && document.getElementById('custom-prompt-modal')?.classList.contains('show')) {
    _customPromptResolve(document.getElementById('custom-prompt-input').value);
  }
});

// Initial data load (if already logged in, loadData will be called from DOMContentLoaded)
// If not logged in, nothing loads yet – login will trigger loadData.
