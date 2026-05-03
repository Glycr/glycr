// ===============================================
// CUSTOM MODAL DIALOGS
// ===============================================

let _customConfirmCallback = null;
let _customAlertCallback   = null;
let _customPromptCallback  = null;

function customConfirm(message, title = 'Confirm', okLabel = 'Confirm', okColor = '#ef4444') {
  return new Promise(resolve => {
    _customConfirmCallback = resolve;
    document.getElementById('custom-confirm-title').innerHTML =
      `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b; margin-right:0.5rem;"></i>${title}`;
    document.getElementById('custom-confirm-message').textContent = message;
    const btn = document.getElementById('custom-confirm-ok-btn');
    btn.textContent = okLabel;
    btn.style.background = okColor;
    openModal('custom-confirm-modal');
  });
}

function _customConfirmResolve(result) {
  closeModal('custom-confirm-modal');
  if (_customConfirmCallback) { _customConfirmCallback(result); _customConfirmCallback = null; }
}

function customAlert(message, title = 'Notice') {
  return new Promise(resolve => {
    _customAlertCallback = resolve;
    document.getElementById('custom-alert-title').innerHTML =
      `<i class="fa-solid fa-circle-info" style="color:#6366f1; margin-right:0.5rem;"></i>${title}`;
    document.getElementById('custom-alert-message').textContent = message;
    openModal('custom-alert-modal');
  });
}

function _customAlertResolve() {
  closeModal('custom-alert-modal');
  if (_customAlertCallback) { _customAlertCallback(); _customAlertCallback = null; }
}

function customPrompt(message, defaultValue = '', title = 'Input Required', placeholder = '') {
  return new Promise(resolve => {
    _customPromptCallback = resolve;
    document.getElementById('custom-prompt-title').innerHTML =
      `<i class="fa-solid fa-keyboard" style="color:#6366f1; margin-right:0.5rem;"></i>${title}`;
    document.getElementById('custom-prompt-message').textContent = message;
    const input = document.getElementById('custom-prompt-input');
    input.value = defaultValue;
    input.placeholder = placeholder;
    openModal('custom-prompt-modal');
    setTimeout(() => input.focus(), 100);
  });
}

function _customPromptResolve(value) {
  closeModal('custom-prompt-modal');
  if (_customPromptCallback) { _customPromptCallback(value); _customPromptCallback = null; }
}

function openModal(id)  { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
