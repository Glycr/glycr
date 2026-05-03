// ===============================================
// API HELPER
// ===============================================

async function apiRequest(endpoint, options = {}) {
  let token = authToken || sessionStorage.getItem('glycr_admin_token');
  if (token && !authToken) authToken = token;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { const e = await response.json(); msg = e.error || msg; } catch {}
    throw new Error(msg);
  }
  return response.json();
}
