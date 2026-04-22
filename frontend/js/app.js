// Glycr App — Complete Version
class GlycrApp {
  constructor() {
    this.apiBase = 'http://localhost:5020/api';
    this.currentUser = null;
    this.events = [];
    this.tickets = [];
    this.favorites = this.loadFromStorage('glycr_favorites') || {};
    this.shares = this.loadFromStorage('glycr_shares') || {};
    this.payouts = [];
    this.currentEventId = null;
    this.selectedTicket = null;
    this.selectedTicketType = null;
    this.editingEvent = null;
    this.dashChart = null;
    this.reportRevenueChart = null;
    this.reportTicketChart = null;
    this.selectedPaymentMethod = 'mtn-momo';
    this.currentDate = new Date();
    this.platformFeePercent = 3;
    this.mapsLoaded = false;
    this.mapsInstance = null;
    this.mapsMarker = null;
    this.mapsAutocomplete = null;
    this.init();
  }

  // ─── Helpers ──────────────────────────────────────────────
  sendSMS(phone, msg) { console.log(`📱 SMS to ${phone}: ${msg}`); }
  sendEmail(email, subj, body) { console.log(`📧 Email to ${email}: ${subj}`); }

  getCategoryIcon(slug) {
    const icons = {
      music: 'fa-music', food: 'fa-utensils', arts: 'fa-palette',
      sports: 'fa-futbol', business: 'fa-briefcase', nightlife: 'fa-moon',
      family: 'fa-child', workshops: 'fa-chalkboard-user',
      community: 'fa-users', free: 'fa-ticket-alt',
    };
    return icons[slug] || 'fa-calendar';
  }

  getFullImageUrl(p) {
    if (!p) return 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600';
    if (p.startsWith('/uploads/')) return `${this.apiBase.replace('/api', '')}${p}`;
    return p;
  }

  getCategoryName(slug) {
    const n = {
      music: 'Music', food: 'Food & Drink', arts: 'Arts & Theater',
      sports: 'Sports & Fitness', business: 'Business & Networking',
      nightlife: 'Nightlife & Parties', family: 'Family & Kids',
      workshops: 'Workshops & Classes', community: 'Community & Festivals',
      free: 'Free Events',
    };
    return n[slug] || slug;
  }

  getCurrencySymbol(c) {
    return { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', GHC: '₵' }[c] || '₵';
  }

  validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  validatePhone(p) { return /^\+233\d{9}$/.test(p); }

  parseTicketTypes(tt) {
    if (typeof tt === 'string') { try { return JSON.parse(tt); } catch { return {}; } }
    return tt || {};
  }

  isEarlyBird(event, type) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    const end = tt[type]?.earlyBirdEnd;
    return end ? this.currentDate < new Date(end) : false;
  }

