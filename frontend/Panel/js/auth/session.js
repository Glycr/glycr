// ===============================================
// SESSION MANAGEMENT
// ===============================================

const SESSION_INACTIVITY_MS = 15 * 60 * 1000;
const SESSION_TOTAL_MS      = 30 * 60 * 1000;
const SESSION_WARN_BEFORE   =      60 * 1000;

let sessionStartTime     = null;
let lastActivityTime     = null;
let sessionCheckInterval = null;
let countdownInterval    = null;
let sessionWarningShown  = false;

function initSession() {
  sessionStartTime    = Date.now();
  lastActivityTime    = Date.now();
  sessionWarningShown = false;
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);
  sessionCheckInterval = setInterval(checkSession, 5000);
  ['mousemove','keydown','click','scroll','touchstart'].forEach(evt =>
    document.addEventListener(evt, onUserActivity, { passive: true })
  );
  updateSessionTimerDisplay();
}

function onUserActivity() {
  lastActivityTime = Date.now();
  if (sessionWarningShown) extendSession();
}

function checkSession() {
  if (!sessionStartTime) return;
  const now          = Date.now();
  const inactiveFor  = now - lastActivityTime;
  const totalElapsed = now - sessionStartTime;
  updateSessionTimerDisplay();
  if (totalElapsed >= SESSION_TOTAL_MS) { forceLogout('Your 30-minute session has expired. Please log in again.'); return; }
  if (inactiveFor >= SESSION_INACTIVITY_MS) { forceLogout('You have been logged out due to 15 minutes of inactivity.'); return; }
  const timeToInactivity = SESSION_INACTIVITY_MS - inactiveFor;
  const timeToTotal      = SESSION_TOTAL_MS - totalElapsed;
  const timeToExpiry     = Math.min(timeToInactivity, timeToTotal);
  if (timeToExpiry <= SESSION_WARN_BEFORE && !sessionWarningShown) showSessionWarning(Math.floor(timeToExpiry / 1000));
}

function updateSessionTimerDisplay() {
  const textEl    = document.getElementById('session-timer-text');
  const displayEl = document.getElementById('session-timer-display');
  if (!textEl || !sessionStartTime) return;
  const inactiveLeft = Math.max(0, SESSION_INACTIVITY_MS - (Date.now() - lastActivityTime));
  const totalLeft    = Math.max(0, SESSION_TOTAL_MS - (Date.now() - sessionStartTime));
  const remaining    = Math.min(inactiveLeft, totalLeft);
  const mins = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  textEl.textContent = `${mins}:${secs}`;
  if (displayEl) {
    displayEl.classList.remove('warning', 'danger');
    if      (remaining < 60000)     displayEl.classList.add('danger');
    else if (remaining < 5 * 60000) displayEl.classList.add('warning');
  }
}

function showSessionWarning(secondsLeft) {
  sessionWarningShown = true;
  const overlay     = document.getElementById('session-warning-overlay');
  const countdownEl = document.getElementById('session-countdown');
  if (overlay) overlay.style.display = 'flex';
  let remaining = secondsLeft;
  if (countdownEl) countdownEl.textContent = remaining;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    remaining--;
    if (countdownEl) countdownEl.textContent = remaining;
    if (remaining <= 0) clearInterval(countdownInterval);
  }, 1000);
}

function extendSession() {
  const overlay = document.getElementById('session-warning-overlay');
  if (overlay) overlay.style.display = 'none';
  if (countdownInterval) clearInterval(countdownInterval);
  sessionWarningShown = false;
  lastActivityTime    = Date.now();
  toast.success('Session extended', 'Your session timer has been reset.');
}

function forceLogout(reason) {
  clearInterval(sessionCheckInterval);
  clearInterval(countdownInterval);
  const overlay = document.getElementById('session-warning-overlay');
  if (overlay) overlay.style.display = 'none';
  addLog('auth', `Auto logout: ${reason}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role });
  destroySession();
  sessionStorage.removeItem('glycr_admin_auth');
  sessionStorage.removeItem('glycr_admin_token');
  sessionStorage.removeItem('glycr_admin_user');
  authToken    = null;
  currentAdmin = { name: 'Admin', email: '', role: '' };
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('login-page').style.display  = 'flex';
  document.getElementById('login-password').value      = '';
  document.getElementById('login-error').style.display = 'none';
  customAlert(reason, 'Session Ended');
}

function destroySession() {
  clearInterval(sessionCheckInterval);
  clearInterval(countdownInterval);
  sessionStartTime    = null;
  lastActivityTime    = null;
  sessionWarningShown = false;
  ['mousemove','keydown','click','scroll','touchstart'].forEach(evt =>
    document.removeEventListener(evt, onUserActivity)
  );
}
