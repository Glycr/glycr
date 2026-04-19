// Glycr Modern App – Full Integrated Version
class GlycrApp {
  constructor() {
    this.apiBase = 'http://localhost:5001/api';
    this.currentUser = null;
    this.events = [];
    this.tickets = [];
    this.waitlists = [];
    this.favorites = this.loadFromStorage('glycr_favorites') || {};
    this.shares = this.loadFromStorage('glycr_shares') || {};
    this.payouts = [];
    this.currentEventId = null;
    this.selectedTicket = null;
    this.selectedTicketType = null;
    this.editingEvent = null;
    this.salesChart = null;
    this.selectedPaymentMethod = 'mtn-momo';
    this.currentDate = new Date();
    this.init();
  }

  // ---- Helper functions ----
  sendSMS(phone, message) { console.log(`📱 SMS to ${phone}: ${message}`); }
  sendEmail(email, subject, body) { console.log(`📧 Email to ${email}: ${subject} - ${body}`); }
  getCategoryIcon(slug) {
    const icons = { music:'fa-music', food:'fa-utensils', arts:'fa-palette', sports:'fa-futbol', business:'fa-briefcase', nightlife:'fa-moon', family:'fa-child', workshops:'fa-chalkboard-user', community:'fa-users', free:'fa-ticket-alt' };
    return icons[slug] || 'fa-calendar';
  }
  getFullImageUrl(imagePath) {
    if (!imagePath) return 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600';
    if (imagePath.startsWith('/uploads/')) {
      const backendBase = this.apiBase.replace('/api', '');
      return `${backendBase}${imagePath}`;
    }
    return imagePath;
  }
  getCategoryName(slug) {
    const names = { music:'Music', food:'Food & Drink', arts:'Arts & Theater', sports:'Sports & Fitness', business:'Business & Networking', nightlife:'Nightlife & Parties', family:'Family & Kids', workshops:'Workshops & Classes', community:'Community & Festivals', free:'Free Events' };
    return names[slug] || slug;
  }
  getCurrencySymbol(currency) {
    const symbols = { 'USD':'$', 'EUR':'€', 'GBP':'£', 'CAD':'CA$', 'GHC':'₵' };
    return symbols[currency] || '$';
  }
  getDisplayPrice(price, symbol, isEarlyBird = false) {
    const prefix = isEarlyBird ? 'EARLY BIRD ' : '';
    return price === 0 ? 'FREE' : `${prefix}${symbol}${price}`;
  }
  validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  validatePhone(phone) { return /^\+233\d{9}$/.test(phone); }
  parseTicketTypes(ticketTypes) {
    if (typeof ticketTypes === 'string') {
      try { return JSON.parse(ticketTypes); } catch { return {}; }
    }
    return ticketTypes || {};
  }
  isEarlyBird(event, ticketType) {
    const ticketTypes = this.parseTicketTypes(event.ticketTypes);
    const earlyBirdEnd = ticketTypes[ticketType]?.earlyBirdEnd;
    if (!earlyBirdEnd) return false;
    return this.currentDate < new Date(earlyBirdEnd);
  }
  getTicketPrice(event, ticketType) {
    const ticketTypes = this.parseTicketTypes(event.ticketTypes);
    const basePrice = ticketTypes[ticketType]?.price || 0;
    if (this.isEarlyBird(event, ticketType)) {
      return ticketTypes[ticketType]?.earlyBirdPrice || basePrice;
    }
    return basePrice;
  }
  getGroupDiscount(quantity, ticketType) {
    const event = this.events.find(e => e._id === this.currentEventId);
    if (!event) return 0;
    const ticketTypes = this.parseTicketTypes(event.ticketTypes);
    const discount = ticketTypes[ticketType]?.groupDiscount || 0;
    if (quantity >= 10) return discount * 2;
    if (quantity >= 5) return discount;
    return 0;
  }
  getTicketBenefits(type) {
    const benefits = { free:['Free entry','General admission','Event access','Digital ticket'], regular:['General admission','Event access','Digital ticket'], vip:['Early entry','Premium seating','VIP lounge access','Meet & greet'], vvip:['All VIP benefits','Backstage access','Photo opportunities','Exclusive merchandise'] };
    return benefits[type.toLowerCase()] || ['Event access'];
  }
  loadFromStorage(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  saveToStorage(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    const strengthMap = { 0:{ width:'0%', text:'Very Weak', color:'#ef4444' }, 1:{ width:'20%', text:'Weak', color:'#f59e0b' }, 2:{ width:'40%', text:'Fair', color:'#f59e0b' }, 3:{ width:'60%', text:'Good', color:'#10b981' }, 4:{ width:'80%', text:'Strong', color:'#10b981' }, 5:{ width:'100%', text:'Very Strong', color:'#10b981' } };
    return strengthMap[Math.min(strength, 5)];
  }
  clearPasswordStrength() {
    const bar = document.getElementById('strength-bar');
    const text = document.getElementById('strength-text');
    if (bar) bar.style.width = '0%';
    if (text) text.textContent = '';
  }
  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async fetchApi(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    let url = `${this.apiBase}${endpoint}`;
    if (options.cacheBust) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}_t=${Date.now()}`;
    }
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async init() {
    await this.checkAuth();
    this.bindEvents();
    await this.renderEvents();
    this.setupMobileMenu();
    this.checkResetToken();
    document.addEventListener('keydown', this.handleEscKey.bind(this));
  }
  handleEscKey(e) { if (e.key === 'Escape') this.closeAllModals(); }

  async checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const user = await this.fetchApi('/auth/profile');
      this.currentUser = user;
      localStorage.setItem('user', JSON.stringify(user));
      this.updateNav();
      if (this.currentUser.isOrganizer) this.showSection('dashboard');
      else this.showSection('profile');
    } catch (err) { this.logout(); }
  }

  async handleAuth() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const isLogin = document.getElementById('auth-title').textContent === 'Sign In';
    if (!email || !password) return this.showError('Please fill in all fields');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    try {
      let result;
      if (isLogin) {
        result = await this.fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      } else {
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const username = document.getElementById('username').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const confirmPassword = document.getElementById('confirm-password').value;
        const isOrganizer = document.getElementById('is-organizer').checked;
        if (!firstName || !lastName || !username || !phone) return this.showError('Please fill in all fields');
        if (!this.validatePhone(phone)) return this.showError('Invalid phone number format (use +233xxxxxxxxx)');
        if (password !== confirmPassword) return this.showError('Passwords do not match');
        const strength = this.checkPasswordStrength(password);
        if (strength.width === '0%') return this.showError('Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.');
        const name = `${firstName} ${lastName}`;
        result = await this.fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, phone, isOrganizer, username }) });
      }
      localStorage.setItem('token', result.token);
      this.currentUser = result.user;
      localStorage.setItem('user', JSON.stringify(result.user));
      this.updateNav();
      this.closeAllModals();
      if (this.currentUser.isOrganizer) { await this.loadDashboard(); this.showSection('dashboard'); }
      else { await this.loadProfile(); this.showSection('profile'); }
    } catch (err) { this.showError(err.message); }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.updateNav();
    this.showSection('home');
    this.renderEvents();
  }

  updateNav() {
    const isLoggedIn = !!this.currentUser;
    const isOrganizer = this.currentUser?.isOrganizer;
    document.getElementById('login-link').style.display = isLoggedIn ? 'none' : 'inline-flex';
    document.getElementById('profile-dropdown').style.display = isLoggedIn ? 'inline-block' : 'none';
    document.getElementById('dashboard-link').style.display = isOrganizer ? 'block' : 'none';
    document.getElementById('payout-link').style.display = isOrganizer ? 'block' : 'none';
    document.getElementById('myevents-link').style.display = isOrganizer ? 'block' : 'none';
    document.getElementById('report-link').style.display = isOrganizer ? 'block' : 'none';
    document.getElementById('create-event-btn-hero').style.display = isOrganizer ? 'inline-flex' : 'none';
    if (isLoggedIn) {
      const name = this.currentUser.name || 'User';
      document.getElementById('profile-name-small').textContent = name;
      document.getElementById('profile-avatar-small').textContent = name.charAt(0).toUpperCase();
    }
  }

  toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const isLogin = title.textContent === 'Sign In';
    const authBtn = document.getElementById('auth-btn');
    const registerFields = document.getElementById('register-fields');
    const toggleText = document.getElementById('toggle-auth');
    const phoneInput = document.getElementById('phone');
    const confirmInput = document.getElementById('confirm-password');
    if (isLogin) {
      title.textContent = 'Create Account';
      authBtn.textContent = 'Create Account';
      registerFields.style.display = 'block';
      phoneInput.required = true;
      confirmInput.required = true;
      toggleText.innerHTML = 'Already have an account? <a href="#">Sign in</a>';
      this.clearPasswordStrength();
    } else {
      title.textContent = 'Sign In';
      authBtn.textContent = 'Sign In';
      registerFields.style.display = 'none';
      phoneInput.required = false;
      confirmInput.required = false;
      toggleText.innerHTML = 'Don\'t have an account? <a href="#">Create one</a>';
      document.getElementById('first-name').value = '';
      document.getElementById('last-name').value = '';
      document.getElementById('username').value = '';
      document.getElementById('confirm-password').value = '';
      document.getElementById('phone').value = '';
      document.getElementById('is-organizer').checked = false;
      this.clearPasswordStrength();
    }
  }

  async loadProfile() {
    if (!this.currentUser) return;
    const name = this.currentUser.name || 'User';
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-email').textContent = this.currentUser.email;
    document.getElementById('profile-phone').textContent = this.currentUser.phone || '—';
    document.getElementById('profile-avatar').textContent = name.charAt(0).toUpperCase();
    try {
      const userTickets = await this.fetchApi('/tickets/my');
      document.getElementById('purchase-history-list').innerHTML = userTickets.length ? userTickets.map(t => { const ev = this.events.find(e => e._id === t.eventId); const sym = this.getCurrencySymbol(ev?.currency || 'GHC'); return `<div class="purchase-item"><div class="purchase-item-title">${ev ? ev.title : 'Event'}</div><div class="purchase-item-meta">${t.ticketType.toUpperCase()} · ${t.price === 0 ? 'Free' : sym + t.price} · ${new Date(t.purchasedAt).toLocaleDateString()}</div></div>`; }).join('') : '<p style="color:var(--muted); font-size:0.82rem;">No purchases yet</p>';
    } catch {}
    const userFavorites = this.favorites[this.currentUser.id] || [];
    const favoriteEvents = this.events.filter(e => userFavorites.includes(e._id) && !e.isCancelled);
    const grid = document.getElementById('favorite-events-list');
    grid.innerHTML = favoriteEvents.length ? favoriteEvents.map(event => this.renderEventCard(event)).join('') : '<p style="color:var(--muted); font-size:0.82rem; grid-column:1/-1;">No favourites yet</p>';
  }

  async saveProfile() {
    const name = document.getElementById('profile-name-input').value.trim();
    const email = document.getElementById('profile-email-input').value.trim();
    const phone = document.getElementById('profile-phone-input').value.trim();
    if (!name || !email || !phone) return this.showError('Please fill in all fields');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    if (!this.validatePhone(phone)) return this.showError('Invalid phone number format');
    try {
      const updatedUser = await this.fetchApi('/auth/profile', { method: 'PUT', body: JSON.stringify({ name, email, phone }) });
      this.currentUser = updatedUser;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.updateNav();
      this.closeAllModals();
      this.loadProfile();
    } catch (err) { this.showError(err.message); }
  }

  async renderEvents() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const location = document.getElementById('location-filter').value;
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    if (category) query.append('category', category);
    if (location) query.append('location', location);
    query.append('upcoming', 'true');
    try {
      this.events = await this.fetchApi(`/events?${query.toString()}`, { cacheBust: true });
      const grid = document.getElementById('events-grid');
      if (this.events.length === 0) { grid.innerHTML = `<div class="empty-state"><h3>No events found</h3><p>Try adjusting your filters</p></div>`; return; }
      grid.innerHTML = this.events.map(event => this.renderEventCard(event)).join('');
      document.querySelectorAll('.event-card:not(.cancelled)').forEach(card => { card.onclick = (e) => { if (!e.target.closest('.fav-btn')) this.showEventDetail(card.dataset.eventId); }; });
    } catch (err) { document.getElementById('events-grid').innerHTML = '<div class="empty-state">Failed to load events</div>'; }
  }

  isEventSoldOut(event) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    for (let type in tt) { if (tt[type].capacity - (tt[type].sold || 0) > 0) return false; }
    return true;
  }

  renderEventCard(event) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    let minPrice = Infinity, minType = null;
    Object.entries(tt).forEach(([type, data]) => { const p = this.getTicketPrice(event, type); if (p < minPrice) { minPrice = p; minType = type; } });
    const sym = this.getCurrencySymbol(event.currency);
    const isFree = minPrice === 0;
    const isEB = this.isEarlyBird(event, minType);
    const date = new Date(event.date);
    const isFav = this.isFavorited(event);
    const cancelledClass = event.isCancelled ? 'cancelled' : '';
    const iconClass = this.getCategoryIcon(event.category);
    const categoryName = this.getCategoryName(event.category);
    const soldOut = this.isEventSoldOut(event);
    let priceHtml;
    if (soldOut) priceHtml = `<span class="card-price sold-out">Sold Out</span>`;
    else if (isFree) priceHtml = `<span class="card-price free">Free</span>`;
    else priceHtml = `<span class="card-price${isEB ? ' early-bird' : ''}">${sym}${minPrice}</span>`;
    return `<div class="event-card ${cancelledClass}" data-event-id="${event._id}"><div class="card-img"><img src="${this.getFullImageUrl(event.image)}" alt="${event.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600'"><div class="card-img-overlay"></div><span class="card-cat-badge"><i class="fas ${iconClass}"></i> ${categoryName}</span>${event.isCancelled ? '<span class="card-cancelled-badge">Cancelled</span>' : ''}</div><div class="card-body"><div class="card-title">${event.title}</div><div class="card-meta"><div class="card-meta-row"><i class="fas fa-calendar-alt"></i> ${date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}</div><div class="card-meta-row"><i class="fas fa-map-marker-alt"></i> ${event.venue}, ${event.location || 'Ghana'}</div></div><div class="card-footer">${priceHtml}${isEB && !isFree && !soldOut ? '<span class="early-tag">Early Bird</span>' : ''}${!event.isCancelled ? `<button class="fav-btn${isFav ? ' active' : ''}" data-event-id="${event._id}" aria-label="Favourite"><i class="fas fa-heart"></i></button>` : ''}</div></div></div>`;
  }

  async showEventDetail(id) {
    try {
      const event = await this.fetchApi(`/events/${id}`);
      if (event.isCancelled) return this.showError('This event has been cancelled.');
      this.currentEventId = id;
      const tt = this.parseTicketTypes(event.ticketTypes);
      const date = new Date(event.date);
      const sym = this.getCurrencySymbol(event.currency);
      const iconClass = this.getCategoryIcon(event.category);
      const categoryName = this.getCategoryName(event.category);
      document.getElementById('event-detail').innerHTML = `<div class="detail-hero"><img src="${this.getFullImageUrl(event.image)}" alt="${event.title}" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900'"><div class="detail-hero-overlay"></div><span class="detail-cat-badge"><i class="fas ${iconClass}"></i> ${categoryName}</span></div><h2 class="detail-title">${event.title}</h2><div class="detail-meta"><span class="detail-meta-item"><i class="fas fa-calendar-alt"></i> ${date.toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span class="detail-meta-item"><i class="fas fa-map-marker-alt"></i> ${event.venue}, ${event.location}</span><span class="detail-meta-item"><i class="fas fa-envelope"></i> <a href="mailto:${event.organizerEmail}" style="color:var(--teal);">${event.organizerEmail}</a></span><span class="detail-meta-item"><i class="fas fa-phone-alt"></i> ${event.organizerPhone}</span></div><p class="detail-desc">${event.description}</p><p class="tickets-label">Available Tickets</p>`;
      const ticketOptionsHtml = Object.entries(tt).map(([type, data]) => { const avail = data.capacity - (data.sold || 0); const soldOut = avail <= 0; const price = this.getTicketPrice(event, type); const isEB = this.isEarlyBird(event, type); const bens = this.getTicketBenefits(type); const priceStr = price === 0 ? 'Free' : `${sym}${price}${isEB ? ' (Early Bird)' : ''}`; if (soldOut) { return `<div class="ticket-tier sold-out"><div><div class="ticket-tier-name">${type.toUpperCase()}</div><div class="ticket-tier-avail" style="color:var(--coral);">Sold Out</div><div class="ticket-tier-benefits">${bens.join(' · ')}</div><button class="btn btn-ghost" style="margin-top:0.5rem; font-size:0.75rem;" onclick="event.stopPropagation(); app.showWaitlistModal('${event._id}','${type}')">Join Waitlist</button></div><div class="tier-price sold-out-lbl">Sold Out</div></div>`; } return `<div class="ticket-tier" data-type="${type}" data-price="${price}"><div><div class="ticket-tier-name">${type.toUpperCase()}</div><div class="ticket-tier-avail">${avail} remaining</div><div class="ticket-tier-benefits">${bens.join(' · ')}</div></div><div class="tier-price${price === 0 ? ' free' : ''}">${priceStr}</div></div>`; }).join('');
      document.getElementById('ticket-benefits').innerHTML = ticketOptionsHtml;
      document.querySelectorAll('.ticket-tier[data-type]').forEach(tier => { tier.addEventListener('click', () => { this.selectTicket(tier.dataset.type, parseFloat(tier.dataset.price), event._id); }); });
      this.openModal('event-modal');
    } catch (err) { this.showError(err.message); }
  }

  showWaitlistModal(eventId, ticketType) {
    this.currentEventId = eventId;
    this.selectedTicket = { type: ticketType, eventId };
    document.getElementById('waitlist-title').textContent = `Join Waitlist for ${ticketType.toUpperCase()} Tickets`;
    document.getElementById('waitlist-form').reset();
    this.openModal('waitlist-modal');
  }

  async joinWaitlist() {
    const name = document.getElementById('waitlist-name').value.trim();
    const email = document.getElementById('waitlist-email').value.trim();
    const phone = document.getElementById('waitlist-phone').value.trim();
    if (!name || !email || !phone) return this.showError('Please fill in all fields');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    if (!this.validatePhone(phone)) return this.showError('Invalid phone number format');
    try {
      await this.fetchApi('/waitlists', { method: 'POST', body: JSON.stringify({ eventId: this.selectedTicket.eventId, ticketType: this.selectedTicket.type, name, email, phone }) });
      const event = await this.fetchApi(`/events/${this.selectedTicket.eventId}`);
      this.sendSMS(phone, `Hi ${name}, you've joined the waitlist for ${this.selectedTicket.type.toUpperCase()} tickets for ${event.title}!`);
      const statusEl = document.getElementById('waitlist-status');
      statusEl.style.display = 'block'; statusEl.className = 'status-msg success'; statusEl.innerHTML = '<strong>✓ Joined waitlist!</strong><br>SMS confirmation sent.';
      setTimeout(() => { this.closeAllModals(); this.showEventDetail(this.currentEventId); }, 2000);
    } catch (err) { this.showError(err.message); }
  }

  selectTicket(type, price, eventId) { this.selectedTicket = { type, price, eventId }; this.showPurchaseFlow(); }

  async showPurchaseFlow() {
    if (!this.selectedTicket) return;
    const event = await this.fetchApi(`/events/${this.selectedTicket.eventId}`);
    const benefits = this.getTicketBenefits(this.selectedTicket.type);
    const sym = this.getCurrencySymbol(event.currency);
    const isEB = this.isEarlyBird(event, this.selectedTicket.type);
    const dispPrice = this.selectedTicket.price === 0 ? 'Free' : `${sym}${this.selectedTicket.price}${isEB ? ' (Early Bird)' : ''}`;
    document.getElementById('purchase-title').textContent = `${this.selectedTicket.type.toUpperCase()} — ${dispPrice}`;
    document.getElementById('ticket-types').innerHTML = `<div class="ticket-tier" style="cursor:default; border-color:var(--teal); background:var(--teal-glow); margin-bottom:1rem;"><div><div class="ticket-tier-name">${this.selectedTicket.type.toUpperCase()}</div><div class="ticket-tier-benefits">${benefits.join(' · ')}</div>${isEB ? '<div style="color:var(--gold); font-size:0.75rem; margin-top:0.25rem;">Early Bird pricing applied</div>' : ''}</div><div class="tier-price${this.selectedTicket.price === 0 ? ' free' : ''}">${dispPrice}</div></div>`;
    const tt = this.parseTicketTypes(event.ticketTypes);
    document.getElementById('quantity-section').style.display = 'block';
    document.getElementById('ticket-quantity').max = tt[this.selectedTicket.type].capacity - (tt[this.selectedTicket.type].sold || 0);
    this.updateDiscountInfo();
    const qtyInput = document.getElementById('ticket-quantity');
    const groupSection = document.getElementById('group-booking-section');
    qtyInput.oninput = () => { groupSection.style.display = (parseInt(qtyInput.value) || 1) >= 5 ? 'grid' : 'none'; this.updateDiscountInfo(); };
    qtyInput.dispatchEvent(new Event('input'));
    const paySection = document.getElementById('payment-section');
    paySection.style.display = 'block';
    const pmethGrid = document.querySelector('.pmeth-grid');
    const cardEl = document.getElementById('card-element');
    const payBtn = document.getElementById('pay-btn');
    if (this.selectedTicket.price === 0) { if (pmethGrid) pmethGrid.style.display = 'none'; if (cardEl) cardEl.style.display = 'none'; payBtn.textContent = 'Claim Free Ticket'; }
    else { if (pmethGrid) pmethGrid.style.display = 'grid'; if (cardEl) cardEl.style.display = this.selectedPaymentMethod === 'stripe' ? 'block' : 'none'; payBtn.textContent = 'Complete Purchase'; }
    this.openModal('purchase-modal');
  }

  updateDiscountInfo() {
    const quantity = parseInt(document.getElementById('ticket-quantity').value) || 1;
    const discount = this.getGroupDiscount(quantity, this.selectedTicket.type);
    const infoEl = document.getElementById('discount-info');
    infoEl.textContent = discount > 0 ? `Group discount: ${discount}% off for ${quantity} tickets!` : '';
  }

  selectPaymentMethod(btn) {
    document.querySelectorAll('.pmeth-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.selectedPaymentMethod = btn.dataset.method;
    document.getElementById('card-element').style.display = this.selectedPaymentMethod === 'stripe' ? 'block' : 'none';
  }

  async processPayment() {
    const email = document.getElementById('payer-email').value.trim();
    const phone = document.getElementById('payer-phone').value.trim();
    const quantity = parseInt(document.getElementById('ticket-quantity').value) || 1;
    const setReminder = document.getElementById('set-reminder').checked;
    const companyName = document.getElementById('company-name')?.value.trim() || '';
    const billingAddress = document.getElementById('billing-address')?.value.trim() || '';
    const poNumber = document.getElementById('po-number')?.value.trim() || '';
    if (!email || !phone) return this.showError('Email and phone required');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    if (!this.validatePhone(phone)) return this.showError('Invalid phone number format');
    if (quantity >= 5 && companyName && !billingAddress) return this.showError('Billing address required for corporate bookings');
    const statusEl = document.getElementById('payment-status');
    statusEl.style.display = 'block'; statusEl.className = 'status-msg loading';
    statusEl.textContent = this.selectedTicket.price === 0 ? 'Claiming tickets...' : `Processing ${this.selectedPaymentMethod} payment...`;
    try {
      await this.delay(2000);
      const purchaseData = { eventId: this.selectedTicket.eventId, ticketType: this.selectedTicket.type, quantity, paymentDetails: { email, phone }, groupBooking: { companyName, billingAddress, poNumber } };
      const tickets = await this.fetchApi('/tickets/purchase', { method: 'POST', body: JSON.stringify(purchaseData) });
      statusEl.className = 'status-msg success'; statusEl.innerHTML = `<strong>✓ Payment successful! ${quantity} tickets purchased.</strong>`;
      const event = await this.fetchApi(`/events/${this.selectedTicket.eventId}`);
      this.sendSMS(phone, `Your Glycr tickets for ${event.title} (${this.selectedTicket.type.toUpperCase()}) have been purchased!`);
      if (setReminder) { const date = new Date(event.date); this.sendSMS(phone, `Reminder: ${event.title} on ${date.toLocaleDateString()}`); }
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, tickets[0].id, { width: 300 }, (err) => { if (err) console.error(err); });
      document.getElementById('ticket-canvas').innerHTML = ''; document.getElementById('ticket-canvas').appendChild(canvas);
      document.getElementById('ticket-id').textContent = `Ticket ID: ${tickets[0].id}`;
      this.closeAllModals(); this.openModal('ticket-modal');
      if (this.currentUser && !this.currentUser.isOrganizer) this.loadProfile();
      else if (this.currentUser?.isOrganizer) setTimeout(() => { this.closeAllModals(); this.showSection('dashboard'); this.loadDashboard(); }, 3000);
    } catch (err) { statusEl.className = 'status-msg error'; statusEl.textContent = err.message; }
  }

  validateTicket() { alert('✓ Ticket Validated!\n\nWelcome to the event!'); }

  async loadDashboard() {
    if (!this.currentUser || !this.currentUser.isOrganizer) return;
    const myEvents = await this.fetchApi(`/events?organizerId=${this.currentUser.id}`);
    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const now = this.currentDate;
    let revenue = 0, sold = 0, live = 0;
    myEvents.forEach(e => { const tt = this.parseTicketTypes(e.ticketTypes); const s = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0); sold += s; revenue += Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0); if (e.isPublished && !e.isCancelled && new Date(e.date) > now) live++; });
    document.getElementById('total-revenue').textContent = `${sym}${revenue.toFixed(0)}`;
    document.getElementById('total-sold').textContent = sold;
    document.getElementById('events-live').textContent = live;
    document.getElementById('total-events').textContent = myEvents.length;
    const activeEvents = myEvents.filter(e => e.isPublished && !e.isCancelled && new Date(e.date) > now).length;
    document.getElementById('active-events').textContent = activeEvents;
    const payouts = await this.fetchApi('/payouts');
    const totalPaid = payouts.filter(p => p.status === 'completed').reduce((a, p) => a + p.amount, 0);
    document.getElementById('pending-payouts').textContent = `${sym}${(revenue - totalPaid).toFixed(0)}`;
    const histEl = document.getElementById('payout-history');
    histEl.innerHTML = payouts.length ? payouts.map(p => { const sc = p.status === 'completed' ? 'completed' : p.status === 'pending' ? 'pending' : 'failed'; const det = p.method === 'bank' ? `Bank: ${p.details?.bankName}` : p.method === 'momo' ? `MoMo: ${p.details?.phone}` : p.method; return `<div class="payout-row"><div><div class="payout-amt">${sym}${p.amount}</div><div class="payout-meta">${det} · ${new Date(p.requestedAt).toLocaleDateString()}</div></div><span class="status-pill ${sc}">${p.status}</span></div>`; }).join('') : '<div class="payout-row"><span style="color:var(--muted); font-size:0.82rem;">No payout history</span></div>';
    const evEl = document.getElementById('my-events');
    if (myEvents.length === 0) { evEl.innerHTML = '<div class="empty-state"><h3>No events yet</h3><p>Create your first event to get started</p></div>'; return; }
    evEl.innerHTML = myEvents.map(e => { const tt = this.parseTicketTypes(e.ticketTypes); const esym = this.getCurrencySymbol(e.currency); const eRev = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0); const bars = Object.entries(tt).map(([type, t]) => { const s = t.sold || 0; const pct = t.capacity ? (s / t.capacity * 100) : 0; return `<div class="ticket-bar-row"><span class="ticket-bar-label">${type}</span><div class="ticket-bar-track"><div class="ticket-bar-fill" style="width:${pct}%"></div></div><span class="ticket-bar-count">${s}/${t.capacity}</span></div>`; }).join(''); return `<div class="event-admin-card"><div class="event-admin-title">${e.title}</div><div class="event-admin-meta"><i class="fas fa-calendar-alt"></i> ${new Date(e.date).toLocaleDateString()} &nbsp;·&nbsp; <i class="fas fa-money-bill-wave"></i> ${esym}${eRev.toFixed(0)}${e.isCancelled ? ' <span style="color:var(--coral);">· Cancelled</span>' : ''}${!e.isPublished ? ' <span style="color:var(--muted);">· Unpublished</span>' : ''}</div><div style="margin: 0.5rem 0;">${bars}</div><div class="event-admin-actions"><button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="edit-event" data-event-id="${e._id}">Edit</button>${!e.isCancelled ? `<button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem; color:var(--gold); border-color:rgba(251,191,36,0.3);" data-action="cancel-event" data-event-id="${e._id}">Cancel</button>` : ''}<button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="toggle-publish" data-event-id="${e._id}">${e.isPublished ? 'Unpublish' : 'Publish'}</button><button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="export-report" data-event-id="${e._id}">Export CSV</button><button class="btn btn-danger" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="delete-event" data-event-id="${e._id}">Delete</button></div></div>`; }).join('');
  }

  showEventForm(event = null) {
    this.editingEvent = event;
    const form = document.getElementById('event-form');
    form.reset();
    document.getElementById('form-title').textContent = event ? 'Edit Event' : 'Create Event';
    const defaultCurrency = this.currentUser?.currency || 'GHC';
    if (event) {
      document.getElementById('event-title').value = event.title;
      document.getElementById('event-desc').value = event.description;
      document.getElementById('event-date').value = event.date.slice(0, 16);
      document.getElementById('event-venue').value = event.venue;
      document.getElementById('event-location').value = event.location || '';
      document.getElementById('event-category').value = event.category;
      document.getElementById('event-currency').value = event.currency;
      document.getElementById('organizer-email').value = event.organizerEmail;
      document.getElementById('organizer-phone').value = event.organizerPhone;
      const ticketTypes = this.parseTicketTypes(event.ticketTypes);
      document.getElementById('ticket-types-form').innerHTML = '';
      Object.entries(ticketTypes).forEach(([type, data]) => { this.addTicketTypeInput(type, data.price, data.capacity, data.earlyBirdPrice || '', data.earlyBirdEnd || '', data.groupDiscount || 10); });
    } else {
      document.getElementById('ticket-types-form').innerHTML = '';
      this.addTicketTypeInput('free', 0, 100, '', '', 10);
      this.addTicketTypeInput('regular', 50, 200, 40, '2025-11-15T00:00', 10);
      this.addTicketTypeInput('vip', 150, 50, 120, '2025-11-15T00:00', 10);
      this.addTicketTypeInput('vvip', 300, 20, 250, '2025-11-15T00:00', 10);
      document.getElementById('event-currency').value = defaultCurrency;
      document.getElementById('organizer-email').value = this.currentUser.email;
      document.getElementById('organizer-phone').value = this.currentUser.phone || '';
    }
    this.openModal('event-form-modal');
  }

  addTicketTypeInput(name = '', price = '', capacity = '', earlyBirdPrice = '', earlyBirdEnd = '', groupDiscount = '10') {
    const container = document.getElementById('ticket-types-form');
    const div = document.createElement('div');
    div.className = 'ticket-type-row ticket-type';
    div.innerHTML = `<input type="text" class="input type-name" placeholder="Type (e.g. Regular)" value="${name}"><input type="number" class="input type-price" placeholder="Price" min="0" value="${price}"><input type="number" class="input type-capacity" placeholder="Capacity" min="1" value="${capacity}"><input type="number" class="input type-early-price" placeholder="Early ₵" min="0" value="${earlyBirdPrice}"><input type="datetime-local" class="input type-early-end" value="${earlyBirdEnd}"><input type="number" class="input type-group-disc" placeholder="Disc %" min="0" max="50" value="${groupDiscount}"><button type="button" class="remove-ticket">✕</button>`;
    container.appendChild(div);
  }

  async saveEvent() {
    const title = document.getElementById('event-title').value.trim();
    if (!title) return this.showError('Event title required');
    const organizerEmail = document.getElementById('organizer-email').value.trim();
    const organizerPhone = document.getElementById('organizer-phone').value.trim();
    if (!organizerEmail || !organizerPhone) return this.showError('Organizer contact required');
    if (!this.validateEmail(organizerEmail)) return this.showError('Invalid organizer email');
    if (!this.validatePhone(organizerPhone)) return this.showError('Invalid organizer phone');
    const currency = document.getElementById('event-currency').value;
    const ticketInputs = document.querySelectorAll('.ticket-type');
    let originalTicketTypes = null;
    if (this.editingEvent) originalTicketTypes = this.parseTicketTypes(this.editingEvent.ticketTypes);
    const ticketTypes = {};
    ticketInputs.forEach(input => { const type = input.querySelector('.type-name').value.trim().toLowerCase(); const price = parseFloat(input.querySelector('.type-price').value); const capacity = parseInt(input.querySelector('.type-capacity').value); const earlyBirdPrice = parseFloat(input.querySelector('.type-early-price').value) || price; const earlyBirdEnd = input.querySelector('.type-early-end').value; const groupDiscount = parseInt(input.querySelector('.type-group-disc').value) || 10; if (type && !isNaN(price) && !isNaN(capacity)) { const sold = (originalTicketTypes && originalTicketTypes[type]) ? (originalTicketTypes[type].sold || 0) : 0; const ticket = { price, capacity, sold, earlyBirdPrice, groupDiscount }; if (earlyBirdEnd) ticket.earlyBirdEnd = earlyBirdEnd; ticketTypes[type] = ticket; } });
    if (Object.keys(ticketTypes).length === 0) return this.showError('Add at least one ticket type');
    const imageFile = document.getElementById('event-image').files[0];
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', document.getElementById('event-desc').value);
    formData.append('date', document.getElementById('event-date').value);
    formData.append('venue', document.getElementById('event-venue').value);
    formData.append('location', document.getElementById('event-location').value);
    formData.append('category', document.getElementById('event-category').value);
    formData.append('currency', currency);
    formData.append('organizerEmail', organizerEmail);
    formData.append('organizerPhone', organizerPhone);
    formData.append('ticketTypes', JSON.stringify(ticketTypes));
    if (imageFile) formData.append('image', imageFile);
    try {
      if (this.editingEvent) await this.fetchApi(`/events/${this.editingEvent._id}`, { method: 'PUT', body: formData });
      else await this.fetchApi('/events', { method: 'POST', body: formData });
      this.closeAllModals();
      this.showSection('dashboard');
      this.loadDashboard();
      this.renderEvents();
    } catch (err) { this.showError(err.message); }
  }

  async togglePublish(id) { try { await this.fetchApi(`/events/${id}/publish`, { method: 'PATCH' }); this.loadDashboard(); this.renderEvents(); } catch (err) { this.showError(err.message); } }
  showCancelModal(eventId) { const event = this.events.find(e => e._id === eventId); if (!event) return; document.getElementById('cancel-title').textContent = `Cancel ${event.title}?`; document.getElementById('cancel-reason').innerHTML = `<p>This will notify all ticket holders and simulate refunds.</p><p>Are you sure?</p>`; this.currentEventId = eventId; this.openModal('cancel-event-modal'); }
  async cancelEvent() { const eventId = this.currentEventId; try { await this.fetchApi(`/events/${eventId}/cancel`, { method: 'PATCH' }); this.closeAllModals(); this.loadDashboard(); this.renderEvents(); } catch (err) { this.showError(err.message); } }
  async deleteEvent(id) { if (!confirm('Are you sure? This will delete the event and all related tickets.')) return; try { await this.fetchApi(`/events/${id}`, { method: 'DELETE' }); this.loadDashboard(); this.renderEvents(); } catch (err) { this.showError(err.message); } }
  exportReport(eventId) { const event = this.events.find(e => e._id === eventId); if (!event) return this.showError('Event not found'); const eventTickets = this.tickets.filter(t => t.eventId === eventId); let csv = 'Ticket ID,Type,Price,Buyer Email,Phone,Purchase Date,Company Name,Billing Address,PO Number\n'; eventTickets.forEach(t => { csv += `"${t.id}","${t.ticketType}",${t.price},"${t.userEmail}","${t.userPhone}","${new Date(t.purchasedAt).toLocaleString()}","${t.companyName || ''}","${t.billingAddress || ''}","${t.poNumber || ''}"\n`; }); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${event.title.replace(/\s+/g, '_')}_tickets.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }

  async showPayoutModal() { if (!this.currentUser?.isOrganizer) return this.showError('Access denied'); const pending = await this.getPendingPayouts(); document.getElementById('payout-amount').max = pending; document.getElementById('payout-amount').placeholder = `Available: ${this.getCurrencySymbol(this.currentUser.currency || 'GHC')}${pending.toFixed(2)}`; document.getElementById('payout-form').reset(); document.getElementById('payout-title').textContent = `Request Payout (Available: ${this.getCurrencySymbol(this.currentUser.currency || 'GHC')}${pending.toFixed(2)})`; this.openModal('payout-modal'); }
  async getPendingPayouts() { const myPayouts = await this.fetchApi('/payouts'); const totalPaid = myPayouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0); const myEvents = await this.fetchApi(`/events?organizerId=${this.currentUser.id}`); let totalRevenue = 0; for (const e of myEvents) { const tt = this.parseTicketTypes(e.ticketTypes); totalRevenue += Object.values(tt).reduce((s, t) => s + ((t.sold || 0) * t.price), 0); } const settings = await this.fetchApi('/admin/settings').catch(() => ({ platformFee: 10 })); const feePercent = settings.platformFee || 10; const netRevenue = totalRevenue * (1 - feePercent / 100); return netRevenue - totalPaid; }
  togglePayoutDetails(method) { const bankDetails = document.getElementById('bank-details'); const momoDetails = document.getElementById('momo-details'); bankDetails.style.display = method === 'bank' ? 'grid' : 'none'; momoDetails.style.display = method === 'momo' ? 'block' : 'none'; }
  async requestPayout() { const amount = parseFloat(document.getElementById('payout-amount').value); const method = document.getElementById('payout-method').value; const email = document.getElementById('payout-email').value.trim(); const notes = document.getElementById('payout-notes').value.trim(); if (!amount || !method || !email) return this.showPayoutError('Please fill in all fields'); if (!this.validateEmail(email)) return this.showPayoutError('Invalid email format'); let bankDetails = null, momoDetails = null; if (method === 'bank') { const bankName = document.getElementById('bank-name').value.trim(); const accountNumber = document.getElementById('account-number').value.trim(); const accountName = document.getElementById('account-name').value.trim(); if (!bankName || !accountNumber || !accountName) return this.showPayoutError('All bank details required'); bankDetails = { bankName, accountNumber, accountName }; } else if (method === 'momo') { const phone = document.getElementById('momo-number').value.trim(); if (!this.validatePhone(phone)) return this.showPayoutError('Invalid Mobile Money number'); momoDetails = { phone }; } const body = { amount, method, email, notes }; if (bankDetails) body.bankDetails = bankDetails; if (momoDetails) body.momoDetails = momoDetails; try { await this.fetchApi('/payouts', { method: 'POST', body: JSON.stringify(body) }); const statusEl = document.getElementById('payout-status'); statusEl.style.display = 'block'; statusEl.className = 'status-msg success'; statusEl.innerHTML = '<strong>✓ Payout request submitted!</strong>'; setTimeout(() => { this.closeAllModals(); this.loadDashboard(); }, 2000); } catch (err) { this.showPayoutError(err.message); } }
  showPayoutError(message) { const statusEl = document.getElementById('payout-status'); statusEl.style.display = 'block'; statusEl.className = 'status-msg error'; statusEl.textContent = message; }
  async viewWaitlist(eventId, ticketType) { if (!this.currentUser?.isOrganizer) return; try { const entries = await this.fetchApi(`/events/${eventId}/waitlists/${ticketType}`); const event = await this.fetchApi(`/events/${eventId}`); document.getElementById('waitlist-view-title').textContent = `${ticketType.toUpperCase()} Waitlist - ${event.title}`; const html = `<div style="max-height:400px; overflow-y:auto;">${entries.map(entry => `<div class="waitlist-entry"><p><strong>Name:</strong> ${entry.name}</p><p><strong>Email:</strong> ${entry.email}</p><p><strong>Phone:</strong> ${entry.phone}</p><p><strong>Joined:</strong> ${new Date(entry.joinedAt).toLocaleString()}</p></div>`).join('') || '<p style="text-align:center;">No entries</p>'}</div>`; document.getElementById('waitlist-entries').innerHTML = html; document.getElementById('notify-waitlist-btn').onclick = () => this.notifyWaitlist(eventId, ticketType); this.openModal('waitlist-view-modal'); } catch (err) { this.showError(err.message); } }
  async notifyWaitlist(eventId, ticketType) { try { await this.fetchApi(`/events/${eventId}/waitlists/notify`, { method: 'POST' }); alert('Waitlist notified!'); this.closeAllModals(); } catch (err) { this.showError(err.message); } }

  async toggleFavorite(eventId) {
    if (!this.currentUser) return;
    const userId = this.currentUser.id;
    this.favorites[userId] = this.favorites[userId] || [];
    const index = this.favorites[userId].indexOf(eventId);
    if (index > -1) this.favorites[userId].splice(index, 1);
    else this.favorites[userId].push(eventId);
    this.saveToStorage('glycr_favorites', this.favorites);
    if (this.currentUser) {
      try { await this.fetchApi('/users/favorites', { method: 'POST', body: JSON.stringify({ eventId, action: index > -1 ? 'remove' : 'add' }) }); } catch(e) { console.warn(e); }
    }
    this.renderEvents();
    if (document.getElementById('profile')) this.loadProfile();
  }

  isFavorited(event) { if (!this.currentUser) return false; return (this.favorites[this.currentUser.id] || []).includes(event._id); }
  clearFilters() { document.getElementById('search-input').value = ''; document.getElementById('category-filter').value = ''; document.getElementById('location-filter').value = ''; this.renderEvents(); }

  showSection(section) {
    document.getElementById('dropdown-menu')?.classList.remove('show');
    document.getElementById('home-section').style.display = 'none';
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    if (section === 'home') document.getElementById('home-section').style.display = 'block';
    else { const el = document.getElementById(section); if (el) el.style.display = 'block'; }
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const map = { home:'home-link', profile:'profile-link', dashboard:'dashboard-link', 'payout-page':'payout-link', 'myevents-page':'myevents-link', 'report-page':'report-link' };
    const lnk = document.getElementById(map[section]); if (lnk) lnk.classList.add('active');
    if (section === 'home') this.renderEvents();
    if (section === 'profile') this.loadProfile();
    if (section === 'dashboard') this.loadDashboard();
    if (section === 'payout-page') this.loadPayoutPage();
    if (section === 'myevents-page') this.loadMyEventsPage();
    if (section === 'report-page') this.loadReportPage();
  }

  async loadPayoutPage() {
    if (!this.currentUser?.isOrganizer) return;
    let payouts = await this.fetchApi('/payouts');
    const startDate = document.getElementById('payout-start-date').value;
    const endDate = document.getElementById('payout-end-date').value;
    if (startDate) payouts = payouts.filter(p => new Date(p.requestedAt) >= new Date(startDate));
    if (endDate) payouts = payouts.filter(p => new Date(p.requestedAt) <= new Date(endDate));
    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const container = document.getElementById('payout-list');
    if (payouts.length === 0) { container.innerHTML = '<div class="payout-row"><span style="color:var(--muted); font-size:0.82rem;">No payouts found</span></div>'; return; }
    container.innerHTML = payouts.map(p => { const sc = p.status === 'completed' ? 'completed' : p.status === 'pending' ? 'pending' : 'failed'; return `<div class="payout-row"><div><div class="payout-amt">${sym}${p.amount}</div><div class="payout-meta">${p.method} · ${new Date(p.requestedAt).toLocaleDateString()}</div></div><span class="status-pill ${sc}">${p.status}</span></div>`; }).join('');
    document.getElementById('export-payouts-csv').onclick = () => this.exportPayoutsToCSV(payouts);
    document.getElementById('export-payouts-pdf').onclick = () => this.exportPayoutsToPDF(payouts);
  }

  async loadMyEventsPage() {
    if (!this.currentUser?.isOrganizer) return;
    let myEvents = await this.fetchApi(`/events?organizerId=${this.currentUser.id}`);
    const filter = document.getElementById('event-status-filter').value;
    const now = this.currentDate;
    if (filter === 'upcoming') myEvents = myEvents.filter(e => new Date(e.date) > now);
    else if (filter === 'past') myEvents = myEvents.filter(e => new Date(e.date) <= now);
    else if (filter === 'draft') myEvents = myEvents.filter(e => !e.isPublished);
    const container = document.getElementById('my-events-list');
    if (myEvents.length === 0) { container.innerHTML = '<div class="empty-state"><h3>No events found</h3></div>'; return; }
    container.innerHTML = myEvents.map(e => { const tt = this.parseTicketTypes(e.ticketTypes); const esym = this.getCurrencySymbol(e.currency); const eRev = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0); const bars = Object.entries(tt).map(([type, t]) => { const s = t.sold || 0; const pct = t.capacity ? (s / t.capacity * 100) : 0; return `<div class="ticket-bar-row"><span class="ticket-bar-label">${type}</span><div class="ticket-bar-track"><div class="ticket-bar-fill" style="width:${pct}%"></div></div><span class="ticket-bar-count">${s}/${t.capacity}</span></div>`; }).join(''); return `<div class="event-admin-card"><div class="event-admin-title">${e.title}</div><div class="event-admin-meta"><i class="fas fa-calendar-alt"></i> ${new Date(e.date).toLocaleDateString()} &nbsp;·&nbsp; <i class="fas fa-money-bill-wave"></i> ${esym}${eRev.toFixed(0)}${e.isCancelled ? ' <span style="color:var(--coral);">· Cancelled</span>' : ''}${!e.isPublished ? ' <span style="color:var(--muted);">· Unpublished</span>' : ''}</div><div style="margin: 0.5rem 0;">${bars}</div><div class="event-admin-actions"><button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="edit-event" data-event-id="${e._id}">Edit</button>${!e.isCancelled ? `<button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem; color:var(--gold); border-color:rgba(251,191,36,0.3);" data-action="cancel-event" data-event-id="${e._id}">Cancel</button>` : ''}<button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="toggle-publish" data-event-id="${e._id}">${e.isPublished ? 'Unpublish' : 'Publish'}</button><button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="export-report" data-event-id="${e._id}">Export CSV</button><button class="btn btn-danger" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="delete-event" data-event-id="${e._id}">Delete</button></div></div>`; }).join('');
    document.getElementById('create-event-page-btn').onclick = () => this.showEventForm();
  }

  async loadReportPage() {
    if (!this.currentUser?.isOrganizer) return;
    const myEvents = await this.fetchApi(`/events?organizerId=${this.currentUser.id}`);
    let totalEvents = myEvents.length;
    let totalTickets = 0, totalRevenue = 0;
    myEvents.forEach(e => { const tt = this.parseTicketTypes(e.ticketTypes); const sold = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0); totalTickets += sold; totalRevenue += Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0); });
    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    document.getElementById('report-total-events').textContent = totalEvents;
    document.getElementById('report-total-tickets').textContent = totalTickets;
    document.getElementById('report-total-revenue').textContent = `${sym}${totalRevenue.toFixed(2)}`;
    document.getElementById('export-events-csv').onclick = () => this.exportEventsToCSV(myEvents);
    document.getElementById('export-payouts-csv-report').onclick = async () => { const payouts = await this.fetchApi('/payouts'); this.exportPayoutsToCSV(payouts); };
    document.getElementById('export-events-pdf').onclick = () => this.exportEventsToPDF(myEvents);
    document.getElementById('export-payouts-pdf').onclick = async () => { const payouts = await this.fetchApi('/payouts'); this.exportPayoutsToPDF(payouts); };
  }

  exportEventsToCSV(events) {
    let csv = 'Title,Date,Venue,Location,Category,Status,Tickets Sold,Revenue\n';
    events.forEach(e => { const tt = this.parseTicketTypes(e.ticketTypes); const sold = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0); const rev = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0); csv += `"${e.title}","${new Date(e.date).toLocaleString()}","${e.venue}","${e.location || ''}","${e.category}",${e.isCancelled ? 'Cancelled' : (e.isPublished ? 'Published' : 'Draft')},${sold},${rev}\n`; });
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `events_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  exportPayoutsToCSV(payouts) {
    let csv = 'Amount,Method,Status,Requested At,Completed At,Rejection Reason\n';
    payouts.forEach(p => { csv += `${p.amount},${p.method},${p.status},${p.requestedAt},${p.completedAt || ''},${p.rejectionReason || ''}\n`; });
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `payouts_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  exportEventsToPDF(events) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text('My Events Report', 14, 16);
    const tableData = events.map(e => { const tt = this.parseTicketTypes(e.ticketTypes); const sold = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0); const rev = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0); return [e.title, new Date(e.date).toLocaleDateString(), e.venue, sold, `${rev}`]; });
    doc.autoTable({ head: [['Title','Date','Venue','Sold','Revenue']], body: tableData, startY: 22 });
    doc.save(`events_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  exportPayoutsToPDF(payouts) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text('Payout History', 14, 16);
    const tableData = payouts.map(p => [p.amount, p.method, p.status, new Date(p.requestedAt).toLocaleDateString()]);
    doc.autoTable({ head: [['Amount','Method','Status','Requested']], body: tableData, startY: 22 });
    doc.save(`payouts_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // other existing methods (shareEvent, showForgotPasswordModal, handleForgotPassword, checkResetToken, handleResetPassword, showSettingsModal, saveSettings, showSettingsError, openModal, closeAllModals, showError, bindEvents, on, setupMobileMenu) – keep exactly as you had them
  // I will include them briefly for completeness but you already have them.

  shareEvent() { const event = this.events.find(e => e._id === this.currentEventId); if (!event) return; this.shares[event._id] = (this.shares[event._id] || 0) + 1; this.saveToStorage('glycr_shares', this.shares); const shareData = { title: event.title, text: `Check out ${event.title} on Glycr!`, url: window.location.href + '#event-' + event._id + '?ref=' + this.currentUser?.id }; if (navigator.share) navigator.share(shareData).catch(() => {}); else navigator.clipboard.writeText(shareData.url).then(() => alert('Event link copied to clipboard!')); }
  showForgotPasswordModal() { document.getElementById('forgot-email').value = ''; document.getElementById('forgot-status').style.display = 'none'; this.openModal('forgot-password-modal'); }
  async handleForgotPassword() { const email = document.getElementById('forgot-email').value.trim(); if (!email) return this.showError('Please enter your email'); if (!this.validateEmail(email)) return this.showError('Invalid email format'); const statusEl = document.getElementById('forgot-status'); statusEl.style.display = 'block'; statusEl.className = 'status-msg loading'; statusEl.textContent = 'Sending reset link...'; try { await this.fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); statusEl.className = 'status-msg success'; statusEl.textContent = 'If the email exists, a reset link has been sent.'; setTimeout(() => this.closeAllModals(), 3000); } catch (err) { statusEl.className = 'status-msg error'; statusEl.textContent = err.message; } }
  checkResetToken() { const urlParams = new URLSearchParams(window.location.search); const token = urlParams.get('reset_token'); if (token) { localStorage.setItem('reset_token', token); window.history.replaceState({}, document.title, window.location.pathname); this.openModal('reset-password-modal'); } }
  async handleResetPassword() { const newPassword = document.getElementById('new-password').value; const confirmPassword = document.getElementById('confirm-new-password').value; const token = localStorage.getItem('reset_token'); if (!token) return this.showError('Invalid reset link'); if (!newPassword || !confirmPassword) return this.showError('Please fill in both fields'); if (newPassword !== confirmPassword) return this.showError('Passwords do not match'); const strength = this.checkPasswordStrength(newPassword); if (strength.width === '0%') return this.showError('Password is too weak.'); const statusEl = document.getElementById('reset-status'); statusEl.style.display = 'block'; statusEl.className = 'status-msg loading'; statusEl.textContent = 'Resetting password...'; try { await this.fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }); statusEl.className = 'status-msg success'; statusEl.textContent = 'Password reset successfully. You can now log in.'; localStorage.removeItem('reset_token'); setTimeout(() => { this.closeAllModals(); this.openModal('auth-modal'); }, 2000); } catch (err) { statusEl.className = 'status-msg error'; statusEl.textContent = err.message; } }
  showSettingsModal() { document.getElementById('current-password').value = ''; document.getElementById('new-password-settings').value = ''; document.getElementById('confirm-new-password-settings').value = ''; document.getElementById('settings-status').style.display = 'none'; this.openModal('settings-modal'); }
  async saveSettings(e) { e.preventDefault(); const currentPassword = document.getElementById('current-password').value; const newPassword = document.getElementById('new-password-settings').value; const confirmPassword = document.getElementById('confirm-new-password-settings').value; const notifyEmail = document.getElementById('notify-email').checked; const notifySms = document.getElementById('notify-sms').checked; if (!currentPassword || !newPassword || !confirmPassword) return this.showSettingsError('Please fill in all password fields'); if (newPassword !== confirmPassword) return this.showSettingsError('New passwords do not match'); const strength = this.checkPasswordStrength(newPassword); if (strength.width === '0%') return this.showSettingsError('Password is too weak.'); const statusEl = document.getElementById('settings-status'); statusEl.style.display = 'block'; statusEl.className = 'status-msg loading'; statusEl.textContent = 'Updating settings...'; try { await this.fetchApi('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); localStorage.setItem('notify_email', notifyEmail); localStorage.setItem('notify_sms', notifySms); statusEl.className = 'status-msg success'; statusEl.textContent = 'Settings saved successfully!'; setTimeout(() => this.closeAllModals(), 2000); } catch (err) { statusEl.className = 'status-msg error'; statusEl.textContent = err.message; } }
  showSettingsError(message) { const statusEl = document.getElementById('settings-status'); statusEl.style.display = 'block'; statusEl.className = 'status-msg error'; statusEl.textContent = message; }
  openModal(modalId) { document.querySelectorAll('.modal').forEach(m => m.classList.remove('show')); const m = document.getElementById(modalId); if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; const content = m.querySelector('.modal-box'); if (content) { content.setAttribute('tabindex', '-1'); content.focus(); const focusable = content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); const first = focusable[0]; const last = focusable[focusable.length - 1]; const trap = (e) => { if (e.key === 'Tab') { if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } } else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } } } }; content.addEventListener('keydown', trap); m._focusTrapHandler = trap; } } }
  closeAllModals() { document.querySelectorAll('.modal').forEach(modal => { modal.classList.remove('show'); const content = modal.querySelector('.modal-box'); if (content && modal._focusTrapHandler) { content.removeEventListener('keydown', modal._focusTrapHandler); delete modal._focusTrapHandler; } }); document.body.style.overflow = ''; }
  showError(message) { const candidates = ['payment-status', 'waitlist-status', 'payout-status']; for (const id of candidates) { const el = document.getElementById(id); if (el && el.closest('.modal.show')) { el.style.display = 'block'; el.className = 'status-msg error'; el.textContent = message; return; } } alert(message); }
  bindEvents() {
    this.on('home-link', 'click', () => this.showSection('home'));
    this.on('dashboard-link', 'click', () => this.showSection('dashboard'));
    this.on('payout-link', 'click', () => this.showSection('payout-page'));
    this.on('myevents-link', 'click', () => this.showSection('myevents-page'));
    this.on('report-link', 'click', () => this.showSection('report-page'));
    this.on('login-link', 'click', () => this.openModal('auth-modal'));
    this.on('logout-link', 'click', () => this.logout());
    this.on('search-input', 'input', () => this.renderEvents());
    this.on('category-filter', 'change', () => this.renderEvents());
    this.on('location-filter', 'change', () => this.renderEvents());
    this.on('clearFilters', 'click', () => this.clearFilters());
    this.on('event-date-filter', 'change', () => this.loadDashboard());
    this.on('auth-form', 'submit', (e) => { e.preventDefault(); this.handleAuth(); });
    this.on('edit-profile-btn', 'click', () => this.openModal('profile-edit-modal'));
    this.on('profile-form', 'submit', (e) => { e.preventDefault(); this.saveProfile(); });
    document.getElementById('toggle-auth').addEventListener('click', (e) => { if (e.target.tagName === 'A') e.preventDefault(), this.toggleAuthMode(); });
    this.on('create-event-btn', 'click', () => this.showEventForm());
    this.on('create-event-btn-hero', 'click', () => this.showEventForm());
    this.on('event-form', 'submit', (e) => { e.preventDefault(); this.saveEvent(); });
    this.on('add-ticket-type', 'click', () => this.addTicketTypeInput());
    this.on('buy-ticket-btn', 'click', () => this.showPurchaseFlow());
    this.on('pay-btn', 'click', () => this.processPayment());
    this.on('request-payout-btn', 'click', () => this.showPayoutModal());
    this.on('request-payout-page-btn', 'click', () => this.showPayoutModal());
    this.on('payout-form', 'submit', (e) => { e.preventDefault(); this.requestPayout(); });
    document.getElementById('payout-method').addEventListener('change', (e) => this.togglePayoutDetails(e.target.value));
    this.on('waitlist-form', 'submit', (e) => { e.preventDefault(); this.joinWaitlist(); });
    const resetPasswordField = document.getElementById('new-password'); if (resetPasswordField) { resetPasswordField.addEventListener('input', () => { const strength = this.checkPasswordStrength(resetPasswordField.value); const bar = document.getElementById('reset-strength-bar'); const text = document.getElementById('reset-strength-text'); if (bar) { bar.style.width = strength.width; bar.style.backgroundColor = strength.color; } if (text) { text.textContent = strength.text; text.style.color = strength.color; } }); }
    document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => this.closeAllModals()));
    document.querySelectorAll('.modal-backdrop').forEach(bd => bd.addEventListener('click', () => this.closeAllModals()));
    document.querySelectorAll('.pmeth-btn').forEach(btn => { btn.addEventListener('click', (e) => { document.querySelectorAll('.pmeth-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); this.selectedPaymentMethod = btn.dataset.method; const ce = document.getElementById('card-element'); if (ce) ce.style.display = btn.dataset.method === 'stripe' ? 'block' : 'none'; }); });
    this.on('share-btn', 'click', () => this.shareEvent());
    this.on('validate-ticket', 'click', () => this.validateTicket());
    document.addEventListener('click', (e) => { if (e.target.classList.contains('remove-ticket')) e.target.closest('.ticket-type').remove(); if (e.target.classList.contains('waitlist-btn')) this.showWaitlistModal(e.target.dataset.eventId, e.target.dataset.ticketType); if (e.target.classList.contains('fav-btn')) { e.stopPropagation(); this.toggleFavorite(e.target.dataset.eventId); } });
    document.getElementById('forgot-password-link')?.addEventListener('click', (e) => { e.preventDefault(); this.closeAllModals(); this.showForgotPasswordModal(); });
    this.on('forgot-password-form', 'submit', (e) => { e.preventDefault(); this.handleForgotPassword(); });
    this.on('reset-password-form', 'submit', (e) => { e.preventDefault(); this.handleResetPassword(); });
    document.addEventListener('click', async (e) => { const target = e.target; if (target.dataset.action === 'edit-event') { const event = await this.fetchApi(`/events/${target.dataset.eventId}`); this.showEventForm(event); } else if (target.dataset.action === 'cancel-event') { this.showCancelModal(target.dataset.eventId); } else if (target.dataset.action === 'toggle-publish') { this.togglePublish(target.dataset.eventId); } else if (target.dataset.action === 'export-report') { this.exportReport(target.dataset.eventId); } else if (target.dataset.action === 'delete-event') { this.deleteEvent(target.dataset.eventId); } else if (target.dataset.action === 'view-waitlist') { this.viewWaitlist(target.dataset.eventId, target.dataset.ticketType); } });
    this.on('confirm-cancel', 'click', () => this.cancelEvent());
    document.getElementById('notify-waitlist-btn').addEventListener('click', () => this.notifyWaitlist(this.currentEventId, this.selectedTicketType));
    const passwordField = document.getElementById('password'); if (passwordField) { passwordField.addEventListener('input', () => { const strength = this.checkPasswordStrength(passwordField.value); const bar = document.getElementById('strength-bar'); const text = document.getElementById('strength-text'); if (bar) { bar.style.width = strength.width; bar.style.backgroundColor = strength.color; } if (text) { text.textContent = strength.text; text.style.color = strength.color; } }); }
    const trigger = document.getElementById('profile-trigger'); const dropdownMenu = document.getElementById('dropdown-menu'); if (trigger && dropdownMenu) { trigger.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.toggle('show'); }); document.addEventListener('click', (e) => { if (!trigger.contains(e.target) && !dropdownMenu.contains(e.target)) dropdownMenu.classList.remove('show'); }); }
    document.getElementById('dropdown-profile-page')?.addEventListener('click', (e) => { e.preventDefault(); dropdownMenu.classList.remove('show'); this.showSection('profile'); });
    document.getElementById('dropdown-edit-profile')?.addEventListener('click', (e) => { e.preventDefault(); dropdownMenu.classList.remove('show'); this.openModal('profile-edit-modal'); });
    document.getElementById('dropdown-settings')?.addEventListener('click', (e) => { e.preventDefault(); dropdownMenu.classList.remove('show'); this.showSettingsModal(); });
    document.getElementById('dropdown-logout')?.addEventListener('click', (e) => { e.preventDefault(); dropdownMenu.classList.remove('show'); this.logout(); });
    this.on('settings-form', 'submit', (e) => this.saveSettings(e));
    const settingsPasswordField = document.getElementById('new-password-settings'); if (settingsPasswordField) { settingsPasswordField.addEventListener('input', () => { const strength = this.checkPasswordStrength(settingsPasswordField.value); const bar = document.getElementById('settings-strength-bar'); const text = document.getElementById('settings-strength-text'); if (bar) { bar.style.width = strength.width; bar.style.backgroundColor = strength.color; } if (text) { text.textContent = strength.text; text.style.color = strength.color; } }); }
  }
  on(id, event, handler) { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); }
  setupMobileMenu() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    if (mobileBtn && navMenu) {
      mobileBtn.addEventListener('click', () => {
        navMenu.classList.toggle('open');
        const expanded = navMenu.classList.contains('open');
        mobileBtn.setAttribute('aria-expanded', expanded);
      });
    }
  }
}
const app = new GlycrApp();
