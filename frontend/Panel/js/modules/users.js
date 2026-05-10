// ===============================================
// USERS MANAGEMENT
// ===============================================

function renderUsers() {
  const tb      = document.getElementById('users-table');
  const sorted  = applySorting(getFilteredUsers(), 'users');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'users');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-users-slash" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No users found</td></tr>';
    renderPaginationBar('users-pagination', 'users', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(user => {
    const roleMap = { organizer:['badge-organizer','fa-user-tie','Organizer'], moderator:['badge-moderator','fa-user-cog','Moderator'], admin:['badge-admin','fa-user-shield','Admin'] };
    const [bClass, icon, label] = roleMap[user.role] || ['badge-customer','fa-user','Customer'];
    const sel = selectedIds.users.has(user.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${user.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('users','${user.id}',this)"></td>
        <td>
          <div style="font-weight:600;">${user.name || 'User'}</div>
          <div style="font-size:0.75rem;color:#94a3b8;"><i class="fa-solid fa-fingerprint"></i> ${user.id}</div>
        </td>
        <td>
          <div style="font-size:0.875rem;"><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${user.email}</div>
          <div style="color:#94a3b8;font-size:0.82rem;"><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.3rem;"></i>${user.phone || '—'}</div>
        </td>
        <td><span class="badge ${bClass}"><i class="fa-solid ${icon}"></i> ${label}</span></td>
        <td><span class="badge ${user.suspended ? 'badge-suspended' : 'badge-active'}">
          <i class="fa-solid ${user.suspended ? 'fa-ban' : 'fa-circle-check'}"></i>
          ${user.suspended ? 'Suspended' : 'Active'}
        </span></td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewUser('${user.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          ${canEditUser(user)      ? `<button class="btn-icon" style="background:#8b5cf6;" onclick="openEditUserModal('${user.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
          ${canResetPassword(user) ? `<button class="btn-icon" style="background:#f59e0b;" onclick="openResetPasswordModal('${user.id}')" title="Reset Password"><i class="fa-solid fa-key"></i></button>` : ''}
          ${canSuspendUser(user)   ? `<button class="btn-icon" style="background:${user.suspended ? '#10b981' : '#f59e0b'};" onclick="suspendUser('${user.id}')" title="${user.suspended ? 'Unsuspend' : 'Suspend'}"><i class="fa-solid ${user.suspended ? 'fa-user-check' : 'fa-user-slash'}"></i></button>` : ''}
          ${canDeleteUser(user)    ? `<button class="btn-icon" style="background:#ef4444;" onclick="deleteUser('${user.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('users-pagination', 'users', total, page, totalPages, pp);
}

function getFilteredUsers() {
  const search = (document.getElementById('user-search')?.value || '').toLowerCase();
  const role   = document.getElementById('user-role-filter')?.value   || 'all';
  const status = document.getElementById('user-status-filter')?.value || 'all';
  const dfrom  = document.getElementById('user-date-from')?.value;
  const dto    = document.getElementById('user-date-to')?.value;
  return users.filter(u => {
    const mSearch = !search || (u.name||'').toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
    const mRole   = role   === 'all' || u.role === role;
    const mStatus = status === 'all' || (status === 'active' && !u.suspended) || (status === 'suspended' && u.suspended);
    return mSearch && mRole && mStatus && applyDateRangeFilter(u.createdAt, dfrom, dto);
  });
}

async function suspendUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!canSuspendUser(user)) { toast.error('Permission denied', 'You cannot suspend this user.'); return; }
  try { await apiRequest(`/admin/users/${userId}/suspend`, { method: 'PATCH' }); }
  catch { if (user) user.suspended = !user.suspended; }
  await addLog('user', `User ${user?.suspended ? 'suspended' : 'unsuspended'}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: user?.email, targetRole: user?.role });
  await loadData();
  toast.success('User updated', `Account has been ${user?.suspended ? 'suspended' : 'unsuspended'}.`);
}

async function deleteUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!canDeleteUser(user)) { toast.error('Permission denied', 'You cannot delete this user.'); return; }
  const ok = await customConfirm(`Delete "${user?.name || user?.email}"? This will permanently remove their account and all associated data.`, 'Delete User', 'Delete', '#ef4444');
  if (!ok) return;
  try { await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' }); } catch {}
  await addLog('danger', 'User deleted', { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: user?.email, targetRole: user?.role });
  await loadData();
  toast.success('User deleted', 'The account has been permanently removed.');
}

function openEditUserModal(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('edit-user-id').value     = user.id;
  document.getElementById('edit-user-name').value   = user.name  || '';
  document.getElementById('edit-user-email').value  = user.email || '';
  document.getElementById('edit-user-phone').value  = user.phone || '';
  document.getElementById('edit-user-role').value   = user.role  || 'customer';
  document.getElementById('edit-user-status').value = user.suspended ? 'true' : 'false';
  openModal('edit-user-modal');
}

async function saveEditUser() {
  const userId    = document.getElementById('edit-user-id').value;
  const name      = document.getElementById('edit-user-name').value.trim();
  const email     = document.getElementById('edit-user-email').value.trim();
  const phone     = document.getElementById('edit-user-phone').value.trim();
  const role      = document.getElementById('edit-user-role').value;
  const suspended = document.getElementById('edit-user-status').value === 'true';
  if (!name || !email) { toast.warning('Missing fields', 'Name and email are required.'); return; }
  try { await apiRequest(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ name, email, phone, role, suspended }) }); }
  catch { const u = users.find(u => u.id === userId); if (u) Object.assign(u, { name, email, phone, role, suspended }); }
  await addLog('user', 'User details updated', { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: email, targetRole: role });
  closeModal('edit-user-modal');
  await loadData();
  toast.success('User updated', 'Changes saved successfully.');
}

function openAddUserModal() {
  ['add-user-name','add-user-email','add-user-phone','add-user-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('add-user-role').value = 'customer';
  document.getElementById('add-user-error').style.display = 'none';
  openModal('add-user-modal');
}

async function submitAddUser() {
  const name     = document.getElementById('add-user-name').value.trim();
  const email    = document.getElementById('add-user-email').value.trim();
  const phone    = document.getElementById('add-user-phone').value.trim();
  const password = document.getElementById('add-user-password').value;
  const role     = document.getElementById('add-user-role').value;
  const errEl    = document.getElementById('add-user-error');
  const errMsg   = document.getElementById('add-user-error-msg');
  if (!name || !email || !password) { errEl.style.display = 'block'; errMsg.textContent = 'Name, email and password are required.'; return; }
  try {
    await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify({ name, email, phone, password, role }) });
    await addLog('user', 'New user created by admin', { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: email, targetRole: role });
    closeModal('add-user-modal');
    await loadData();
    toast.success('User created', `${name} has been added to the platform.`);
  } catch (err) { errEl.style.display = 'block'; errMsg.textContent = err.message; }
}