  getTicketPrice(event, type) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    const base = tt[type]?.price || 0;
    return (this.isEarlyBird(event, type) && tt[type]?.earlyBirdPrice)
      ? tt[type].earlyBirdPrice : base;
  }

  getGroupDiscount(qty, type) {
    const ev = this.events.find(e => e._id === this.currentEventId);
    if (!ev) return 0;
    const disc = this.parseTicketTypes(ev.ticketTypes)[type]?.groupDiscount || 0;
    return qty >= 10 ? disc * 2 : qty >= 5 ? disc : 0;
  }

  getTicketBenefits(type) {
    const b = {
      free: ['Free entry', 'General admission', 'Event access', 'Digital ticket'],
      regular: ['General admission', 'Event access', 'Digital ticket'],
      vip: ['Early entry', 'Premium seating', 'VIP lounge access', 'Meet & greet'],
      vvip: ['All VIP benefits', 'Backstage access', 'Photo opportunities', 'Exclusive merchandise'],
    };
    return b[type?.toLowerCase()] || ['Event access'];
  }

  isEventSoldOut(event) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    for (const t of Object.values(tt)) {
      if (t.capacity - (t.sold || 0) > 0) return false;
    }
    return Object.keys(tt).length > 0;
  }

  loadFromStorage(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  saveToStorage(k, d) { localStorage.setItem(k, JSON.stringify(d)); }

  checkPasswordStrength(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    const m = [
      { width: '0%',   text: 'Very Weak',   color: '#ef4444' },
      { width: '20%',  text: 'Weak',         color: '#f59e0b' },
      { width: '40%',  text: 'Fair',         color: '#f59e0b' },
      { width: '60%',  text: 'Good',         color: '#10b981' },
      { width: '80%',  text: 'Strong',       color: '#10b981' },
      { width: '100%', text: 'Very Strong',  color: '#10b981' },
    ];
    return m[Math.min(s, 5)];
  }

  clearPasswordStrength() {
    const b = document.getElementById('strength-bar');
    const t = document.getElementById('strength-text');
    if (b) b.style.width = '0%';
    if (t) t.textContent = '';
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async fetchApi(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    let url = `${this.apiBase}${endpoint}`;
    if (options.cacheBust) url += `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // ─── Init ─────────────────────────────────────────────────
  async init() {
    await this.checkAuth();
    this.bindEvents();
    await this.renderEvents();
    this.buildCarousel();
    this.setupMobileMenu();
    this.checkResetToken();
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeAllModals();
    });
  }

  // ─── Carousel ─────────────────────────────────────────────
  buildCarousel() {
    const slidesEl = document.getElementById('carousel-slides');
    const dotsEl   = document.getElementById('carousel-dots');
    if (!slidesEl || !dotsEl) return;

    const FEATURED = this.events.slice(0, 4);
    if (!FEATURED.length) return;

    slidesEl.innerHTML = FEATURED.map((ev, i) => {
      const sym   = this.getCurrencySymbol(ev.currency);
      const tt    = this.parseTicketTypes(ev.ticketTypes);
      let minP    = Infinity;
      Object.values(tt).forEach(t => { if (t.price < minP) minP = t.price; });
      const price = minP === 0 ? 'Free' : `${sym}${minP}`;
      return `<div class="carousel-slide${i === 0 ? ' active' : ''}" data-event-id="${ev._id}">
        <img src="${this.getFullImageUrl(ev.image)}" alt="${ev.title}" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900'">
        <div class="carousel-info">
          <div class="carousel-cat">${this.getCategoryName(ev.category)}</div>
          <div class="carousel-title">${ev.title}</div>
          <div class="carousel-venue"><i class="fas fa-map-marker-alt"></i> ${ev.venue}, ${ev.location || 'Ghana'}</div>
          <span class="carousel-price-tag">${price}</span>
        </div>
      </div>`;
    }).join('');

    dotsEl.innerHTML = FEATURED.map((_, i) =>
      `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}"></button>`
    ).join('');

    let cur = 0;
    const go = n => {
      slidesEl.querySelectorAll('.carousel-slide').forEach((s, i) => s.classList.toggle('active', i === n));
      dotsEl.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === n));
      cur = n;
    };

    dotsEl.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => go(parseInt(dot.dataset.index)));
    });

    slidesEl.querySelectorAll('.carousel-slide').forEach(slide => {
      slide.addEventListener('click', () => {
        const id = slide.dataset.eventId;
        if (id) this.showEventDetail(id);
      });
    });

    setInterval(() => go((cur + 1) % FEATURED.length), 4500);
  }

  // ─── Mobile menu ──────────────────────────────────────────
  setupMobileMenu() {
    const btn  = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('navMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
      btn.classList.toggle('is-open', open);
    });
    // Close when a nav link is clicked
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        menu.classList.remove('open');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
    // Close on outside click
    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
        btn.classList.remove('is-open');
      }
    });
  }

  // ─── Auth ─────────────────────────────────────────────────
  async checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const user = await this.fetchApi('/auth/profile');
      this.currentUser = user;
      localStorage.setItem('user', JSON.stringify(user));
      this.updateNav();
      await this.fetchPlatformFee();
      this.showSection(this.currentUser.isOrganizer ? 'dashboard' : 'profile');
    } catch { this.logout(); }
  }

  async fetchPlatformFee() {
    try {
      const s = await this.fetchApi('/settings');
      this.platformFeePercent = s.platformFee || 10;
    } catch { this.platformFeePercent = 10; }
  }

  async handleAuth() {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const isLogin  = document.getElementById('auth-title').textContent === 'Sign In';
    if (!email || !password) return this.showError('Please fill in all fields');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    try {
      let result;
      if (isLogin) {
        result = await this.fetchApi('/auth/login', {
          method: 'POST', body: JSON.stringify({ email, password }),
        });
      } else {
        const firstName  = document.getElementById('first-name').value.trim();
        const lastName   = document.getElementById('last-name').value.trim();
        const username   = document.getElementById('username').value.trim();
        const phone      = document.getElementById('phone').value.trim();
        const confirmPw  = document.getElementById('confirm-password').value;
        const isOrg      = document.getElementById('is-organizer').checked;
        if (!firstName || !lastName || !username || !phone)
          return this.showError('Please fill in all fields');
        if (!this.validatePhone(phone))
          return this.showError('Invalid phone number format (+233xxxxxxxxx)');
        if (password !== confirmPw) return this.showError('Passwords do not match');
        if (this.checkPasswordStrength(password).width === '0%')
          return this.showError('Password is too weak');
        result = await this.fetchApi('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: `${firstName} ${lastName}`, email, password,
            phone, isOrganizer: isOrg, username,
          }),
        });
      }
      localStorage.setItem('token', result.token);
      this.currentUser = result.user;
      localStorage.setItem('user', JSON.stringify(result.user));
      this.updateNav();
      this.closeAllModals();
      await this.fetchPlatformFee();
      if (this.currentUser.isOrganizer) {
        await this.loadDashboard();
        this.showSection('dashboard');
      } else {
        await this.loadProfile();
        this.showSection('profile');
      }
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
    const loggedIn = !!this.currentUser;
    const isOrg    = this.currentUser?.isOrganizer;
    const $ = id => document.getElementById(id);
    $('login-link').style.display       = loggedIn ? 'none' : 'inline-flex';
    $('profile-dropdown').style.display = loggedIn ? 'inline-block' : 'none';
    $('dashboard-link').style.display   = isOrg ? 'block' : 'none';
    $('payout-link').style.display      = isOrg ? 'block' : 'none';
    $('myevents-link').style.display    = isOrg ? 'block' : 'none';
    $('report-link').style.display      = isOrg ? 'block' : 'none';
    $('create-event-btn-hero').style.display = isOrg ? 'inline-flex' : 'none';
    if (loggedIn) {
      const name = this.currentUser.name || 'User';
      $('profile-name-small').textContent  = name;
      $('profile-avatar-small').textContent = name.charAt(0).toUpperCase();
    }
  }

  toggleAuthMode() {
    const title   = document.getElementById('auth-title');
    const isLogin = title.textContent === 'Sign In';
    title.textContent = isLogin ? 'Create Account' : 'Sign In';
    document.getElementById('auth-btn').textContent = isLogin ? 'Create Account' : 'Sign In';
    document.getElementById('register-fields').style.display = isLogin ? 'block' : 'none';
    document.getElementById('toggle-auth').innerHTML = isLogin
      ? 'Already have an account? <a href="#">Sign in</a>'
      : 'Don\'t have an account? <a href="#">Create one</a>';
    if (!isLogin) {
      ['first-name', 'last-name', 'username', 'confirm-password', 'phone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const chk = document.getElementById('is-organizer');
      if (chk) chk.checked = false;
    }
    this.clearPasswordStrength();
  }

  // ─── Section routing ──────────────────────────────────────
  showSection(section) {
    document.getElementById('dropdown-menu')?.classList.remove('show');
    document.getElementById('home-section').style.display = 'none';
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');

    if (section === 'home') {
      document.getElementById('home-section').style.display = 'block';
    } else {
      const el = document.getElementById(section);
      if (el) el.style.display = 'block';
    }

    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const map = {
      home: 'home-link',
      profile: 'profile-link',
      dashboard: 'dashboard-link',
      'payout-page': 'payout-link',
      'myevents-page': 'myevents-link',
      'report-page': 'report-link',
    };
    const lnk = document.getElementById(map[section]);
    if (lnk) lnk.classList.add('active');

    if (section === 'home')          this.renderEvents();
    if (section === 'profile')       this.loadProfile();
    if (section === 'dashboard')     this.loadDashboard();
    if (section === 'payout-page')   this.loadPayoutPage();
    if (section === 'myevents-page') this.loadMyEventsPage();
    if (section === 'report-page')   this.loadReportPage();
  }

  // ─── Profile ──────────────────────────────────────────────
  async loadProfile() {
    if (!this.currentUser) return;
    const name = this.currentUser.name || 'User';
    document.getElementById('profile-name').textContent   = name;
    document.getElementById('profile-email').textContent  = this.currentUser.email;
    document.getElementById('profile-phone').textContent  = this.currentUser.phone || '—';
    document.getElementById('profile-avatar').textContent = name.charAt(0).toUpperCase();
    try {
      const ut = await this.fetchApi('/tickets/my');
      document.getElementById('purchase-history-list').innerHTML = ut.length
        ? ut.map(t => {
          const ev  = this.events.find(e => e._id === t.eventId);
          const sym = this.getCurrencySymbol(ev?.currency || 'GHC');
          return `<div class="purchase-item">
            <div class="purchase-item-title">${ev ? ev.title : 'Event'}</div>
            <div class="purchase-item-meta">${t.ticketType.toUpperCase()} · ${t.price === 0 ? 'Free' : sym + t.price} · ${new Date(t.purchasedAt).toLocaleDateString()}</div>
          </div>`;
        }).join('')
        : '<p style="color:var(--muted); font-size:0.82rem;">No purchases yet</p>';
    } catch {}
    const favIds = this.favorites[this.currentUser.id] || [];
    const favEvs = this.events.filter(e => favIds.includes(e._id) && !e.isCancelled);
    document.getElementById('favorite-events-list').innerHTML = favEvs.length
      ? favEvs.map(e => this.renderEventCard(e)).join('')
      : '<p style="color:var(--muted); font-size:0.82rem; grid-column:1/-1;">No favourites yet</p>';
  }

  async saveProfile() {
    const name  = document.getElementById('profile-name-input').value.trim();
    const email = document.getElementById('profile-email-input').value.trim();
    const phone = document.getElementById('profile-phone-input').value.trim();
    if (!name || !email || !phone) return this.showError('Please fill in all fields');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    if (!this.validatePhone(phone)) return this.showError('Invalid phone format');
    try {
      const u = await this.fetchApi('/auth/profile', {
        method: 'PUT', body: JSON.stringify({ name, email, phone }),
      });
      this.currentUser = u;
      localStorage.setItem('user', JSON.stringify(u));
      this.updateNav();
      this.closeAllModals();
      this.loadProfile();
    } catch (err) { this.showError(err.message); }
  }

  // ─── Events list ──────────────────────────────────────────
  async renderEvents() {
    const search   = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const location = document.getElementById('location-filter').value;
    const q = new URLSearchParams();
    if (search)   q.append('search', search);
    if (category) q.append('category', category);
    if (location) q.append('location', location);
    q.append('upcoming', 'true');
    const grid = document.getElementById('events-grid');
    try {
      this.events = await this.fetchApi(`/events?${q}`, { cacheBust: true });
      if (!this.events.length) {
        grid.innerHTML = '<div class="empty-state"><h3>No events found</h3><p>Try adjusting your filters</p></div>';
        return;
      }
      grid.innerHTML = this.events.map(e => this.renderEventCard(e)).join('');
      grid.querySelectorAll('.event-card:not(.cancelled)').forEach(card => {
        card.onclick = e => {
          if (!e.target.closest('.fav-btn')) this.showEventDetail(card.dataset.eventId);
        };
      });
    } catch {
      grid.innerHTML = '<div class="empty-state">Failed to load events. Please try again.</div>';
    }
  }

  renderEventCard(event) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    let minPrice = Infinity, minType = null;
    Object.entries(tt).forEach(([type, data]) => {
      const p = this.getTicketPrice(event, type);
      if (p < minPrice) { minPrice = p; minType = type; }
    });
    const sym     = this.getCurrencySymbol(event.currency);
    const isFree  = minPrice === 0;
    const isEB    = this.isEarlyBird(event, minType);
    const soldOut = this.isEventSoldOut(event);
    const isFav   = this.isFavorited(event);
    const date    = new Date(event.date);
    const icon    = this.getCategoryIcon(event.category);
    const cat     = this.getCategoryName(event.category);

    let priceHtml;
    if (soldOut)       priceHtml = `<span class="card-price sold-out"><i class="fas fa-times-circle"></i> Sold Out</span>`;
    else if (isFree)   priceHtml = `<span class="card-price free">Free</span>`;
    else               priceHtml = `<span class="card-price${isEB ? ' early-bird' : ''}">${sym}${minPrice}</span>`;

    return `<div class="event-card${event.isCancelled ? ' cancelled' : ''}" data-event-id="${event._id}">
      <div class="card-img">
        <img src="${this.getFullImageUrl(event.image)}" alt="${event.title}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600'">
        <div class="card-img-overlay"></div>
        <span class="card-cat-badge"><i class="fas ${icon}"></i> ${cat}</span>
        ${event.isCancelled ? '<span class="card-cancelled-badge">Cancelled</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${event.title}</div>
        <div class="card-meta">
          <div class="card-meta-row"><i class="fas fa-calendar-alt"></i> ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div class="card-meta-row"><i class="fas fa-map-marker-alt"></i> ${event.venue}, ${event.location || 'Ghana'}</div>
        </div>
        <div class="card-footer">
          ${priceHtml}
          ${isEB && !isFree && !soldOut ? '<span class="early-tag">Early Bird</span>' : ''}
          ${!event.isCancelled
      ? `<button class="fav-btn${isFav ? ' active' : ''}" data-event-id="${event._id}" aria-label="Favourite">
                <i class="fas fa-heart"></i></button>`
      : ''}
        </div>
      </div>
    </div>`;
  }

  // ─── Event detail modal ───────────────────────────────────
  async showEventDetail(id) {
    try {
      const event = await this.fetchApi(`/events/${id}`);
      if (event.isCancelled) return this.showError('This event has been cancelled.');
      this.currentEventId = id;
      const tt   = this.parseTicketTypes(event.ticketTypes);
      const date = new Date(event.date);
      const sym  = this.getCurrencySymbol(event.currency);
      const icon = this.getCategoryIcon(event.category);
      const cat  = this.getCategoryName(event.category);

      let locationHtml = `${event.venue}, ${event.location}`;
      if (event.lat && event.lng) {
        locationHtml = `<a href="https://maps.google.com/?q=${event.lat},${event.lng}" target="_blank" style="color:var(--teal);">${event.address || locationHtml} <i class="fas fa-external-link-alt" style="font-size:0.7rem;"></i></a>`;
      }

      document.getElementById('event-detail').innerHTML = `
        <div class="detail-hero">
          <img src="${this.getFullImageUrl(event.image)}" alt="${event.title}"
               onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900'">
          <div class="detail-hero-overlay"></div>
          <span class="detail-cat-badge"><i class="fas ${icon}"></i> ${cat}</span>
        </div>
        <h2 class="detail-title">${event.title}</h2>
        <div class="detail-meta">
          <span class="detail-meta-item"><i class="fas fa-calendar-alt"></i> ${date.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span class="detail-meta-item"><i class="fas fa-map-marker-alt"></i> ${locationHtml}</span>
          <span class="detail-meta-item"><i class="fas fa-envelope"></i> <a href="mailto:${event.organizerEmail}" style="color:var(--teal);">${event.organizerEmail}</a></span>
          <span class="detail-meta-item"><i class="fas fa-phone-alt"></i> ${event.organizerPhone}</span>
        </div>
        <p class="detail-desc">${event.description}</p>
        <p class="tickets-label">Available Tickets</p>`;

      document.getElementById('ticket-benefits').innerHTML = Object.entries(tt).map(([type, data]) => {
        const avail   = data.capacity - (data.sold || 0);
        const soldOut = avail <= 0;
        const price   = this.getTicketPrice(event, type);
        const isEB    = this.isEarlyBird(event, type);
        const bens    = this.getTicketBenefits(type);
        const priceStr = price === 0 ? 'Free' : `${sym}${price}${isEB ? ' (Early Bird)' : ''}`;
        if (soldOut) {
          return `<div class="ticket-tier sold-out">
            <div>
              <div class="ticket-tier-name">${type.toUpperCase()}</div>
              <div class="ticket-tier-avail" style="color:var(--coral);">Sold Out</div>
              <div class="ticket-tier-benefits">${bens.join(' · ')}</div>
              <button class="btn btn-ghost" style="margin-top:0.5rem; font-size:0.75rem;"
                onclick="event.stopPropagation(); app.showWaitlistModal('${event._id}','${type}')">
                Join Waitlist
              </button>
            </div>
            <div class="tier-price sold-out-lbl">Sold Out</div>
          </div>`;
        }
        return `<div class="ticket-tier" data-type="${type}" data-price="${price}">
          <div>
            <div class="ticket-tier-name">${type.toUpperCase()}</div>
            <div class="ticket-tier-avail">${avail} remaining</div>
            <div class="ticket-tier-benefits">${bens.join(' · ')}</div>
          </div>
          <div class="tier-price${price === 0 ? ' free' : ''}">${priceStr}</div>
        </div>`;
      }).join('');

      document.querySelectorAll('.ticket-tier[data-type]').forEach(tier => {
        tier.addEventListener('click', () =>
          this.selectTicket(tier.dataset.type, parseFloat(tier.dataset.price), event._id)
        );
      });
      this.openModal('event-modal');
    } catch (err) { this.showError(err.message); }
  }

  // ─── Waitlist ─────────────────────────────────────────────
  showWaitlistModal(eventId, type) {
    this.currentEventId = eventId;
    this.selectedTicket = { type, eventId };
    document.getElementById('waitlist-title').textContent = `Join Waitlist for ${type.toUpperCase()} Tickets`;
    document.getElementById('waitlist-form').reset();
    this.openModal('waitlist-modal');
  }

  async joinWaitlist() {
    const name  = document.getElementById('waitlist-name').value.trim();
    const email = document.getElementById('waitlist-email').value.trim();
    const phone = document.getElementById('waitlist-phone').value.trim();
    if (!name || !email || !phone) return this.showError('Please fill in all fields');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    if (!this.validatePhone(phone)) return this.showError('Invalid phone format');
    try {
      await this.fetchApi('/waitlists', {
        method: 'POST',
        body: JSON.stringify({ eventId: this.selectedTicket.eventId, ticketType: this.selectedTicket.type, name, email, phone }),
      });
      const s = document.getElementById('waitlist-status');
      s.style.display = 'block'; s.className = 'status-msg success';
      s.innerHTML = '<strong>✓ Joined waitlist!</strong>';
      setTimeout(() => { this.closeAllModals(); this.showEventDetail(this.currentEventId); }, 2000);
    } catch (err) { this.showError(err.message); }
  }

  // ─── Purchase flow ────────────────────────────────────────
  selectTicket(type, price, eventId) {
    this.selectedTicket = { type, price, eventId };
    this.showPurchaseFlow();
  }

  async showPurchaseFlow() {
    if (!this.selectedTicket) return;
    const event    = await this.fetchApi(`/events/${this.selectedTicket.eventId}`);
    const benefits = this.getTicketBenefits(this.selectedTicket.type);
    const sym      = this.getCurrencySymbol(event.currency);
    const isEB     = this.isEarlyBird(event, this.selectedTicket.type);
    const dispPrice = this.selectedTicket.price === 0 ? 'Free'
      : `${sym}${this.selectedTicket.price}${isEB ? ' (Early Bird)' : ''}`;

    document.getElementById('purchase-title').textContent = `${this.selectedTicket.type.toUpperCase()} — ${dispPrice}`;
    document.getElementById('ticket-types').innerHTML = `
      <div class="ticket-tier" style="cursor:default; border-color:var(--teal); background:var(--teal-glow); margin-bottom:1rem;">
        <div>
          <div class="ticket-tier-name">${this.selectedTicket.type.toUpperCase()}</div>
          <div class="ticket-tier-benefits">${benefits.join(' · ')}</div>
          ${isEB ? '<div style="color:var(--gold); font-size:0.75rem; margin-top:0.25rem;">Early Bird pricing applied</div>' : ''}
        </div>
        <div class="tier-price${this.selectedTicket.price === 0 ? ' free' : ''}">${dispPrice}</div>
      </div>`;

    const tt = this.parseTicketTypes(event.ticketTypes);
    document.getElementById('quantity-section').style.display = 'block';
    document.getElementById('ticket-quantity').max = tt[this.selectedTicket.type].capacity - (tt[this.selectedTicket.type].sold || 0);
    this.updateDiscountInfo();

    const qtyEl = document.getElementById('ticket-quantity');
    const grpEl = document.getElementById('group-booking-section');
    qtyEl.oninput = () => {
      grpEl.style.display = (parseInt(qtyEl.value) || 1) >= 5 ? 'grid' : 'none';
      this.updateDiscountInfo();
    };
    qtyEl.dispatchEvent(new Event('input'));

    const payEl    = document.getElementById('payment-section');
    const pmethGrid = document.querySelector('.pmeth-grid');
    const cardEl   = document.getElementById('card-element');
    const payBtn   = document.getElementById('pay-btn');
    payEl.style.display = 'block';
    if (this.selectedTicket.price === 0) {
      if (pmethGrid) pmethGrid.style.display = 'none';
      if (cardEl)    cardEl.style.display    = 'none';
      payBtn.textContent = 'Claim Free Ticket';
    } else {
      if (pmethGrid) pmethGrid.style.display = 'grid';
      if (cardEl)    cardEl.style.display    = this.selectedPaymentMethod === 'stripe' ? 'block' : 'none';
      payBtn.textContent = 'Complete Purchase';
    }
    this.openModal('purchase-modal');
  }

  updateDiscountInfo() {
    const qty  = parseInt(document.getElementById('ticket-quantity').value) || 1;
    const disc = this.getGroupDiscount(qty, this.selectedTicket.type);
    document.getElementById('discount-info').textContent =
      disc > 0 ? `Group discount: ${disc}% off for ${qty} tickets!` : '';
  }

  async processPayment() {
    const email  = document.getElementById('payer-email').value.trim();
    const phone  = document.getElementById('payer-phone').value.trim();
    const qty    = parseInt(document.getElementById('ticket-quantity').value) || 1;
    const remind = document.getElementById('set-reminder').checked;
    if (!email || !phone) return this.showError('Email and phone required');
    if (!this.validateEmail(email)) return this.showError('Invalid email format');
    if (!this.validatePhone(phone)) return this.showError('Invalid phone format');

    const statusEl = document.getElementById('payment-status');
    statusEl.style.display = 'block';
    statusEl.className     = 'status-msg loading';
    statusEl.textContent   = this.selectedTicket.price === 0 ? 'Claiming tickets…' : `Processing ${this.selectedPaymentMethod}…`;
    try {
      await this.delay(1800);
      const tickets = await this.fetchApi('/tickets/purchase', {
        method: 'POST',
        body: JSON.stringify({
          eventId: this.selectedTicket.eventId,
          ticketType: this.selectedTicket.type,
          quantity: qty,
          paymentDetails: { email, phone },
        }),
      });
      statusEl.className = 'status-msg success';
      statusEl.innerHTML = `<strong>✓ ${qty} ticket${qty > 1 ? 's' : ''} purchased successfully!</strong>`;

      const ev = await this.fetchApi(`/events/${this.selectedTicket.eventId}`);
      this.sendSMS(phone, `Your Glycr tickets for ${ev.title} are ready!`);
      if (remind) this.sendSMS(phone, `Reminder: ${ev.title} on ${new Date(ev.date).toLocaleDateString()}`);

      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, tickets[0].id, { width: 280 }, err => { if (err) console.error(err); });
      document.getElementById('ticket-canvas').innerHTML = '';
      document.getElementById('ticket-canvas').appendChild(canvas);
      document.getElementById('ticket-id').textContent = `Ticket ID: ${tickets[0].id}`;

      this.closeAllModals();
      this.openModal('ticket-modal');
      if (this.currentUser?.isOrganizer) {
        setTimeout(() => { this.closeAllModals(); this.showSection('dashboard'); this.loadDashboard(); }, 3000);
      } else if (this.currentUser) {
        this.loadProfile();
      }
    } catch (err) {
      statusEl.className = 'status-msg error';
      statusEl.textContent = err.message;
    }
  }

  validateTicket() { alert('✓ Ticket Validated!\n\nWelcome to the event!'); }

  // ─── Dashboard ────────────────────────────────────────────
  async loadDashboard() {
    if (!this.currentUser?.isOrganizer) return;
    const [myEvents, payouts] = await Promise.all([
      this.fetchApi(`/events?organizerId=${this.currentUser.id}`),
      this.fetchApi('/payouts'),
    ]);
    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const now = this.currentDate;

    let revenue = 0, sold = 0, live = 0;
    myEvents.forEach(e => {
      const tt = this.parseTicketTypes(e.ticketTypes);
      const s  = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0);
      sold    += s;
      revenue += Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
      if (e.isPublished && !e.isCancelled && new Date(e.date) > now) live++;
    });
    const totalPaid  = payouts.filter(p => p.status === 'completed').reduce((a, p) => a + p.amount, 0);
    const netPayout  = revenue * (1 - this.platformFeePercent / 100) - totalPaid;

    const hour     = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const greetEl  = document.getElementById('dash-greeting');
    if (greetEl) greetEl.textContent = `${greeting}, ${this.currentUser.name?.split(' ')[0] || 'Organizer'}`;

    const safeSet = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    safeSet('total-revenue',       `${sym}${revenue.toFixed(0)}`);
    safeSet('total-sold',          sold);
    safeSet('total-events',        myEvents.length);
    safeSet('events-live',         live);
    safeSet('pending-payouts',     `${sym}${Math.max(0, netPayout).toFixed(0)}`);
    safeSet('platform-fee-display', `${this.platformFeePercent}%`);

    await this._renderDashChart(); // <-- no parameter, async
  }

  async _renderDashChart() {
    try {
      const data = await this.fetchApi('/analytics/sales-trend?days=7');
      const ctx = document.getElementById('dash-sales-chart');
      if (!ctx) return;
      if (this.dashChart) this.dashChart.destroy();
      this.dashChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Tickets Sold',
            data: data.tickets,
            borderColor: '#2dd4bf',
            backgroundColor: 'rgba(45,212,191,0.08)',
            pointBackgroundColor: '#2dd4bf',
            pointRadius: 4,
            tension: 0.4,
            fill: true,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1e2a3a', titleColor: '#eaf2f8', bodyColor: '#7a96aa', borderColor: '#243347', borderWidth: 1 },
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#4a6278', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#192130' } },
            x: { ticks: { color: '#4a6278', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#192130' } },
          },
        },
      });
    } catch (err) {
      console.warn('Failed to load sales trend', err);
    }
  }

  // ─── Payout Page ──────────────────────────────────────────
  async loadPayoutPage() {
    if (!this.currentUser?.isOrganizer) return;
    let payouts = await this.fetchApi('/payouts');
    const start  = document.getElementById('payout-start-date')?.value;
    const end    = document.getElementById('payout-end-date')?.value;
    const status = document.getElementById('payout-status-filter')?.value || 'all';
    if (start)          payouts = payouts.filter(p => new Date(p.requestedAt) >= new Date(start));
    if (end)            payouts = payouts.filter(p => new Date(p.requestedAt) <= new Date(end + 'T23:59:59'));
    if (status !== 'all') payouts = payouts.filter(p => p.status === status);

    const sym         = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const totalPaid   = payouts.filter(p => p.status === 'completed').reduce((a, p) => a + p.amount, 0);
    const totalPend   = payouts.filter(p => p.status === 'pending').reduce((a, p) => a + p.amount, 0);

    const safeSet = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    safeSet('total-paid-out',      `${sym}${totalPaid.toFixed(2)}`);
    safeSet('total-pending-amount', `${sym}${totalPend.toFixed(2)}`);
    safeSet('total-payout-count',  payouts.length);

    const tbody = document.getElementById('payout-table-body');
    if (!payouts.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No payouts found for the selected period</td></tr>';
    } else {
      tbody.innerHTML = payouts.map(p => {
        const sc = p.status === 'completed' ? 'completed' : p.status === 'pending' ? 'pending' : 'failed';
        return `<tr>
          <td style="color:var(--teal); font-family:'JetBrains Mono',monospace; font-weight:600;">${sym}${p.amount}</td>
          <td>${(p.method || '').toUpperCase()}</td>
          <td><span class="status-pill ${sc}">${p.status}</span></td>
          <td>${new Date(p.requestedAt).toLocaleDateString('en-GB')}</td>
          <td>${p.completedAt ? new Date(p.completedAt).toLocaleDateString('en-GB') : '—'}</td>
        </tr>`;
      }).join('');
    }

    const csvBtn = document.getElementById('export-payouts-csv');
    const pdfBtn = document.getElementById('export-payouts-pdf');
    if (csvBtn) csvBtn.onclick = () => this.exportPayoutsToCSV(payouts);
    if (pdfBtn) pdfBtn.onclick = () => this.exportPayoutsToPDF(payouts);
  }

  // ─── My Events Page ───────────────────────────────────────
  async loadMyEventsPage() {
    if (!this.currentUser?.isOrganizer) return;
    let myEvents = await this.fetchApi(`/events?organizerId=${this.currentUser.id}`);
    const search = (document.getElementById('myevents-search')?.value || '').toLowerCase();
    const filter = document.getElementById('event-status-filter')?.value || 'all';
    const start  = document.getElementById('myevents-start')?.value;
    const end    = document.getElementById('myevents-end')?.value;
    const now    = this.currentDate;

    if (search) {
      myEvents = myEvents.filter(e =>
        e.title.toLowerCase().includes(search) ||
        (e.location || '').toLowerCase().includes(search) ||
        (e.venue || '').toLowerCase().includes(search)
      );
    }
    if (filter === 'upcoming')  myEvents = myEvents.filter(e => !e.isCancelled && new Date(e.date) > now);
    else if (filter === 'past') myEvents = myEvents.filter(e => !e.isCancelled && new Date(e.date) <= now);
    else if (filter === 'draft')myEvents = myEvents.filter(e => !e.isPublished && !e.isCancelled);
    else if (filter === 'cancelled') myEvents = myEvents.filter(e => e.isCancelled);
    if (start) myEvents = myEvents.filter(e => new Date(e.date) >= new Date(start));
    if (end)   myEvents = myEvents.filter(e => new Date(e.date) <= new Date(end + 'T23:59:59'));

    const container = document.getElementById('my-events-list');
    if (!myEvents.length) {
      container.innerHTML = '<div class="empty-state"><h3>No events found</h3><p>Try adjusting your search filters</p></div>';
      return;
    }

    container.innerHTML = myEvents.map(e => {
      const tt   = this.parseTicketTypes(e.ticketTypes);
      const esym = this.getCurrencySymbol(e.currency);
      const eRev = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
      const bars = Object.entries(tt).map(([type, t]) => {
        const s   = t.sold || 0;
        const pct = t.capacity ? (s / t.capacity * 100) : 0;
        return `<div class="ticket-bar-row">
          <span class="ticket-bar-label">${type}</span>
          <div class="ticket-bar-track"><div class="ticket-bar-fill" style="width:${pct}%"></div></div>
          <span class="ticket-bar-count">${s}/${t.capacity}</span>
        </div>`;
      }).join('');

      const statusBadge = e.isCancelled
        ? '<span style="color:var(--coral);">· Cancelled</span>'
        : !e.isPublished
          ? '<span style="color:var(--muted);">· Draft</span>'
          : '<span style="color:var(--mint);">· Published</span>';

      return `<div class="event-admin-card">
        <div class="event-admin-title">${e.title}</div>
        <div class="event-admin-meta">
          <i class="fas fa-calendar-alt"></i> ${new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          &nbsp;·&nbsp; <i class="fas fa-coins"></i> ${esym}${eRev.toFixed(0)}
          &nbsp;${statusBadge}
        </div>
        <div style="margin:0.5rem 0;">${bars}</div>
        <div class="event-admin-actions">
          <button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="edit-event" data-event-id="${e._id}"><i class="fas fa-edit"></i> Edit</button>
          ${!e.isCancelled ? `<button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem; color:var(--gold); border-color:rgba(251,191,36,0.3);" data-action="cancel-event" data-event-id="${e._id}"><i class="fas fa-ban"></i> Cancel</button>` : ''}
          <button class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="toggle-publish" data-event-id="${e._id}"><i class="fas fa-${e.isPublished ? 'eye-slash' : 'eye'}"></i> ${e.isPublished ? 'Unpublish' : 'Publish'}</button>
          <button class="btn btn-danger" style="font-size:0.75rem; padding:0.4rem 0.75rem;" data-action="delete-event" data-event-id="${e._id}"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Report Page ──────────────────────────────────────────
  async loadReportPage() {
    if (!this.currentUser?.isOrganizer) return;
    const [myEvents, payouts] = await Promise.all([
      this.fetchApi(`/events?organizerId=${this.currentUser.id}`),
      this.fetchApi('/payouts'),
    ]);
    const sym    = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const fee    = this.platformFeePercent;
    let tickets  = 0, gross = 0;
    myEvents.forEach(e => {
      const tt = this.parseTicketTypes(e.ticketTypes);
      tickets  += Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0);
      gross    += Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
    });
    const net = gross * (1 - fee / 100);

    const safeSet = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    safeSet('report-total-events',  myEvents.length);
    safeSet('report-total-tickets', tickets);
    safeSet('report-total-revenue', `${sym}${gross.toFixed(2)}`);
    safeSet('report-net-revenue',   `${sym}${net.toFixed(2)}`);

    // Top events table
    const sorted = [...myEvents].sort((a, b) => {
      const ra = Object.values(this.parseTicketTypes(a.ticketTypes)).reduce((s, t) => s + ((t.sold || 0) * t.price), 0);
      const rb = Object.values(this.parseTicketTypes(b.ticketTypes)).reduce((s, t) => s + ((t.sold || 0) * t.price), 0);
      return rb - ra;
    });
    const tbody = document.getElementById('report-events-tbody');
    if (tbody) {
      tbody.innerHTML = sorted.slice(0, 10).map(e => {
        const tt   = this.parseTicketTypes(e.ticketTypes);
        const sold = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0);
        const rev  = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
        const badge = e.isCancelled
          ? '<span class="status-pill failed">Cancelled</span>'
          : e.isPublished
            ? '<span class="status-pill completed">Published</span>'
            : '<span class="status-pill pending">Draft</span>';
        return `<tr>
          <td style="font-weight:600; color:var(--bright);">${e.title}</td>
          <td>${new Date(e.date).toLocaleDateString('en-GB')}</td>
          <td>${sold}</td>
          <td style="color:var(--teal); font-family:'JetBrains Mono',monospace;">${sym}${rev.toFixed(2)}</td>
          <td>${badge}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" class="table-empty">No events yet</td></tr>';
    }

    // Charts

    // Fetch real sales trend
    let salesData = { labels: [], tickets: [], revenue: [] };
    try {
      salesData = await this.fetchApi('/analytics/sales-trend?days=7');
    } catch (err) {
      console.warn('Could not load sales trend', err);
    }

// Revenue chart (bar)
    const rCtx = document.getElementById('report-revenue-chart');
    if (rCtx) {
      if (this.reportRevenueChart) this.reportRevenueChart.destroy();
      this.reportRevenueChart = new Chart(rCtx, {
        type: 'bar',
        data: {
          labels: salesData.labels,
          datasets: [{
            label: 'Revenue (₵)',
            data: salesData.revenue,
            backgroundColor: 'rgba(45,212,191,0.3)',
            borderColor: '#2dd4bf',
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#4a6278', font: { size: 10 } }, grid: { color: '#192130' } },
            x: { ticks: { color: '#4a6278', font: { size: 10 } }, grid: { color: '#192130' } },
          },
        },
      });
    }



    const typeTotals = {};
    myEvents.forEach(e => {
      const tt = this.parseTicketTypes(e.ticketTypes);
      Object.entries(tt).forEach(([type, t]) => {
        typeTotals[type] = (typeTotals[type] || 0) + (t.sold || 0);
      });
    });
    const tCtx = document.getElementById('report-ticket-chart');
    if (tCtx && Object.keys(typeTotals).length) {
      if (this.reportTicketChart) this.reportTicketChart.destroy();
      this.reportTicketChart = new Chart(tCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(typeTotals),
          datasets: [{
            data: Object.values(typeTotals),
            backgroundColor: ['rgba(45,212,191,0.75)', 'rgba(110,231,183,0.75)', 'rgba(251,191,36,0.75)', 'rgba(255,107,107,0.75)', 'rgba(125,211,252,0.75)'],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#7a96aa', font: { family: 'JetBrains Mono', size: 10 }, padding: 12 } },
          },
        },
      });
    }

    // Wire export buttons with date range filtering
    const filterByDate = (arr, field) => {
      const s = document.getElementById('report-start-date')?.value;
      const e = document.getElementById('report-end-date')?.value;
      let out = [...arr];
      if (s) out = out.filter(x => new Date(x[field]) >= new Date(s));
      if (e) out = out.filter(x => new Date(x[field]) <= new Date(e + 'T23:59:59'));
      return out;
    };
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on('export-events-csv',          () => this.exportEventsToCSV(filterByDate(myEvents, 'date')));
    on('export-payouts-csv-report',  () => this.exportPayoutsToCSV(filterByDate(payouts, 'requestedAt')));
    on('export-events-pdf',          () => this.exportEventsToPDF(filterByDate(myEvents, 'date')));
    on('export-payouts-pdf',         () => this.exportPayoutsToPDF(filterByDate(payouts, 'requestedAt')));
  }

  // ─── Event form ───────────────────────────────────────────
  showEventForm(event = null) {
    this.editingEvent = event;
    document.getElementById('event-form').reset();
    document.getElementById('form-title').textContent = event ? 'Edit Event' : 'Create Event';
    // Reset Maps
    ['event-lat', 'event-lng', 'event-address'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const searchInp = document.getElementById('maps-search-input');
    if (searchInp) searchInp.value = '';
    const selInfo = document.getElementById('maps-selected-info');
    if (selInfo) selInfo.style.display = 'none';
    const mc = document.getElementById('maps-container');
    if (mc) mc.classList.remove('active');

    const defaultCurrency = this.currentUser?.currency || 'GHC';
    if (event) {
      document.getElementById('event-title').value     = event.title;
      document.getElementById('event-desc').value      = event.description;
      document.getElementById('event-date').value      = event.date.slice(0, 16);
      document.getElementById('event-venue').value     = event.venue;
      document.getElementById('event-location').value  = event.location || '';
      document.getElementById('event-category').value  = event.category;
      document.getElementById('event-currency').value  = event.currency;
      document.getElementById('organizer-email').value = event.organizerEmail;
      document.getElementById('organizer-phone').value = event.organizerPhone;
      if (event.lat) {
        document.getElementById('event-lat').value     = event.lat;
        document.getElementById('event-lng').value     = event.lng;
        document.getElementById('event-address').value = event.address || '';
        if (event.address && selInfo) {
          document.getElementById('maps-selected-address').textContent = event.address;
          selInfo.style.display = 'flex';
        }
      }
      const ttypes = this.parseTicketTypes(event.ticketTypes);
      document.getElementById('ticket-types-form').innerHTML = '';
      Object.entries(ttypes).forEach(([type, data]) =>
        this.addTicketTypeInput(type, data.price, data.capacity, data.earlyBirdPrice || '', data.earlyBirdEnd || '', data.groupDiscount || 10)
      );
    } else {
      document.getElementById('ticket-types-form').innerHTML = '';
      this.addTicketTypeInput('free',    0,   100, '',  '', 10);
      this.addTicketTypeInput('regular', 50,  200, 40,  '', 10);
      this.addTicketTypeInput('vip',     150, 50,  120, '', 10);
      document.getElementById('event-currency').value  = defaultCurrency;
      document.getElementById('organizer-email').value = this.currentUser?.email || '';
      document.getElementById('organizer-phone').value = this.currentUser?.phone || '';
    }
    this.openModal('event-form-modal');
    if (this.mapsLoaded) this.initMaps();
  }

  addTicketTypeInput(name = '', price = '', capacity = '', earlyBirdPrice = '', earlyBirdEnd = '', groupDiscount = '10') {
    const container = document.getElementById('ticket-types-form');
    const div = document.createElement('div');
    div.className = 'ticket-type-row ticket-type';
    div.innerHTML = `
      <input type="text"          class="input type-name"       placeholder="Type (e.g. Regular)" value="${name}">
      <input type="number"        class="input type-price"       placeholder="Price"    min="0" value="${price}">
      <input type="number"        class="input type-capacity"    placeholder="Capacity" min="1" value="${capacity}">
      <input type="number"        class="input type-early-price" placeholder="Early ₵"  min="0" value="${earlyBirdPrice}">
      <input type="datetime-local" class="input type-early-end"                                  value="${earlyBirdEnd}">
      <input type="number"        class="input type-group-disc"  placeholder="Disc %"   min="0" max="50" value="${groupDiscount}">
      <button type="button" class="remove-ticket">✕</button>`;
    container.appendChild(div);
  }

  async saveEvent() {
    const title    = document.getElementById('event-title').value.trim();
    const orgEmail = document.getElementById('organizer-email').value.trim();
    const orgPhone = document.getElementById('organizer-phone').value.trim();
    if (!title) return this.showError('Event title required');
    if (!orgEmail || !orgPhone) return this.showError('Organizer contact required');
    if (!this.validateEmail(orgEmail)) return this.showError('Invalid organizer email');
    if (!this.validatePhone(orgPhone)) return this.showError('Invalid organizer phone');

    const currency     = document.getElementById('event-currency').value;
    const ticketInputs = document.querySelectorAll('.ticket-type');
    const originalTT   = this.editingEvent ? this.parseTicketTypes(this.editingEvent.ticketTypes) : null;
    const ticketTypes  = {};

    ticketInputs.forEach(inp => {
      const type  = inp.querySelector('.type-name').value.trim().toLowerCase();
      const price = parseFloat(inp.querySelector('.type-price').value);
      const cap   = parseInt(inp.querySelector('.type-capacity').value);
      const ebP   = parseFloat(inp.querySelector('.type-early-price').value) || price;
      const ebEnd = inp.querySelector('.type-early-end').value;
      const gDisc = parseInt(inp.querySelector('.type-group-disc').value) || 10;
      if (type && !isNaN(price) && !isNaN(cap)) {
        const sold = (originalTT && originalTT[type]) ? (originalTT[type].sold || 0) : 0;
        const tkt  = { price, capacity: cap, sold, earlyBirdPrice: ebP, groupDiscount: gDisc };
        if (ebEnd) tkt.earlyBirdEnd = ebEnd;
        ticketTypes[type] = tkt;
      }
    });
    if (!Object.keys(ticketTypes).length) return this.showError('Add at least one ticket type');

    const formData = new FormData();
    formData.append('title',          title);
    formData.append('description',    document.getElementById('event-desc').value);
    formData.append('date',           document.getElementById('event-date').value);
    formData.append('venue',          document.getElementById('event-venue').value);
    formData.append('location',       document.getElementById('event-location').value);
    formData.append('category',       document.getElementById('event-category').value);
    formData.append('currency',       currency);
    formData.append('organizerEmail', orgEmail);
    formData.append('organizerPhone', orgPhone);
    formData.append('ticketTypes',    JSON.stringify(ticketTypes));

    const lat  = document.getElementById('event-lat')?.value;
    const lng  = document.getElementById('event-lng')?.value;
    const addr = document.getElementById('event-address')?.value;
    if (lat)  formData.append('lat',     lat);
    if (lng)  formData.append('lng',     lng);
    if (addr) formData.append('address', addr);

    const imgFile = document.getElementById('event-image').files[0];
    if (imgFile) formData.append('image', imgFile);

    try {
      if (this.editingEvent) {
        await this.fetchApi(`/events/${this.editingEvent._id}`, { method: 'PUT', body: formData });
      } else {
        await this.fetchApi('/events', { method: 'POST', body: formData });
      }
      this.closeAllModals();
      this.showSection('dashboard');
      this.loadDashboard();
      this.renderEvents();
    } catch (err) { this.showError(err.message); }
  }

  // ─── Google Maps ──────────────────────────────────────────
  initMaps() {
    if (typeof google === 'undefined' || !google.maps) return;
    this.mapsLoaded = true;
    const mapDiv = document.getElementById('maps-map');
    if (!mapDiv) return;

    const defaultCenter = { lat: 5.6037, lng: -0.1870 }; // Accra

    this.mapsInstance = new google.maps.Map(mapDiv, {
      center: defaultCenter, zoom: 12,
      styles: [
        { elementType: 'geometry',              stylers: [{ color: '#192130' }] },
        { elementType: 'labels.text.fill',      stylers: [{ color: '#7a96aa' }] },
        { elementType: 'labels.text.stroke',    stylers: [{ color: '#0d1117' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#243347' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      ],
    });

    const searchInput = document.getElementById('maps-search-input');
    if (searchInput && google.maps.places) {
      this.mapsAutocomplete = new google.maps.places.Autocomplete(searchInput, {
        componentRestrictions: { country: 'gh' },
        fields: ['geometry', 'formatted_address', 'name'],
      });
      this.mapsAutocomplete.addListener('place_changed', () => {
        const place = this.mapsAutocomplete.getPlace();
        if (!place.geometry) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        this.setMapLocation(lat, lng, place.formatted_address || place.name);
        document.getElementById('maps-container')?.classList.add('active');
      });
    }

    this.mapsInstance.addListener('click', e => {
      const lat = e.latLng.lat(), lng = e.latLng.lng();
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        const addr = (status === 'OK' && results[0])
          ? results[0].formatted_address
          : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        this.setMapLocation(lat, lng, addr);
      });
    });

    const searchBtn = document.getElementById('maps-search-btn');
    if (searchBtn) {
      searchBtn.onclick = () => {
        const q = searchInput?.value.trim();
        if (!q) return;
        new google.maps.Geocoder().geocode({ address: q + ', Ghana' }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            this.setMapLocation(loc.lat(), loc.lng(), results[0].formatted_address);
            document.getElementById('maps-container')?.classList.add('active');
          }
        });
      };
    }

    const clearBtn = document.getElementById('maps-clear-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        ['event-lat', 'event-lng', 'event-address'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
        if (searchInput) searchInput.value = '';
        const selInfo = document.getElementById('maps-selected-info');
        if (selInfo) selInfo.style.display = 'none';
        document.getElementById('maps-container')?.classList.remove('active');
        if (this.mapsMarker) { this.mapsMarker.setMap(null); this.mapsMarker = null; }
      };
    }

    // If editing event with existing coords, show marker
    const existLat = parseFloat(document.getElementById('event-lat')?.value);
    const existLng = parseFloat(document.getElementById('event-lng')?.value);
    if (existLat && existLng) {
      document.getElementById('maps-container')?.classList.add('active');
      this.mapsInstance.setCenter({ lat: existLat, lng: existLng });
      this.mapsInstance.setZoom(15);
      this.mapsMarker = new google.maps.Marker({
        position: { lat: existLat, lng: existLng },
        map: this.mapsInstance,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2dd4bf', fillOpacity: 1, strokeColor: '#0d1117', strokeWeight: 2 },
      });
    }
  }

  setMapLocation(lat, lng, address) {
    document.getElementById('event-lat').value     = lat;
    document.getElementById('event-lng').value     = lng;
    document.getElementById('event-address').value = address;
    const addrEl = document.getElementById('maps-selected-address');
    const selInfo = document.getElementById('maps-selected-info');
    if (addrEl)  addrEl.textContent   = address;
    if (selInfo) selInfo.style.display = 'flex';

    if (this.mapsMarker) this.mapsMarker.setMap(null);
    this.mapsMarker = new google.maps.Marker({
      position: { lat, lng },
      map: this.mapsInstance,
      title: address,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8, fillColor: '#2dd4bf', fillOpacity: 1,
        strokeColor: '#0d1117', strokeWeight: 2,
      },
    });
    this.mapsInstance.panTo({ lat, lng });
    this.mapsInstance.setZoom(15);
  }

  // Called by Maps script callback
  initMapsCallback() {
    this.mapsLoaded = true;
    // Only init if event form is currently open
    if (document.getElementById('event-form-modal')?.classList.contains('show')) {
      this.initMaps();
    }
  }

  // ─── Event actions ────────────────────────────────────────
  async togglePublish(id) {
    try {
      await this.fetchApi(`/events/${id}/publish`, { method: 'PATCH' });
      this.loadDashboard();
      this.loadMyEventsPage();
      this.renderEvents();
    } catch (err) { this.showError(err.message); }
  }

  showCancelModal(id) {
    const ev = this.events.find(e => e._id === id);
    if (!ev) return;
    document.getElementById('cancel-title').textContent = `Cancel ${ev.title}?`;
    document.getElementById('cancel-reason').innerHTML = '<p>This will notify all ticket holders.</p><p>Are you sure you want to cancel?</p>';
    this.currentEventId = id;
    this.openModal('cancel-event-modal');
  }

  async cancelEvent() {
    try {
      await this.fetchApi(`/events/${this.currentEventId}/cancel`, { method: 'PATCH' });
      this.closeAllModals();
      this.loadDashboard();
      this.loadMyEventsPage();
      this.renderEvents();
    } catch (err) { this.showError(err.message); }
  }

  async deleteEvent(id) {
    if (!confirm('Delete this event and all its tickets? This cannot be undone.')) return;
    try {
      await this.fetchApi(`/events/${id}`, { method: 'DELETE' });
      this.loadDashboard();
      this.loadMyEventsPage();
      this.renderEvents();
    } catch (err) { this.showError(err.message); }
  }

  exportReport(eventId) {
    const ev = this.events.find(e => e._id === eventId);
    if (!ev) return this.showError('Event not found');
    const eventTickets = this.tickets.filter(t => t.eventId === eventId);
    let csv = 'Ticket ID,Type,Price,Buyer Email,Phone,Purchase Date\n';
    eventTickets.forEach(t => {
      csv += `"${t.id}","${t.ticketType}",${t.price},"${t.userEmail}","${t.userPhone}","${new Date(t.purchasedAt).toLocaleString()}"\n`;
    });
    this._dlBlob(csv, `${ev.title.replace(/\s+/g, '_')}_tickets.csv`, 'text/csv');
  }

  // ─── Payout request ───────────────────────────────────────
  async showPayoutModal() {
    if (!this.currentUser?.isOrganizer) return this.showError('Access denied');
    const netAvail = await this.getNetAvailablePayout();
    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    document.getElementById('payout-amount').max         = netAvail;
    document.getElementById('payout-amount').placeholder = `Max: ${sym}${netAvail.toFixed(2)}`;
    document.getElementById('payout-title').textContent  = `Request Payout — Available: ${sym}${netAvail.toFixed(2)}`;
    document.getElementById('payout-form').reset();
    document.getElementById('payout-status').style.display = 'none';
    this.openModal('payout-modal');
  }

  async getNetAvailablePayout() {
    const [myPayouts, myEvents] = await Promise.all([
      this.fetchApi('/payouts'),
      this.fetchApi(`/events?organizerId=${this.currentUser.id}`),
    ]);
    const totalPaid = myPayouts.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    const gross = myEvents.reduce((s, e) => {
      const tt = this.parseTicketTypes(e.ticketTypes);
      return s + Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
    }, 0);
    const net = gross * (1 - this.platformFeePercent / 100);
    return Math.max(0, net - totalPaid);
  }

  togglePayoutDetails(method) {
    document.getElementById('bank-details').style.display = method === 'bank' ? 'grid' : 'none';
    document.getElementById('momo-details').style.display = method === 'momo' ? 'block' : 'none';
  }

  async requestPayout() {
    const amount = parseFloat(document.getElementById('payout-amount').value);
    const method = document.getElementById('payout-method').value;
    const email  = document.getElementById('payout-email').value.trim();
    const notes  = document.getElementById('payout-notes').value.trim();
    if (!amount || !method || !email) return this.showPayoutError('Please fill in all required fields');
    if (!this.validateEmail(email)) return this.showPayoutError('Invalid email format');

    let bankDetails = null, momoDetails = null;
    if (method === 'bank') {
      const bn = document.getElementById('bank-name').value.trim();
      const bhn = document.getElementById('branch-name').value.trim();
      const an = document.getElementById('account-number').value.trim();
      const nm = document.getElementById('account-name').value.trim();
      if (!bn || !bhn|| !an || !nm) return this.showPayoutError('All bank details are required');
      bankDetails = { bankName: bn, branchName: bn, accountNumber: an, accountName: nm };
    } else if (method === 'momo') {
      const ph = document.getElementById('momo-number').value.trim();
      if (!this.validatePhone(ph)) return this.showPayoutError('Invalid MoMo number');
      momoDetails = { phone: ph };
    }

    const body = { amount, method, email, notes };
    if (bankDetails) body.bankDetails = bankDetails;
    if (momoDetails) body.momoDetails = momoDetails;

    try {
      await this.fetchApi('/payouts', { method: 'POST', body: JSON.stringify(body) });
      const s = document.getElementById('payout-status');
      s.style.display = 'block'; s.className = 'status-msg success';
      s.innerHTML = '<strong>✓ Payout request submitted!</strong>';
      setTimeout(() => {
        this.closeAllModals();
        this.loadDashboard();
        const pp = document.getElementById('payout-page');
        if (pp && pp.style.display !== 'none') this.loadPayoutPage();
      }, 2000);
    } catch (err) { this.showPayoutError(err.message); }
  }

  showPayoutError(msg) {
    const s = document.getElementById('payout-status');
    s.style.display = 'block'; s.className = 'status-msg error'; s.textContent = msg;
  }

  // ─── Waitlist (organiser view) ────────────────────────────
  async viewWaitlist(eventId, type) {
    if (!this.currentUser?.isOrganizer) return;
    try {
      const [entries, ev] = await Promise.all([
        this.fetchApi(`/events/${eventId}/waitlists/${type}`),
        this.fetchApi(`/events/${eventId}`),
      ]);
      document.getElementById('waitlist-view-title').textContent = `${type.toUpperCase()} Waitlist — ${ev.title}`;
      document.getElementById('waitlist-entries').innerHTML = entries.map(e =>
        `<div class="waitlist-entry">
          <p><strong>${e.name}</strong></p>
          <p>${e.email} · ${e.phone}</p>
          <p style="color:var(--muted); font-size:0.73rem;">${new Date(e.joinedAt).toLocaleString()}</p>
        </div>`
      ).join('') || '<p style="text-align:center; color:var(--muted); padding:2rem;">No entries</p>';
      document.getElementById('notify-waitlist-btn').onclick = () => this.notifyWaitlist(eventId, type);
      this.openModal('waitlist-view-modal');
    } catch (err) { this.showError(err.message); }
  }

  async notifyWaitlist(eventId, type) {
    try {
      await this.fetchApi(`/events/${eventId}/waitlists/notify`, { method: 'POST' });
      alert('Waitlist notified!');
      this.closeAllModals();
    } catch (err) { this.showError(err.message); }
  }

  // ─── Favourites ───────────────────────────────────────────
  async toggleFavorite(eventId) {
    if (!this.currentUser) return;
    const uid = this.currentUser.id;
    this.favorites[uid] = this.favorites[uid] || [];
    const idx    = this.favorites[uid].indexOf(eventId);
    const action = idx > -1 ? 'remove' : 'add';
    if (idx > -1) this.favorites[uid].splice(idx, 1);
    else          this.favorites[uid].push(eventId);
    this.saveToStorage('glycr_favorites', this.favorites);
    try {
      await this.fetchApi('/users/favorites', { method: 'POST', body: JSON.stringify({ eventId, action }) });
    } catch {}
    this.renderEvents();
    const profileEl = document.getElementById('profile');
    if (profileEl && profileEl.style.display !== 'none') this.loadProfile();
  }

  isFavorited(event) {
    if (!this.currentUser) return false;
    return (this.favorites[this.currentUser.id] || []).includes(event._id);
  }

  clearFilters() {
    document.getElementById('search-input').value    = '';
    document.getElementById('category-filter').value = '';
    document.getElementById('location-filter').value  = '';
    this.renderEvents();
  }

  // ─── Exports ──────────────────────────────────────────────
  _dlBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  exportEventsToCSV(events) {
    const fee = this.platformFeePercent;
    let csv = 'Title,Date,Venue,Location,Category,Status,Tickets Sold,Gross Revenue,Net Revenue\n';
    events.forEach(e => {
      const tt    = this.parseTicketTypes(e.ticketTypes);
      const sold  = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0);
      const gross = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
      const net   = gross * (1 - fee / 100);
      const st    = e.isCancelled ? 'Cancelled' : e.isPublished ? 'Published' : 'Draft';
      csv += `"${e.title}","${new Date(e.date).toLocaleString()}","${e.venue}","${e.location || ''}","${e.category}","${st}",${sold},${gross.toFixed(2)},${net.toFixed(2)}\n`;
    });
    this._dlBlob(csv, `events_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  }

  exportPayoutsToCSV(payouts) {
    let csv = 'Amount,Method,Status,Requested At,Completed At\n';
    payouts.forEach(p => {
      csv += `${p.amount},${p.method},${p.status},"${p.requestedAt}","${p.completedAt || ''}"\n`;
    });
    this._dlBlob(csv, `payouts_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  }

  exportEventsToPDF(events) {
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF();
    const fee  = this.platformFeePercent;
    const sym  = this.getCurrencySymbol(this.currentUser?.currency || 'GHC');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('My Events Report', 14, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Platform Fee: ${fee}% · Generated: ${new Date().toLocaleString()}`, 14, 24);
    const rows = events.map(e => {
      const tt    = this.parseTicketTypes(e.ticketTypes);
      const sold  = Object.values(tt).reduce((a, t) => a + (t.sold || 0), 0);
      const gross = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
      const net   = gross * (1 - fee / 100);
      const st    = e.isCancelled ? 'Cancelled' : e.isPublished ? 'Published' : 'Draft';
      return [e.title, new Date(e.date).toLocaleDateString(), e.venue, sold, `${sym}${gross.toFixed(2)}`, `${sym}${net.toFixed(2)}`, st];
    });
    doc.autoTable({
      head: [['Title', 'Date', 'Venue', 'Sold', 'Gross', 'Net', 'Status']],
      body: rows, startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [19, 26, 35], textColor: [204, 217, 227] },
    });
    doc.save(`events_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  exportPayoutsToPDF(payouts) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const sym = this.getCurrencySymbol(this.currentUser?.currency || 'GHC');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Payout History', 14, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Platform Fee: ${this.platformFeePercent}% · Generated: ${new Date().toLocaleString()}`, 14, 24);
    const rows = payouts.map(p => [
      `${sym}${p.amount}`, p.method, p.status,
      new Date(p.requestedAt).toLocaleDateString(),
      p.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—',
    ]);
    doc.autoTable({
      head: [['Amount', 'Method', 'Status', 'Requested', 'Completed']],
      body: rows, startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [19, 26, 35], textColor: [204, 217, 227] },
    });
    doc.save(`payouts_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  shareEvent() {
    const ev = this.events.find(e => e._id === this.currentEventId);
    if (!ev) return;
    const url = `${window.location.href.split('#')[0]}#event-${ev._id}`;
    if (navigator.share) navigator.share({ title: ev.title, text: `Check out ${ev.title} on Glycr!`, url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => alert('Event link copied to clipboard!'));
  }

  // ─── Password / Auth helpers ──────────────────────────────
  showForgotPasswordModal() {
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-status').style.display = 'none';
    this.openModal('forgot-password-modal');
  }

  async handleForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email || !this.validateEmail(email)) return this.showError('Enter a valid email');
    const s = document.getElementById('forgot-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Sending reset link…';
    try {
      await this.fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      s.className = 'status-msg success'; s.textContent = 'If the email exists, a reset link has been sent.';
      setTimeout(() => this.closeAllModals(), 3000);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message; }
  }

  checkResetToken() {
    const t = new URLSearchParams(window.location.search).get('reset_token');
    if (t) {
      localStorage.setItem('reset_token', t);
      window.history.replaceState({}, '', window.location.pathname);
      this.openModal('reset-password-modal');
    }
  }

  async handleResetPassword() {
    const np    = document.getElementById('new-password').value;
    const cp    = document.getElementById('confirm-new-password').value;
    const token = localStorage.getItem('reset_token');
    if (!token) return this.showError('Invalid reset link');
    if (!np || !cp) return this.showError('Fill in both fields');
    if (np !== cp) return this.showError('Passwords do not match');
    if (this.checkPasswordStrength(np).width === '0%') return this.showError('Password is too weak');
    const s = document.getElementById('reset-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Resetting…';
    try {
      await this.fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: np }) });
      s.className = 'status-msg success'; s.textContent = 'Password reset! You can now log in.';
      localStorage.removeItem('reset_token');
      setTimeout(() => { this.closeAllModals(); this.openModal('auth-modal'); }, 2000);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message; }
  }

  showSettingsModal() {
    ['current-password', 'new-password-settings', 'confirm-new-password-settings'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('settings-status').style.display = 'none';
    this.openModal('settings-modal');
  }

  async saveSettings(e) {
    e.preventDefault();
    const cur = document.getElementById('current-password').value;
    const np  = document.getElementById('new-password-settings').value;
    const cp  = document.getElementById('confirm-new-password-settings').value;
    if (!cur || !np || !cp) return this.showSettingsError('Fill in all password fields');
    if (np !== cp) return this.showSettingsError('Passwords do not match');
    if (this.checkPasswordStrength(np).width === '0%') return this.showSettingsError('Password is too weak');
    const s = document.getElementById('settings-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Updating…';
    try {
      await this.fetchApi('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: cur, newPassword: np }) });
      localStorage.setItem('notify_email', document.getElementById('notify-email').checked);
      localStorage.setItem('notify_sms',   document.getElementById('notify-sms').checked);
      s.className = 'status-msg success'; s.textContent = 'Settings saved!';
      setTimeout(() => this.closeAllModals(), 2000);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message; }
  }

  showSettingsError(msg) {
    const s = document.getElementById('settings-status');
    s.style.display = 'block'; s.className = 'status-msg error'; s.textContent = msg;
  }

  // ─── Modal helpers ────────────────────────────────────────
  openModal(modalId) {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    const m = document.getElementById(modalId);
    if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; }
  }

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    document.body.style.overflow = '';
  }

  showError(message) {
    const candidates = ['payment-status', 'waitlist-status', 'payout-status'];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el && el.closest('.modal.show')) {
        el.style.display = 'block'; el.className = 'status-msg error'; el.textContent = message;
        return;
      }
    }
    alert(message);
  }

  // ─── Event binding ────────────────────────────────────────
  on(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }

  bindEvents() {
    this.on('home-link',      'click', () => this.showSection('home'));
    this.on('dashboard-link', 'click', () => this.showSection('dashboard'));
    this.on('payout-link',    'click', () => this.showSection('payout-page'));
    this.on('myevents-link',  'click', () => this.showSection('myevents-page'));
    this.on('report-link',    'click', () => this.showSection('report-page'));
    this.on('login-link',     'click', () => this.openModal('auth-modal'));

    this.on('search-input',     'input',  () => this.renderEvents());
    this.on('category-filter',  'change', () => this.renderEvents());
    this.on('location-filter',  'change', () => this.renderEvents());
    this.on('clearFilters',     'click',  () => this.clearFilters());

    this.on('auth-form',   'submit', e => { e.preventDefault(); this.handleAuth(); });
    this.on('toggle-auth', 'click',  e => { if (e.target.tagName === 'A') { e.preventDefault(); this.toggleAuthMode(); } });

    this.on('edit-profile-btn', 'click',  () => this.openModal('profile-edit-modal'));
    this.on('profile-form',     'submit', e => { e.preventDefault(); this.saveProfile(); });

    this.on('create-event-btn',      'click', () => this.showEventForm());
    this.on('create-event-btn-hero', 'click', () => this.showEventForm());
    this.on('create-event-page-btn', 'click', () => this.showEventForm());
    this.on('event-form',            'submit', e => { e.preventDefault(); this.saveEvent(); });
    this.on('add-ticket-type',       'click',  () => this.addTicketTypeInput());

    this.on('buy-ticket-btn', 'click', () => this.showPurchaseFlow());
    this.on('pay-btn',        'click', () => this.processPayment());
    this.on('validate-ticket','click', () => this.validateTicket());
    this.on('share-btn',      'click', () => this.shareEvent());

    this.on('request-payout-btn',      'click', () => this.showPayoutModal());
    this.on('request-payout-page-btn', 'click', () => this.showPayoutModal());
    this.on('payout-form', 'submit', e => { e.preventDefault(); this.requestPayout(); });
    document.getElementById('payout-method')?.addEventListener('change', e => this.togglePayoutDetails(e.target.value));

    this.on('waitlist-form', 'submit', e => { e.preventDefault(); this.joinWaitlist(); });

    this.on('confirm-cancel',     'click', () => this.cancelEvent());
    this.on('dismiss-cancel',     'click', () => this.closeAllModals());
    this.on('notify-waitlist-btn','click', () => this.notifyWaitlist(this.currentEventId, this.selectedTicketType));

    this.on('forgot-password-link',   'click', e => { e.preventDefault(); this.closeAllModals(); this.showForgotPasswordModal(); });
    this.on('forgot-password-form',   'submit', e => { e.preventDefault(); this.handleForgotPassword(); });
    this.on('reset-password-form',    'submit', e => { e.preventDefault(); this.handleResetPassword(); });
    this.on('settings-form',          'submit', e => this.saveSettings(e));

    // Logo
    document.getElementById('logo-home')?.addEventListener('click', e => {
      e.preventDefault(); this.showSection('home');
    });

    // Password strength indicators
    const bindStrength = (inputId, barId, textId) => {
      const inp = document.getElementById(inputId);
      if (!inp) return;
      inp.addEventListener('input', () => {
        const s   = this.checkPasswordStrength(inp.value);
        const bar = document.getElementById(barId);
        const txt = document.getElementById(textId);
        if (bar) { bar.style.width = s.width; bar.style.backgroundColor = s.color; }
        if (txt) { txt.textContent = s.text; txt.style.color = s.color; }
      });
    };
    bindStrength('password',             'strength-bar',          'strength-text');
    bindStrength('new-password',         'reset-strength-bar',    'reset-strength-text');
    bindStrength('new-password-settings','settings-strength-bar', 'settings-strength-text');

    // Payment method buttons
    document.querySelectorAll('.pmeth-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pmeth-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPaymentMethod = btn.dataset.method;
        const ce = document.getElementById('card-element');
        if (ce) ce.style.display = btn.dataset.method === 'stripe' ? 'block' : 'none';
      });
    });

    // Modal close buttons and backdrops
    document.querySelectorAll('.modal-close').forEach(btn =>
      btn.addEventListener('click', () => this.closeAllModals())
    );
    document.querySelectorAll('.modal-backdrop').forEach(bd =>
      bd.addEventListener('click', () => this.closeAllModals())
    );

    // Delegated clicks
    document.addEventListener('click', async e => {
      const t = e.target.closest('[data-action]');
      if (t) {
        const action  = t.dataset.action;
        const eventId = t.dataset.eventId;
        if (action === 'edit-event') {
          const ev = await this.fetchApi(`/events/${eventId}`);
          this.showEventForm(ev);
        } else if (action === 'cancel-event')    { this.showCancelModal(eventId); }
        else if (action === 'toggle-publish')    { this.togglePublish(eventId); }
        else if (action === 'export-report')     { this.exportReport(eventId); }
        else if (action === 'delete-event')      { this.deleteEvent(eventId); }
        else if (action === 'view-waitlist')     { this.viewWaitlist(eventId, t.dataset.ticketType); }
      }

      // Remove ticket type row
      if (e.target.classList.contains('remove-ticket')) {
        e.target.closest('.ticket-type')?.remove();
      }

      // Favourite toggle
      const favBtn = e.target.closest('.fav-btn');
      if (favBtn) {
        e.stopPropagation();
        this.toggleFavorite(favBtn.dataset.eventId);
      }
    });

    // Profile dropdown
    const trigger  = document.getElementById('profile-trigger');
    const dropMenu = document.getElementById('dropdown-menu');
    if (trigger && dropMenu) {
      trigger.addEventListener('click', e => { e.stopPropagation(); dropMenu.classList.toggle('show'); });
      document.addEventListener('click', e => {
        if (!trigger.contains(e.target) && !dropMenu.contains(e.target))
          dropMenu.classList.remove('show');
      });
    }
    this.on('dropdown-profile-page',  'click', e => { e.preventDefault(); dropMenu.classList.remove('show'); this.showSection('profile'); });
    this.on('dropdown-edit-profile',  'click', e => { e.preventDefault(); dropMenu.classList.remove('show'); this.openModal('profile-edit-modal'); });
    this.on('dropdown-settings',      'click', e => { e.preventDefault(); dropMenu.classList.remove('show'); this.showSettingsModal(); });
    this.on('dropdown-logout',        'click', e => { e.preventDefault(); dropMenu.classList.remove('show'); this.logout(); });

    // My Events page filter button
    this.on('event-status-filter',  'change', () => this.loadMyEventsPage());
    this.on('payout-status-filter', 'change', () => this.loadPayoutPage());
  }
}

// ─── Google Maps callback (called by Maps script) ─────────
window.initGlycrMaps = function () {
  if (window.app && typeof window.app.initMapsCallback === 'function') {
    window.app.initMapsCallback();
  }
};

// Bootstrap
const app = new GlycrApp();
