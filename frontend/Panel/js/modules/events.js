// ===============================================
// EVENTS MANAGEMENT
// ===============================================

function renderEvents() {
  const tb     = document.getElementById('events-table');
  const sorted = applySorting(getFilteredEvents(), 'events');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'events');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-regular fa-calendar-xmark" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No events found</td></tr>';
    renderPaginationBar('events-pagination', 'events', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(ev => {
    const org     = ev.organizerId;
    const orgName = org?.name || org?.email || 'Unknown';
    const orgEmail= org?.email || '—';
    const evTix   = tickets.filter(t => (t.eventId?.id || t.eventId?._id?.toString() || t.eventId) === ev.id);
    const revenue = evTix.reduce((s, t) => s + (t.price || 0), 0);
    const isLive  = ev.isPublished && !ev.isCancelled && new Date(ev.date) > new Date();
    const dateStr = new Date(ev.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    let badges = '';
    if (ev.flagged)        badges += `<span class="badge badge-flagged"><i class="fa-solid fa-flag"></i> Flagged</span>`;
    if (ev.isCancelled)    badges += `<span class="badge badge-cancelled"><i class="fa-solid fa-circle-xmark"></i> Cancelled</span>`;
    else if (isLive)       badges += `<span class="badge badge-live"><i class="fa-solid fa-circle-dot"></i> Live</span>`;
    else if (!ev.isPublished) badges += `<span class="badge badge-unpublished"><i class="fa-solid fa-eye-slash"></i> Unpublished</span>`;
    else                   badges += `<span class="badge badge-info"><i class="fa-solid fa-check"></i> Ended</span>`;
    const sel = selectedIds.events.has(ev.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${ev.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('events','${ev.id}',this)"></td>
        <td>
          <div class="event-table-name">${ev.title}</div>
          <div class="event-table-meta">
            <span><i class="fa-solid fa-ticket"></i> ${evTix.length} sold</span>
            <span><i class="fa-solid fa-coins"></i> ₵${revenue.toFixed(2)}</span>
          </div>
        </td>
        <td>
          <div class="event-table-organizer">${orgName}</div>
          <div class="event-table-organizer-sub"><i class="fa-regular fa-envelope"></i> ${orgEmail}</div>
        </td>
        <td>
          <div style="font-size:0.875rem;">${dateStr}</div>
          <div style="font-size:0.72rem;color:#94a3b8;">${new Date(ev.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
        </td>
        <td><div class="event-status-cell">${badges}</div></td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewEvent('${ev.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" style="background:#8b5cf6;" onclick="openEditEventModal('${ev.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-icon" style="background:${ev.flagged ? '#10b981' : '#f59e0b'};" onclick="flagEvent('${ev.id}')" title="${ev.flagged ? 'Unflag' : 'Flag'}"><i class="fa-solid ${ev.flagged ? 'fa-flag-checkered' : 'fa-flag'}"></i></button>
          <button class="btn-icon" style="background:#f59e0b;" onclick="togglePublish('${ev.id}')" title="${ev.isPublished ? 'Unpublish' : 'Publish'}"><i class="fa-solid ${ev.isPublished ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
          <button class="btn-icon" style="background:#ef4444;" onclick="deleteEvent('${ev.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('events-pagination', 'events', total, page, totalPages, pp);
}

function getFilteredEvents() {
  const search = (document.getElementById('event-search')?.value || '').toLowerCase();
  const filter = document.getElementById('event-filter')?.value || 'all';
  const dfrom  = document.getElementById('event-date-from')?.value;
  const dto    = document.getElementById('event-date-to')?.value;
  return events.filter(e => {
    const mSearch = e.title.toLowerCase().includes(search) || (e.venue||'').toLowerCase().includes(search);
    const mFilter = filter === 'all'
      || (filter === 'live'        && e.isPublished && !e.isCancelled && new Date(e.date) > new Date())
      || (filter === 'cancelled'   && e.isCancelled)
      || (filter === 'flagged'     && e.flagged)
      || (filter === 'unpublished' && !e.isPublished && !e.isCancelled);
    return mSearch && mFilter && applyDateRangeFilter(e.date, dfrom, dto);
  });
}

function openEditEventModal(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  document.getElementById('edit-event-id').value          = ev.id;
  document.getElementById('edit-event-title').value       = ev.title       || '';
  document.getElementById('edit-event-description').value = ev.description || '';
  document.getElementById('edit-event-date').value        = ev.date ? ev.date.slice(0, 16) : '';
  document.getElementById('edit-event-venue').value       = ev.venue       || '';
  document.getElementById('edit-event-location').value    = ev.location    || '';
  document.getElementById('edit-event-category').value    = ev.category    || '';
  document.getElementById('edit-event-error').style.display = 'none';
  openModal('edit-event-modal');
}

async function saveEditEvent() {
  const eventId     = document.getElementById('edit-event-id').value;
  const title       = document.getElementById('edit-event-title').value.trim();
  const description = document.getElementById('edit-event-description').value.trim();
  const date        = document.getElementById('edit-event-date').value;
  const venue       = document.getElementById('edit-event-venue').value.trim();
  const location    = document.getElementById('edit-event-location').value.trim();
  const category    = document.getElementById('edit-event-category').value.trim();
  const errEl       = document.getElementById('edit-event-error');
  if (!title || !date || !venue) {
    errEl.style.display = 'block';
    errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>Title, date and venue are required.';
    return;
  }
  const payload = { title, description, date, venue, location, category };
  try { await apiRequest(`/admin/events/${eventId}`, { method: 'PUT', body: JSON.stringify(payload) }); }
  catch { const ev = events.find(e => e.id === eventId); if (ev) Object.assign(ev, payload); }
  await addLog('event', 'Event details edited', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId, title });
  closeModal('edit-event-modal');
  renderEvents();
  toast.success('Event updated', 'Changes have been saved.');
}

async function flagEvent(eventId) {
  try { await apiRequest(`/admin/events/${eventId}/flag`, { method: 'PATCH' }); }
  catch { const ev = events.find(e => e.id === eventId); if (ev) ev.flagged = !ev.flagged; }
  await addLog('warning', 'Event flagged/unflagged', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  renderEvents();
  toast.warning('Flag updated', 'Event flag status changed.');
}

async function togglePublish(eventId) {
  try { await apiRequest(`/admin/events/${eventId}/publish`, { method: 'PATCH' }); }
  catch { const ev = events.find(e => e.id === eventId); if (ev) ev.isPublished = !ev.isPublished; }
  await addLog('system', 'Event publish toggled', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  renderEvents();
  toast.info('Visibility updated', 'Event publish status changed.');
}

async function deleteEvent(eventId) {
  const ev = events.find(e => e.id === eventId);
  const ok = await customConfirm(`Delete "${ev?.title || 'this event'}"? All associated tickets will also be removed.`, 'Delete Event', 'Delete', '#ef4444');
  if (!ok) return;
  try { await apiRequest(`/admin/events/${eventId}`, { method: 'DELETE' }); }
  catch { events.splice(events.findIndex(e => e.id === eventId), 1); }
  await addLog('danger', 'Event deleted', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  await loadData();
  toast.success('Event deleted', 'The event has been removed.');
}

async function bulkFlagEvents() {
  const ids = [...selectedIds.events];
  if (!ids.length) return;
  showBulkConfirm('Flag Events', `Flag ${ids.length} event(s)?`, async () => {
    let ok = 0;
    for (const id of ids) { try { await apiRequest(`/admin/events/${id}/flag`, { method: 'PATCH' }); ok++; } catch { ok++; } }
    await addLog('warning', `Bulk flagged ${ok} event(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.events.clear();
    await loadData();
    toast.warning('Done', `${ok} event(s) flagged.`);
  });
}

async function bulkDeleteEvents() {
  const ids = [...selectedIds.events];
  if (!ids.length) return;
  showBulkConfirm('Delete Events', `Permanently delete ${ids.length} event(s) and all their tickets?`, async () => {
    let ok = 0;
    for (const id of ids) { try { await apiRequest(`/admin/events/${id}`, { method: 'DELETE' }); ok++; } catch { ok++; } }
    await addLog('danger', `Bulk deleted ${ok} event(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.events.clear();
    await loadData();
    toast.success('Done', `${ok} event(s) deleted.`);
  });
}

function viewEvent(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const evTix   = tickets.filter(t => (t.eventId?.id || t.eventId?._id?.toString()) === ev.id);
  const revenue = evTix.reduce((s, t) => s + (t.price || 0), 0);
  const feeAmt  = revenue * (platformFeePercent / 100);
  const ttypes  = ev.ticketTypes || {};
  document.getElementById('event-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-solid fa-heading"></i> Title</div><div class="detail-value" style="font-size:1.25rem;">${ev.title}</div></div>
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-regular fa-file-lines"></i> Description</div><div class="detail-value">${ev.description || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Date &amp; Time</div><div class="detail-value">${new Date(ev.date).toLocaleString()}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-building"></i> Venue</div><div class="detail-value">${ev.venue}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-location-dot"></i> Location</div><div class="detail-value">${ev.location || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-tag"></i> Category</div><div class="detail-value" style="text-transform:capitalize;">${ev.category || '—'}</div></div>
    </div>
    ${Object.keys(ttypes).length ? `
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-ticket" style="margin-right:0.4rem;"></i>Ticket Types</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
        ${Object.entries(ttypes).map(([type, data]) => `
          <div style="background:#334155;padding:1rem;border-radius:0.5rem;">
            <div style="font-weight:700;margin-bottom:0.5rem;">${type.toUpperCase()}</div>
            <div style="font-size:0.875rem;color:#94a3b8;line-height:1.6;">
              <div>Price: ₵${data.price}</div><div>Capacity: ${data.capacity}</div>
              <div>Sold: ${data.sold||0}</div><div>Available: ${data.capacity-(data.sold||0)}</div>
            </div>
            <div style="margin-top:0.5rem;background:#475569;border-radius:9999px;height:0.5rem;overflow:hidden;">
              <div style="background:#6366f1;height:100%;width:${Math.min(100,((data.sold||0)/data.capacity)*100)}%;"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-chart-pie" style="margin-right:0.4rem;"></i>Revenue</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;">
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Total Revenue</div><div style="font-size:1.5rem;font-weight:700;color:#10b981;">₵${revenue.toFixed(2)}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Tickets Sold</div><div style="font-size:1.5rem;font-weight:700;color:#6366f1;">${evTix.length}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Platform Fee (${platformFeePercent}%)</div><div style="font-size:1.5rem;font-weight:700;color:#8b5cf6;">₵${feeAmt.toFixed(2)}</div></div>
      </div>
    </div>
    <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
      <button class="btn btn-primary" onclick="openEditEventModal('${ev.id}');closeModal('event-modal');"><i class="fa-solid fa-pen-to-square"></i> Edit Event</button>
    </div>`;
  addLog('event', `Viewed event: ${ev.title}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  openModal('event-modal');
}