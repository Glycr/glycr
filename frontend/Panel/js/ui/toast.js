// ===============================================
// TOAST NOTIFICATION SYSTEM
// ===============================================

const TOAST_ICONS = {
  success: 'fa-solid fa-circle-check',
  error:   'fa-solid fa-circle-xmark',
  warning: 'fa-solid fa-triangle-exclamation',
  info:    'fa-solid fa-circle-info',
};
let _toastIdCounter = 0;

function showToast(type = 'info', title = '', message = '', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const id = ++_toastIdCounter;
  const iconCls = TOAST_ICONS[type] || TOAST_ICONS.info;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = `toast-${id}`;
  toast.style.setProperty('--toast-duration', `${duration}ms`);
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-icon"><i class="${iconCls}"></i></div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="dismissToast(${id})" aria-label="Close">
      <i class="fa-solid fa-xmark"></i>
    </button>`;
  container.appendChild(toast);

  let startTime = Date.now();
  let remaining = duration;
  let dismissTimer = setTimeout(() => dismissToast(id), remaining);
  toast._dismissTimer = dismissTimer;

  toast.addEventListener('mouseenter', () => {
    clearTimeout(toast._dismissTimer);
    remaining -= (Date.now() - startTime);
    toast.style.setProperty('--toast-duration', `${remaining}ms`);
    toast.classList.add('toast-paused');
  });
  toast.addEventListener('mouseleave', () => {
    toast.classList.remove('toast-paused');
    startTime = Date.now();
    toast.style.setProperty('--toast-duration', `${remaining}ms`);
    void toast.offsetWidth;
    toast._dismissTimer = setTimeout(() => dismissToast(id), remaining);
  });
}

function dismissToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;
  clearTimeout(toast._dismissTimer);
  toast.classList.add('toast-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

const toast = {
  success: (t, m, d) => showToast('success', t, m, d),
  error:   (t, m, d) => showToast('error',   t, m, d),
  warning: (t, m, d) => showToast('warning', t, m, d),
  info:    (t, m, d) => showToast('info',    t, m, d),
};