async function bulkSuspendUsers() {
  const ids = [...selectedIds.users];
  if (!ids.length) return;
  showBulkConfirm('Suspend Users', `Suspend ${ids.length} selected user(s)?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/users/${id}/suspend`, { method: 'PATCH' }); ok++; }
      catch { const u = users.find(u => u.id === id); if (u) { u.suspended = true; ok++; } }
    }
    await addLog('user', `Bulk suspended ${ok} user(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.users.clear();
    await loadData();
    toast.success('Done', `${ok} user(s) suspended.`);
  });
}

async function bulkDeleteUsers() {
  const ids = [...selectedIds.users];
  if (!ids.length) return;
  showBulkConfirm('Delete Users', `Permanently delete ${ids.length} user(s)? This cannot be undone.`, async () => {
    let ok = 0;
    for (const id of ids) {
      const user = users.find(u => u.id === id);
      if (!canDeleteUser(user)) continue;
      try { await apiRequest(`/admin/users/${id}`, { method: 'DELETE' }); ok++; } catch { ok++; }
    }
    await addLog('danger', `Bulk deleted ${ok} user(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.users.clear();
    await loadData();
    toast.success('Done', `${ok} user(s) deleted.`);
  });
}

function viewUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  const userEvents  = events.filter(e => (e.organizerId?.id || e.organizerId?._id?.toString()) === userId);
  const userTickets = tickets.filter(t => (t.userId?.id || t.userId?._id?.toString()) === userId);
  const orgRevenue  = tickets.filter(t => userEvents.some(e => e.id === (t.eventId?.id || t.eventId?._id?.toString()))).reduce((s, t) => s + (t.price || 0), 0);
  const orgTickets  = tickets.filter(t => userEvents.some(e => e.id === (t.eventId?.id || t.eventId?._id?.toString()))).length;
  document.getElementById('user-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-user"></i> Name</div><div class="detail-value">${user.name || 'N/A'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> User ID</div><div class="detail-value" style="font-size:0.82rem;font-family:monospace;">${user.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-envelope"></i> Email</div><div class="detail-value">${user.email}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-mobile-screen-button"></i> Phone</div><div class="detail-value">${user.phone || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-id-badge"></i> Role</div><div class="detail-value" style="text-transform:capitalize;">${user.role || 'customer'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value">${user.suspended ? 'Suspended' : 'Active'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Joined</div><div class="detail-value">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Currency</div><div class="detail-value">${user.currency || 'GHC'}</div></div>
    </div>
    ${user.role === 'organizer' ? `
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-chart-bar" style="margin-right:0.4rem;"></i>Organizer Stats</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;">
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Events</div><div style="font-size:1.5rem;font-weight:700;color:#6366f1;">${userEvents.length}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Revenue</div><div style="font-size:1.5rem;font-weight:700;color:#10b981;">₵${orgRevenue.toFixed(2)}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Tickets Sold</div><div style="font-size:1.5rem;font-weight:700;color:#8b5cf6;">${orgTickets}</div></div>
      </div>
    </div>` : ''}
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:0.4rem;"></i>Recent Tickets</h4>
      <div style="max-height:200px;overflow-y:auto;">
        ${userTickets.slice(0,5).map(t => {
    const ev = events.find(e => e.id === (t.eventId?.id || t.eventId?._id?.toString()));
    return `<div style="background:#334155;padding:0.75rem;border-radius:0.5rem;margin-bottom:0.5rem;font-size:0.875rem;">
            <div style="font-weight:600;">${ev?.title || 'Unknown Event'}</div>
            <div style="color:#94a3b8;">${(t.ticketType||'').toUpperCase()} — ₵${t.price||0} — ${t.purchasedAt ? new Date(t.purchasedAt).toLocaleDateString() : '—'}</div>
          </div>`;
  }).join('') || '<div class="empty-state">No ticket activity yet</div>'}
      </div>
    </div>`;
  addLog('user', `Viewed user profile: ${user.email}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, userId });
  openModal('user-modal');
}
