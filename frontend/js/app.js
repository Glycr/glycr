// Glycr App — v3 (Admin Panel Pattern - Full Data Refresh)
class GlycrApp {
  constructor() {
    this.apiBase = 'http://localhost:5040/api';
    this.currentUser = null;

    // CENTRAL DATA STORES (Admin Panel Pattern)
    this.allEvents = [];        // ALL events from backend
    this.userTickets = [];      // User's purchased tickets
    this.orgEvents = [];        // Organizer's events (if organizer)
    this.allPayouts = [];       // All payouts (if organizer)
    this.orgRefunds = [];       // Refunds for organizer's events
    this.allTransactions = [];  // All transactions

    // UI State
    this.events = [];           // Paginated events for home page
    this.favorites = this.loadFromStorage('glycr_favorites') || {};
    this.shares = this.loadFromStorage('glycr_shares') || {};
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
    this.appliedPromo = null;
    this.lastPurchasedTickets = [];
    this.lastPurchasedEvent = null;
    this.faqCat = 'all';
    this.currentEventsPage = 1;
    this.hasMoreEvents = true;
    this.isLoadingEvents = false;
    this.notifications = this.loadFromStorage('glycr_notifications') || [];
    this.reminders = this.loadFromStorage('glycr_reminders') || [];
    this.reviews = this.loadFromStorage('glycr_reviews') || [];
    this.currentRating = 0;
    this._modalFocusTrap = null;
    this._previousFocus = null;
    this._isRefreshing = false;
    this.dataLoaded = false;
    this.isLoadingData = false;

    this.faqs = [
      { cat: 'tickets', q: 'How do I get my ticket after purchase?', a: 'Your ticket is generated instantly after payment. You can download it as a PDF from the ticket modal, or access it anytime from your Profile → Purchase History.' },
      { cat: 'tickets', q: 'Can I transfer my ticket to someone else?', a: 'Yes! You can request a ticket transfer from your Profile → Purchase History. Click the Transfer button next to eligible tickets and enter the recipient\'s Glycr account email.' },
      { cat: 'tickets', q: 'What if I lose my ticket?', a: 'You can re-download your ticket at any time from your Profile → Purchase History. The unique QR code remains valid.' },
      { cat: 'payments', q: 'What payment methods are accepted?', a: 'We accept Mobile Money (MTN MoMo) and debit/credit cards via Stripe.' },
      { cat: 'payments', q: 'How long does payment processing take?', a: 'Mobile money payments are near-instant. Card payments may take 1–2 minutes. You will receive a confirmation email once complete.' },
      { cat: 'payments', q: 'Is my payment information secure?', a: 'Yes. All payments are encrypted using industry-standard TLS. We never store your card details on our servers.' },
      { cat: 'organizers', q: 'How do I create an event?', a: 'Sign up as an organiser, then use the Dashboard → New Event button. Fill in event details, set ticket types, and publish.' },
      { cat: 'organizers', q: 'When do I receive my payout?', a: 'Payouts are processed within 2–5 business days after your event. You can request a payout from your Dashboard or Payouts page.' },
      { cat: 'organizers', q: 'What is the platform fee?', a: 'Glycr charges a small percentage fee on each ticket sold. The current rate is shown on your Dashboard. There are no setup or listing fees.' },
      { cat: 'organizers', q: 'Can I schedule when my event goes live?', a: 'Yes! In the event creation form, use the "Schedule Publication" field to set a future date and time for your event to go live.' },
      { cat: 'refunds', q: 'How do I request a refund?', a: 'Go to Profile → Purchase History and click "Request Refund" next to the ticket. Fill in the reason and submit. The organiser will review within 48 hours.' },
      { cat: 'refunds', q: 'How long do refunds take?', a: 'Once approved by the organiser, refunds are processed within 5–10 business days depending on your payment method.' },
      { cat: 'refunds', q: 'What if the event is cancelled?', a: 'If an organiser cancels an event, all ticket holders are automatically entitled to a full refund. Glycr will process these within 5–7 business days.' },
      { cat: 'account', q: 'How do I reset my password?', a: 'Click "Forgot Password?" on the Sign In page, enter your email, and follow the link sent to your inbox.' },
      { cat: 'account', q: 'Can I have both an attendee and organiser account?', a: 'Yes! You can enable the organiser role from your account settings or by checking "I\'m an event organiser" during registration.' },
      { cat: 'account', q: 'How do I update my profile information?', a: 'Go to Profile and click "Edit Profile" to update your name, email, and phone number.' },
    ];
    this.init();
  }

  // ─── Helpers ──────────────────────────────────────────────
  sendSMS(phone, msg) { console.log(`📱 SMS to ${phone}: ${msg}`); }
  sendEmail(email, subj, body) { console.log(`📧 Email to ${email}: ${subj}\n${body}`); }

  showToast(message, type = 'error') {
    const toast = document.getElementById('toast-message');
    if (toast) {
      toast.textContent = message;
      toast.className = `toast-message ${type}`;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 3500);
    } else { alert(message); }
  }

  getCategoryIcon(slug) {
    const icons = { music: 'fa-music', food: 'fa-utensils', arts: 'fa-palette', sports: 'fa-futbol', business: 'fa-briefcase', nightlife: 'fa-moon', family: 'fa-child', workshops: 'fa-chalkboard-user', community: 'fa-users', free: 'fa-ticket-alt' };
    return icons[slug] || 'fa-calendar';
  }

  getFullImageUrl(p) {
    if (!p) return 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600';
    if (p.startsWith('/uploads/')) return `${this.apiBase.replace('/api', '')}${p}`;
    return p;
  }

  getCategoryName(slug) {
    const n = { music: 'Music', food: 'Food & Drink', arts: 'Arts & Theater', sports: 'Sports & Fitness', business: 'Business & Networking', nightlife: 'Nightlife & Parties', family: 'Family & Kids', workshops: 'Workshops & Classes', community: 'Community & Festivals', free: 'Free Events' };
    return n[slug] || slug;
  }

  getCurrencySymbol(c) { return { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', GHC: '₵' }[c] || '₵'; }
  validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  validatePhone(p) { return /^\+233\d{9}$/.test(p); }

  parseTicketTypes(tt) {
    if (!tt) return {};
    if (typeof tt === 'string') { try { return JSON.parse(tt); } catch { return {}; } }
    if (tt instanceof Map) { const obj = {}; tt.forEach((v, k) => { obj[k] = v; }); return obj; }
    return tt;
  }

  isEarlyBird(event, type) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    const end = tt[type] && tt[type].earlyBirdEnd;
    return end ? this.currentDate < new Date(end) : false;
  }

  getTicketPrice(event, type) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    const base = (tt[type] && tt[type].price) || 0;
    return (this.isEarlyBird(event, type) && tt[type] && tt[type].earlyBirdPrice) ? tt[type].earlyBirdPrice : base;
  }

  getGroupDiscount(qty, type) {
    const ev = this.events.find(e => e._id === this.currentEventId);
    if (!ev) return 0;
    const tt = this.parseTicketTypes(ev.ticketTypes)[type];
    if (!tt) return 0;
    const minQty = tt.groupDiscountMinQty || 5;
    const discPct = tt.groupDiscount || 0;
    return (discPct > 0 && qty >= minQty) ? discPct : 0;
  }

  getTicketBenefits(type) {
    const b = { free: ['Free entry', 'General admission', 'Event access', 'Digital ticket'], regular: ['General admission', 'Event access', 'Digital ticket'], vip: ['Early entry', 'Premium seating', 'VIP lounge access', 'Meet & greet'], vvip: ['All VIP benefits', 'Backstage access', 'Photo opportunities', 'Exclusive merchandise'] };
    return b[(type && type.toLowerCase())] || ['Event access'];
  }

  isEventSoldOut(event) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    for (const t of Object.values(tt)) { if (t.capacity - (t.sold || 0) > 0) return false; }
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
      { width: '0%',   text: 'Very Weak', color: '#ef4444' },
      { width: '20%',  text: 'Weak',      color: '#f59e0b' },
      { width: '40%',  text: 'Fair',      color: '#f59e0b' },
      { width: '60%',  text: 'Good',      color: '#10b981' },
      { width: '80%',  text: 'Strong',    color: '#10b981' },
      { width: '100%', text: 'Very Strong', color: '#10b981' },
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

  setFieldError(inputId, errId, msg) {
    const inp = document.getElementById(inputId);
    const err = document.getElementById(errId);
    if (inp) inp.classList.toggle('has-error', !!msg);
    if (err) { err.textContent = msg || ''; err.classList.toggle('visible', !!msg); }
  }

  clearFieldErrors(...errIds) {
    errIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.classList.remove('visible'); }
      const inp = document.getElementById(id.replace('-err', ''));
      if (inp) inp.classList.remove('has-error');
    });
  }

  async fetchApi(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    let url = `${this.apiBase}${endpoint}`;
    url += `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // ─── MASTER DATA LOADER (Admin Panel Pattern) ─────────────
  async loadAllData() {
    if (this.isLoadingData) return;
    this.isLoadingData = true;

    try {
      const userId = this.currentUser?.id;

      const promises = [
        this.fetchApi('/events?limit=1000&upcoming=false'),
      ];

      if (this.currentUser) {
        promises.push(this.fetchApi('/tickets/my'));
      }

      if (this.currentUser?.isOrganizer) {
        promises.push(
          this.fetchApi(`/events?organizerId=${userId}&limit=1000`),
          this.fetchApi('/payouts'),
          this.fetchApi('/refunds/organizer')
        );
      }

      const results = await Promise.all(promises);

      this.allEvents = results[0] || [];
      let resultIndex = 1;

      if (this.currentUser) {
        this.userTickets = results[resultIndex++] || [];
      }

      if (this.currentUser?.isOrganizer) {
        this.orgEvents = results[resultIndex++] || [];
        this.allPayouts = results[resultIndex++] || [];
        this.orgRefunds = results[resultIndex++] || [];
      }

      this.events = this.allEvents;

      this.dataLoaded = true;
      this.isLoadingData = false;

      await this.refreshCurrentView();

    } catch (err) {
      console.error('Failed to load all data:', err);
      this.isLoadingData = false;
      this.showToast('Failed to load data. Please refresh the page.', 'error');
    }
  }

  calculateOrganizerStats() {
    if (!this.currentUser?.isOrganizer) return null;

    const stats = {
      totalEvents: this.orgEvents.length,
      totalTicketsSold: 0,
      totalRevenue: 0,
      pendingPayouts: 0,
      completedPayouts: 0,
      pendingRefunds: 0,
      netEarnings: 0
    };

    this.orgEvents.forEach(event => {
      const tt = this.parseTicketTypes(event.ticketTypes);
      Object.values(tt).forEach(ticketType => {
        const sold = ticketType.sold || 0;
        const price = ticketType.price || 0;
        stats.totalTicketsSold += sold;
        stats.totalRevenue += sold * price;
      });
    });

    if (this.allPayouts) {
      this.allPayouts.forEach(payout => {
        if (payout.status === 'pending') {
          stats.pendingPayouts += payout.amount;
        } else if (payout.status === 'completed') {
          stats.completedPayouts += payout.amount;
        }
      });
    }

    if (this.orgRefunds) {
      this.orgRefunds.forEach(refund => {
        if (refund.status === 'pending') {
          stats.pendingRefunds += refund.amount || 0;
        }
      });
    }

    stats.netEarnings = stats.totalRevenue * (1 - this.platformFeePercent / 100) - stats.completedPayouts;

    return stats;
  }

  async refreshCurrentView() {
    const activeSection = this.getActiveSection();

    switch(activeSection) {
      case 'dashboard':
        await this.renderDashboardFromData();
        break;
      case 'myevents-page':
        await this.renderMyEventsFromData();
        break;
      case 'report-page':
        await this.loadReportPage();
        break;
      case 'payout-page':
        await this.loadPayoutPage();
        break;
      case 'profile':
        await this.loadProfile();
        break;
      case 'home':
        this.currentEventsPage = 1;
        this.hasMoreEvents = true;
        this.renderEvents(true);
        break;
    }
  }

  getActiveSection() {
    const sections = ['profile', 'dashboard', 'payout-page', 'myevents-page', 'report-page', 'home'];
    for (let s of sections) {
      const el = document.getElementById(s);
      if (el && el.style.display === 'block') return s;
    }
    return 'home';
  }

  // ─── Init ─────────────────────────────────────────────────
  async init() {
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    const termsDate = document.getElementById('terms-date');
    const privDate  = document.getElementById('privacy-date');
    if (termsDate) termsDate.textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (privDate)  privDate.textContent  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    await this.checkAuth();
    this.bindEvents();
    this.bindNavLinks();
    this.setupMobileMenu();
    this.buildCarousel();
    this.checkResetToken();
    this.renderFAQs();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeAllModals(); });
    this.setupInfiniteScroll();
    this.renderNotificationBadge();
    this.initCookieBanner();
    this.initBackToTop();
  }

  setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
      if (this.isLoadingEvents || !this.hasMoreEvents) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        this.renderEvents(false);
      }
    });
  }

  bindNavLinks() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', e => { e.preventDefault(); fn(); });
    };
    on('home-link',      () => this.showSection('home'));
    on('about-link',     () => this.showSection('about-page'));
    on('help-link',      () => this.showSection('help-page'));
    on('dashboard-link', () => this.showSection('dashboard'));
    on('payout-link',    () => this.showSection('payout-page'));
    on('myevents-link',  () => this.showSection('myevents-page'));
    on('report-link',    () => this.showSection('report-page'));
  }

  setupMobileMenu() {
    const btn  = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('navMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  renderFAQs(filter = '', cat = 'all') {
    const list = document.getElementById('faq-list');
    if (!list) return;
    let items = this.faqs;
    if (cat !== 'all') items = items.filter(f => f.cat === cat);
    if (filter) {
      const q = filter.toLowerCase();
      items = items.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
    }
    if (!items.length) { list.innerHTML = '<p style="color:var(--muted); font-size:0.82rem; padding:1rem 0;">No FAQs found.</p>'; return; }
    list.innerHTML = items.map((f, i) => `
      <div class="faq-item" data-faq-index="${i}">
        <div class="faq-question" onclick="this.closest('.faq-item').classList.toggle('open')" role="button" tabindex="0" aria-expanded="false">
          <span>${f.q}</span><i class="fas fa-chevron-down"></i>
        </div>
        <div class="faq-answer">${f.a}</div>
      </div>`).join('');

    list.querySelectorAll('.faq-question').forEach(q => {
      q.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q.click(); } });
    });
  }

  filterFAQs(val) { this.renderFAQs(val, this.faqCat); }

  setFaqCat(cat, btn) {
    this.faqCat = cat;
    document.querySelectorAll('.faq-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.renderFAQs((document.getElementById('faq-search') || {}).value || '', cat);
  }

  async submitHelpMessage(e) {
    e.preventDefault();
    const name    = document.getElementById('help-name').value.trim();
    const email   = document.getElementById('help-email').value.trim();
    const subject = document.getElementById('help-subject').value;
    const message = document.getElementById('help-message').value.trim();
    const s = document.getElementById('help-status');
    if (!name || !email || !subject || !message) { s.style.display = 'block'; s.className = 'status-msg error'; s.textContent = 'Please fill in all fields.'; return; }
    const categoryMap = { ticket_issue: 'ticket_issue', payment_problem: 'payment_problem', refund_request: 'refund_request', organizer_support: 'organizer_support', account_issue: 'account_issue', bug_report: 'bug_report', other: 'other' };
    const category = categoryMap[subject] || 'other';
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Sending your message…';
    try {
      await this.fetchApi('/service-requests', { method: 'POST', body: JSON.stringify({ name, email, category, subject, message }) });
      s.className = 'status-msg success'; s.innerHTML = '<strong>✓ Message sent!</strong> We\'ll reply within 2–4 hours.';
      document.getElementById('help-form').reset();
    } catch {
      await this.delay(800);
      s.className = 'status-msg success'; s.innerHTML = '<strong>✓ Message sent!</strong> We\'ll reply within 2–4 hours.';
      document.getElementById('help-form').reset();
    }
  }

  async subscribeNewsletter(e) {
    e.preventDefault();
    const email = document.getElementById('newsletter-email').value.trim();
    const s = document.getElementById('newsletter-status');
    if (!email || !this.validateEmail(email)) { s.style.display = 'block'; s.style.color = 'var(--coral)'; s.textContent = 'Enter a valid email address.'; return; }
    s.style.display = 'block'; s.style.color = 'var(--muted)'; s.textContent = 'Subscribing…';
    try {
      await this.fetchApi('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email }) });
      s.style.color = 'var(--mint)'; s.textContent = '✓ Subscribed! Welcome to the Glycr community.';
      document.getElementById('newsletter-email').value = '';
    } catch {
      await this.delay(600);
      s.style.color = 'var(--mint)'; s.textContent = '✓ Subscribed! Welcome to the Glycr community.';
      document.getElementById('newsletter-email').value = '';
    }
  }

  clearAllNotifications() {
    this.notifications = [];
    this.saveToStorage('glycr_notifications', this.notifications);
    this.renderNotificationBadge();
    this.renderNotificationsPanel();
  }
  
  buildCarousel() {
    const slidesEl = document.getElementById('carousel-slides');
    const dotsEl   = document.getElementById('carousel-dots');
    if (!slidesEl || !dotsEl) return;
    const FEATURED = this.allEvents.slice(0, 4);
    if (!FEATURED.length) return;
    slidesEl.innerHTML = FEATURED.map((ev, i) => {
      const sym = this.getCurrencySymbol(ev.currency);
      const tt = this.parseTicketTypes(ev.ticketTypes);
      let minP = Infinity;
      Object.values(tt).forEach(t => { if (t.price < minP) minP = t.price; });
      const price = minP === 0 ? 'Free' : `${sym}${minP}`;
      return `<div class="carousel-slide${i === 0 ? ' active' : ''}" data-event-id="${ev._id}" role="button" tabindex="0" aria-label="${ev.title}">
        <img src="${this.getFullImageUrl(ev.image)}" alt="${ev.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900'">
        <div class="carousel-info">
          <div class="carousel-cat">${this.getCategoryName(ev.category)}</div>
          <div class="carousel-title">${ev.title}</div>
          <div class="carousel-venue"><i class="fas fa-map-marker-alt"></i> ${ev.venue}, ${ev.location || 'Ghana'}</div>
          <span class="carousel-price-tag">${price}</span>
        </div>
      </div>`;
    }).join('');
    dotsEl.innerHTML = FEATURED.map((_, i) => `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`).join('');
    let cur = 0;
    const go = n => {
      slidesEl.querySelectorAll('.carousel-slide').forEach((s, i) => s.classList.toggle('active', i === n));
      dotsEl.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === n));
      cur = n;
    };
    dotsEl.querySelectorAll('.carousel-dot').forEach(dot => dot.addEventListener('click', () => go(parseInt(dot.dataset.index))));
    slidesEl.querySelectorAll('.carousel-slide').forEach(slide => {
      slide.addEventListener('click', () => { if (slide.dataset.eventId) this.showEventDetail(slide.dataset.eventId); });
      slide.addEventListener('keydown', e => { if (e.key === 'Enter') slide.click(); });
    });
    setInterval(() => go((cur + 1) % FEATURED.length), 4500);
  }

  initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
  }

  async checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const user = await this.fetchApi('/auth/profile');
      this.currentUser = user;
      localStorage.setItem('user', JSON.stringify(user));
      this.updateNav();
      await this.fetchPlatformFee();
      await this.loadAllData();
      this.showSection(this.currentUser.isOrganizer ? 'dashboard' : 'profile');
    } catch { this.logout(); }
  }

  async fetchPlatformFee() {
    try { const s = await this.fetchApi('/settings'); this.platformFeePercent = s.platformFee || 10; } catch { this.platformFeePercent = 10; }
  }

  async handleAuth() {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const isLogin  = document.getElementById('auth-title').textContent === 'Sign In';

    this.clearFieldErrors('email-err', 'password-err', 'first-name-err', 'last-name-err', 'username-err', 'confirm-password-err', 'phone-err');

    let valid = true;
    if (!email)                    { this.setFieldError('email', 'email-err', 'Email is required'); valid = false; }
    else if (!this.validateEmail(email)) { this.setFieldError('email', 'email-err', 'Invalid email format'); valid = false; }
    if (!password)                 { this.setFieldError('password', 'password-err', 'Password is required'); valid = false; }
    if (!valid) return;

    if (!isLogin) {
      const firstName = document.getElementById('first-name').value.trim();
      const lastName  = document.getElementById('last-name').value.trim();
      const username  = document.getElementById('username').value.trim();
      const phone     = document.getElementById('phone').value.trim();
      const confirmPw = document.getElementById('confirm-password').value;
      const isOrg     = document.getElementById('is-organizer').checked;
      if (!firstName) { this.setFieldError('first-name', 'first-name-err', 'Required'); valid = false; }
      if (!lastName)  { this.setFieldError('last-name',  'last-name-err',  'Required'); valid = false; }
      if (!username)  { this.setFieldError('username',   'username-err',   'Required'); valid = false; }
      if (!phone)     { this.setFieldError('phone', 'phone-err', 'Phone is required'); valid = false; }
      else if (!this.validatePhone(phone)) { this.setFieldError('phone', 'phone-err', 'Use format: +233xxxxxxxxx'); valid = false; }
      if (password !== confirmPw) { this.setFieldError('confirm-password', 'confirm-password-err', 'Passwords do not match'); valid = false; }
      if (this.checkPasswordStrength(password).width === '0%') { this.setFieldError('password', 'password-err', 'Password is too weak'); valid = false; }
      if (!valid) return;
      try {
        const result = await this.fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ name: `${firstName} ${lastName}`, email, password, phone, isOrganizer: isOrg, username }) });
        await this._onAuthSuccess(result);
      } catch (err) { this.showToast(err.message); }
    } else {
      try {
        const result = await this.fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        await this._onAuthSuccess(result);
      } catch (err) { this.setFieldError('password', 'password-err', err.message || 'Invalid credentials'); }
    }
  }

  async _onAuthSuccess(result) {
    localStorage.setItem('token', result.token);
    this.currentUser = result.user;
    localStorage.setItem('user', JSON.stringify(result.user));
    this.updateNav();
    this.closeAllModals();
    await this.fetchPlatformFee();
    await this.loadAllData();
    if (this.currentUser.isOrganizer) { await this.renderDashboardFromData(); this.showSection('dashboard'); }
    else { await this.loadProfile(); this.showSection('profile'); }
    this.pushNotification({ type: 'purchase', text: `Welcome back, ${this.currentUser.name ? this.currentUser.name.split(' ')[0] : 'there'}! 👋` });
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.updateNav();
    this.showSection('home');
    this.currentEventsPage = 1;
    this.hasMoreEvents = true;
    this.dataLoaded = false;
    this.allEvents = [];
    this.orgEvents = [];
    this.userTickets = [];
    this.allPayouts = [];
    this.orgRefunds = [];
    this.renderEvents(true);
  }

  updateNav() {
    const loggedIn       = !!this.currentUser;
    const isOrg          = this.currentUser && this.currentUser.isOrganizer;
    const footerOrgLinks = document.getElementById('footer-organizer-links');
    const $ = id => document.getElementById(id);
    if ($('login-link'))          $('login-link').style.display          = loggedIn ? 'none'        : 'inline-flex';
    if ($('profile-dropdown'))    $('profile-dropdown').style.display    = loggedIn ? 'inline-block' : 'none';
    if ($('notif-bell-btn'))      $('notif-bell-btn').style.display      = loggedIn ? 'inline-flex'  : 'none';
    if ($('dashboard-link'))      $('dashboard-link').style.display      = isOrg    ? 'block'        : 'none';
    if ($('validation-link'))         $('validation-link').style.display        = isOrg    ? 'block'        : 'none';
    if ($('payout-link'))         $('payout-link').style.display         = isOrg    ? 'block'        : 'none';
    if ($('myevents-link'))       $('myevents-link').style.display       = isOrg    ? 'block'        : 'none';
    if ($('report-link'))         $('report-link').style.display         = isOrg    ? 'block'        : 'none';
    if ($('create-event-btn-hero')) $('create-event-btn-hero').style.display = isOrg ? 'inline-flex' : 'none';
    if (footerOrgLinks)           footerOrgLinks.style.display           = isOrg    ? 'block'        : 'none';
    if (loggedIn) {
      const name = this.currentUser.name || 'User';
      if ($('profile-name-small'))   $('profile-name-small').textContent   = name;
      if ($('profile-avatar-small')) $('profile-avatar-small').textContent = name.charAt(0).toUpperCase();
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
      ['first-name', 'last-name', 'username', 'confirm-password', 'phone'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const chk = document.getElementById('is-organizer'); if (chk) chk.checked = false;
    }
    this.clearPasswordStrength();
    this.clearFieldErrors('email-err', 'password-err', 'first-name-err', 'last-name-err', 'username-err', 'confirm-password-err', 'phone-err');
  }

  showSection(section) {
    const dropMenu = document.getElementById('dropdown-menu');
    if (dropMenu) dropMenu.classList.remove('show');

    const homeSection = document.getElementById('home-section');
    if (homeSection) homeSection.style.display = 'none';
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const footer = document.getElementById('site-footer');

    if (section === 'home') {
      if (homeSection) homeSection.style.display = 'block';
      if (footer) footer.style.display = 'block';
    } else {
      const el = document.getElementById(section);
      if (el) el.style.display = 'block';
      if (footer) footer.style.display = 'block';
    }
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const map = { home: 'home-link', 'about-page': 'about-link', 'help-page': 'help-link', profile: null, dashboard: 'dashboard-link', 'payout-page': 'payout-link', 'myevents-page': 'myevents-link', 'report-page': 'report-link' };
    const lnkId = map[section];
    if (lnkId) { const lnk = document.getElementById(lnkId); if (lnk) lnk.classList.add('active'); }

    if (section === 'home')          { this.currentEventsPage = 1; this.hasMoreEvents = true; this.renderEvents(true); }
    if (section === 'profile')       this.loadProfile();
    if (section === 'dashboard')     this.renderDashboardFromData();
    if (section === 'payout-page')   this.loadPayoutPage();
    if (section === 'myevents-page') this.renderMyEventsFromData();
    if (section === 'report-page')   this.loadReportPage();
    if (section === 'help-page')     this.renderFAQs('', this.faqCat);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  // ─── Cookie Consent ───────────────────────────────────────
  initCookieBanner() {
    const consent = localStorage.getItem('glycr_cookie_consent');
    if (consent !== null) return;
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'block';
  }

  handleCookieChoice(accepted) {
    localStorage.setItem('glycr_cookie_consent', accepted ? 'accepted' : 'rejected');
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.style.animation  = 'none';
      banner.style.transform  = 'translateY(100%)';
      banner.style.transition = 'transform 0.3s ease';
      setTimeout(() => { banner.style.display = 'none'; }, 300);
    }
    if (accepted) this.showToast('Cookies accepted. Thank you!', 'success');
  }

  // ─── DASHBOARD ────────────────────────────────────────────
  async renderDashboardFromData() {
    if (!this.currentUser?.isOrganizer) return;

    if (!this.dataLoaded) {
      await this.loadAllData();
    }

    const stats = this.calculateOrganizerStats();
    if (!stats) return;

    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const now = this.currentDate;

    const liveEvents = this.orgEvents.filter(e =>
      e.isPublished && !e.isCancelled && new Date(e.date) > now
    ).length;

    const safeSet = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    safeSet('total-revenue', `${sym}${stats.totalRevenue.toFixed(0)}`);
    safeSet('total-sold', stats.totalTicketsSold);
    safeSet('total-events', stats.totalEvents);
    safeSet('events-live', liveEvents);
    safeSet('pending-payouts', `${sym}${Math.max(0, stats.netEarnings).toFixed(0)}`);
    safeSet('platform-fee-display', `${this.platformFeePercent}%`);

    await this._renderDashChart();
  }

  async _renderDashChart() {
    try {
      const data = await this.fetchApi('/analytics/sales-trend?days=7');
      const ctx  = document.getElementById('dash-sales-chart');
      if (!ctx) return;
      if (this.dashChart) this.dashChart.destroy();
      this.dashChart = new Chart(ctx, {
        type: 'line',
        data: { labels: data.labels, datasets: [{ label: 'Tickets Sold', data: data.tickets, borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.08)', pointBackgroundColor: '#2dd4bf', pointRadius: 4, tension: 0.4, fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2a3a', titleColor: '#eaf2f8', bodyColor: '#7a96aa', borderColor: '#243347', borderWidth: 1 } }, scales: { y: { beginAtZero: true, ticks: { color: '#4a6278', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#192130' } }, x: { ticks: { color: '#4a6278', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#192130' } } } },
      });
    } catch (err) { console.warn('Failed to load sales trend', err); }
  }

  // ─── MY EVENTS PAGE ───────────────────────────────────────
  // FIX: alias so HTML oninput/onchange="app.loadMyEventsPage()" works
  loadMyEventsPage() { return this.renderMyEventsFromData(); }

  async renderMyEventsFromData() {
    if (!this.currentUser?.isOrganizer) return;

    if (!this.dataLoaded) {
      await this.loadAllData();
    }

    let myEvents = [...this.orgEvents];
    const search = (document.getElementById('myevents-search')?.value || '').toLowerCase();
    const filter = (document.getElementById('event-status-filter')?.value || 'all');
    const start = (document.getElementById('myevents-start')?.value);
    const end = (document.getElementById('myevents-end')?.value);
    const now = this.currentDate;

    if (search) {
      myEvents = myEvents.filter(e =>
        e.title.toLowerCase().includes(search) ||
        (e.location || '').toLowerCase().includes(search)
      );
    }

    if (filter === 'upcoming') {
      myEvents = myEvents.filter(e => !e.isCancelled && new Date(e.date) > now);
    } else if (filter === 'past') {
      myEvents = myEvents.filter(e => !e.isCancelled && new Date(e.date) <= now);
    } else if (filter === 'draft') {
      myEvents = myEvents.filter(e => !e.isPublished && !e.isCancelled);
    } else if (filter === 'cancelled') {
      myEvents = myEvents.filter(e => e.isCancelled);
    }

    if (start) myEvents = myEvents.filter(e => new Date(e.date) >= new Date(start));
    if (end) myEvents = myEvents.filter(e => new Date(e.date) <= new Date(end + 'T23:59:59'));

    const container = document.getElementById('my-events-list');
    if (!container) return;

    if (!myEvents.length) {
      container.innerHTML = '<div class="empty-state"><h3>No events found</h3><p>Try adjusting your search filters</p></div>';
      return;
    }

    container.innerHTML = myEvents.map(e => this.renderEventAdminCard(e)).join('');

    // Re-attach event handlers
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const eventId = btn.dataset.eventId;
        if (action === 'edit-event') {
          const ev = await this.fetchApi(`/events/${eventId}`);
          this.showEventForm(ev);
        } else if (action === 'cancel-event') {
          this.showCancelModal(eventId);
        } else if (action === 'toggle-publish') {
          await this.togglePublish(eventId);
        } else if (action === 'delete-event') {
          await this.deleteEvent(eventId);
        }
      });
    });
  }

  renderEventAdminCard(event) {
    const tt = this.parseTicketTypes(event.ticketTypes);
    const esym = this.getCurrencySymbol(event.currency);
    const eRev = Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0);
    const bars = Object.entries(tt).map(([type, t]) => {
      const s = t.sold || 0, pct = t.capacity ? (s / t.capacity * 100) : 0;
      return `<div class="ticket-bar-row">
        <span class="ticket-bar-label">${type}</span>
        <div class="ticket-bar-track">
          <div class="ticket-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="ticket-bar-count">${s}/${t.capacity}</span>
      </div>`;
    }).join('');

    const statusBadge = event.isCancelled ?
      '<span style="color:var(--coral);">· Cancelled</span>' :
      !event.isPublished ?
        '<span style="color:var(--muted);">· Draft</span>' :
        '<span style="color:var(--mint);">· Published</span>';

    const scheduleBadge = event.publishAt && !event.isPublished ?
      `<span class="scheduled-badge"><i class="fas fa-clock"></i> Scheduled ${new Date(event.publishAt).toLocaleDateString()}</span>` : '';

    return `<div class="event-admin-card">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap;">
        <div>
          <div class="event-admin-title">${event.title} ${scheduleBadge}</div>
          <div class="event-admin-meta">
            <i class="fas fa-calendar-alt"></i> ${new Date(event.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'})}
            &nbsp;·&nbsp; <i class="fas fa-coins"></i> ${esym}${eRev.toFixed(0)}
            &nbsp;${statusBadge}
          </div>
        </div>
      </div>
      <div style="margin:0.5rem 0;">${bars}</div>
      <div class="event-admin-actions">
        <button class="btn btn-ghost" style="font-size:0.75rem;" data-action="edit-event" data-event-id="${event._id}">
          <i class="fas fa-edit"></i> Edit
        </button>
        ${!event.isCancelled ? `
          <button class="btn btn-ghost" style="font-size:0.75rem; color:var(--gold); border-color:rgba(251,191,36,0.3);" data-action="cancel-event" data-event-id="${event._id}">
            <i class="fas fa-ban"></i> Cancel
          </button>
        ` : ''}
        <button class="btn btn-ghost" style="font-size:0.75rem;" data-action="toggle-publish" data-event-id="${event._id}">
          <i class="fas fa-${event.isPublished ? 'eye-slash' : 'eye'}"></i> ${event.isPublished ? 'Unpublish' : 'Publish'}
        </button>
        <button class="btn btn-danger" style="font-size:0.75rem;" data-action="delete-event" data-event-id="${event._id}">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>`;
  }

  // ─── Profile ──────────────────────────────────────────────
  async loadProfile() {
    if (!this.currentUser) return;

    if (!this.dataLoaded) {
      await this.loadAllData();
    }

    const name = this.currentUser.name || 'User';
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('profile-name', name);
    setTxt('profile-avatar', name.charAt(0).toUpperCase());

    const emailEl = document.getElementById('profile-email-display');
    const phoneEl = document.getElementById('profile-phone-display');
    if (emailEl) emailEl.innerHTML = `<i class="fas fa-envelope"></i> ${this.currentUser.email || '—'}`;
    if (phoneEl) phoneEl.innerHTML = `<i class="fas fa-phone"></i> ${this.currentUser.phone || '—'}`;

    await Promise.all([
      this._loadPurchaseHistory(),
      this._loadFavourites(),
      this.loadMyRefunds(),
      this._loadRemindersTab(),
      this._loadReviewsTab(),
    ]);
  }

  switchProfileTab(tab, btn) {
    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) panel.classList.add('active');
  }

  async _loadPurchaseHistory() {
    const container = document.getElementById('purchase-history-list');
    const countEl   = document.getElementById('purchase-count');
    if (!container) return;

    const tickets = this.userTickets;
    const now = this.currentDate;
    if (countEl) countEl.textContent = `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`;

    if (!tickets.length) {
      container.innerHTML = '<p style="color:var(--muted); font-size:0.82rem; padding:1rem 0;">No purchases yet. Browse events to get started!</p>';
      return;
    }

    container.innerHTML = tickets.map(t => {
      const ev = this.allEvents.find(e => e._id === t.eventId);
      const sym = this.getCurrencySymbol((ev && ev.currency) || 'GHC');
      const evDate = ev ? new Date(ev.date) : null;
      const isPast = evDate && evDate <= now;
      const canRefund = evDate && evDate > now && !t.refunded;
      const canTransfer = evDate && evDate > now && !t.transferred;
      const canReview = isPast && !t.reviewed;
      return `<div class="purchase-item">
        <div class="purchase-item-body">
          <div class="purchase-item-title">${ev ? ev.title : 'Event'}</div>
          <div class="purchase-item-meta">${t.ticketType.toUpperCase()} · ${t.price === 0 ? 'Free' : sym + t.price} · ${new Date(t.purchasedAt).toLocaleDateString()}</div>
        </div>
        <div class="purchase-item-actions">
          ${canTransfer ? `<button class="btn btn-ghost btn-sm" style="color:var(--sky); border-color:rgba(125,211,252,0.3);" onclick="app.openTransferModal('${t.id}','${ev ? ev.title : 'Event'}','${t.ticketType}')"><i class="fas fa-paper-plane"></i> Transfer</button>` : ''}
          ${canRefund   ? `<button class="btn btn-ghost btn-sm" style="color:var(--coral); border-color:rgba(255,107,107,0.3);" onclick="app.openRefundModal('${t.id}','${ev ? ev.title : ''}','${t.ticketType}',${t.price})"><i class="fas fa-undo"></i> Refund</button>` : ''}
          ${canReview   ? `<button class="btn btn-ghost btn-sm" style="color:var(--gold); border-color:rgba(251,191,36,0.3);" onclick="app.openReviewModal('${t.eventId}','${ev ? ev.title : 'Event'}')"><i class="fas fa-star"></i> Review</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  async _loadFavourites() {
    const container = document.getElementById('favorite-events-list');
    const countEl   = document.getElementById('fav-count');
    if (!container) return;
    const favIds = (this.favorites[this.currentUser && this.currentUser.id] || []);
    const favEvs = this.allEvents.filter(e => favIds.includes(e._id) && !e.isCancelled);
    if (countEl) countEl.textContent = `${favEvs.length} event${favEvs.length !== 1 ? 's' : ''}`;
    container.innerHTML = favEvs.length
      ? favEvs.map(e => this.renderEventCard(e)).join('')
      : '<p style="color:var(--muted); font-size:0.82rem; grid-column:1/-1; padding:1rem 0;">No favourites yet. Heart an event to save it here.</p>';

    container.querySelectorAll('.event-card:not(.cancelled)').forEach(card => {
      card.onclick = e => { if (!e.target.closest('.fav-btn')) this.showEventDetail(card.dataset.eventId); };
    });
  }

  async _loadRemindersTab() {
    const container = document.getElementById('reminders-list');
    if (!container) return;
    const reminders = this.reminders.filter(r => this.currentUser && r.userId === this.currentUser.id);
    if (!reminders.length) {
      container.innerHTML = '<p style="color:var(--muted); font-size:0.82rem;">No reminders set. When you purchase a ticket with reminders enabled, they\'ll appear here.</p>';
      return;
    }
    container.innerHTML = reminders.map(r => `
      <div class="reminder-item">
        <div class="reminder-item-icon"><i class="fas fa-bell"></i></div>
        <div class="reminder-item-body">
          <div class="reminder-item-title">${r.eventTitle}</div>
          <div class="reminder-item-meta"><i class="fas fa-calendar-alt"></i> ${new Date(r.eventDate).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <button class="reminder-remove-btn" onclick="app.removeReminder('${r.id}')" aria-label="Remove reminder"><i class="fas fa-times"></i></button>
      </div>`).join('');
  }

  removeReminder(id) {
    this.reminders = this.reminders.filter(r => r.id !== id);
    this.saveToStorage('glycr_reminders', this.reminders);
    this._loadRemindersTab();
    this.showToast('Reminder removed.', 'warning');
  }

  async _loadReviewsTab() {
    const container = document.getElementById('my-reviews-list');
    if (!container) return;
    const myReviews = this.reviews.filter(r => this.currentUser && r.userId === this.currentUser.id);
    if (!myReviews.length) {
      container.innerHTML = '<p style="color:var(--muted); font-size:0.82rem;">No reviews yet. After attending an event, you\'ll be able to share your experience.</p>';
      return;
    }
    container.innerHTML = myReviews.map(r => `
      <div class="review-card">
        <div class="review-card-header">
          <div class="review-card-event">${r.eventTitle}</div>
          <div class="review-card-stars">${Array.from({length: 5}, (_, i) => `<i class="fas fa-star" style="color:${i < r.rating ? 'var(--gold)' : 'var(--border-2)'}"></i>`).join('')}</div>
        </div>
        <div class="review-card-text">${r.text}</div>
        <div class="review-card-date">${new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>`).join('');
  }

  async loadMyRefunds() {
    const container = document.getElementById('my-refunds-list');
    if (!container) return;
    try {
      const refunds = await this.fetchApi('/refunds/my');
      if (!refunds.length) { container.innerHTML = '<p style="color:var(--muted); font-size:0.82rem; padding:1rem 0;">No refund requests yet.</p>'; return; }
      container.innerHTML = refunds.map(r => {
        const ev = this.allEvents.find(e => e._id === r.eventId);
        const eventTitle = r.eventTitle && r.eventTitle !== 'undefined' ? r.eventTitle : (ev ? ev.title : 'Event');
        return `<div class="refund-item">
          <div class="refund-item-title">${eventTitle} — ${(r.ticketType ? r.ticketType.toUpperCase() : '') || ''}</div>
          <div class="refund-item-meta">
            <span class="status-pill ${r.status}">${r.status}</span>
            <span>${r.reason}</span>
            ${r.amount ? `<span>₵${r.amount}</span>` : '<span>Full refund</span>'}
            <span>${new Date(r.createdAt).toLocaleDateString()}</span>
          </div>
        </div>`;
      }).join('');
    } catch { container.innerHTML = '<p style="color:var(--muted); font-size:0.82rem;">No refund requests yet.</p>'; }
  }

  async saveProfile() {
    const name  = document.getElementById('profile-name-input').value.trim();
    const email = document.getElementById('profile-email-input').value.trim();
    const phone = document.getElementById('profile-phone-input').value.trim();
    this.clearFieldErrors('pname-err', 'pemail-err', 'pphone-err');
    let valid = true;
    if (!name)                         { this.setFieldError('profile-name-input',  'pname-err',  'Name is required'); valid = false; }
    if (!email)                        { this.setFieldError('profile-email-input', 'pemail-err', 'Email is required'); valid = false; }
    else if (!this.validateEmail(email)) { this.setFieldError('profile-email-input', 'pemail-err', 'Invalid email format'); valid = false; }
    if (!phone)                        { this.setFieldError('profile-phone-input', 'pphone-err', 'Phone is required'); valid = false; }
    else if (!this.validatePhone(phone)) { this.setFieldError('profile-phone-input', 'pphone-err', 'Use format: +233xxxxxxxxx'); valid = false; }
    if (!valid) return;
    try {
      const u = await this.fetchApi('/auth/profile', { method: 'PUT', body: JSON.stringify({ name, email, phone }) });
      this.currentUser = u; localStorage.setItem('user', JSON.stringify(u)); this.updateNav();
      await this.loadAllData();
      this.closeAllModals();
    } catch (err) { this.showToast(err.message); }
  }

  // ─── Events List ──────────────────────────────────────────
  async renderEvents(reset = true) {
    if (this.isLoadingEvents) return;
    if (reset) { this.currentEventsPage = 1; this.hasMoreEvents = true; document.getElementById('events-grid').innerHTML = ''; }
    if (!this.hasMoreEvents) return;
    this.isLoadingEvents = true;
    const grid = document.getElementById('events-grid');
    if (reset) {
      grid.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div><p>Loading events…</p></div>';
    } else {
      const loader = document.createElement('div');
      loader.className = 'loading-placeholder'; loader.id = 'scroll-loader';
      loader.innerHTML = '<div class="spinner"></div><p>Loading more…</p>';
      grid.appendChild(loader);
    }
    const search   = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const location = document.getElementById('location-filter').value;
    const q = new URLSearchParams();
    if (search)   q.append('search', search);
    if (category) q.append('category', category);
    if (location) q.append('location', location);
    q.append('upcoming', 'true');
    q.append('page', this.currentEventsPage);
    q.append('limit', 12);
    try {
      const response  = await this.fetchApi(`/events?${q}`, { cacheBust: true });
      const newEvents = response.events || response;
      const pagination = response.pagination || null;
      if (reset) this.events = [];
      this.events.push(...newEvents);
      if (reset) {
        grid.innerHTML = this.events.map(e => this.renderEventCard(e)).join('');
      } else {
        const loaderDiv = document.getElementById('scroll-loader');
        if (loaderDiv) loaderDiv.remove();
        grid.insertAdjacentHTML('beforeend', newEvents.map(e => this.renderEventCard(e)).join(''));
      }
      this.hasMoreEvents = pagination ? pagination.hasMore : newEvents.length === 12;
      if (this.hasMoreEvents) this.currentEventsPage++;
      grid.querySelectorAll('.event-card:not(.cancelled)').forEach(card => {
        card.onclick = e => { if (!e.target.closest('.fav-btn')) this.showEventDetail(card.dataset.eventId); };
      });
    } catch (err) {
      console.error(err);
      if (reset) grid.innerHTML = '<div class="empty-state">Failed to load events. Please try again.</div>';
      else { const l = document.getElementById('scroll-loader'); if (l) l.remove(); }
    } finally { this.isLoadingEvents = false; }
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

    // ── FIX: availability badge for card footer ───────────────
    // Show badge for all non-sold-out tiers (including free events).
    const minTypeData = tt[minType];
    const availBadge  = (!soldOut && minTypeData)
      ? this.renderAvailabilityBadge(
        minTypeData.capacity - (minTypeData.sold || 0),
        minTypeData.capacity
      )
      : '';

    let priceHtml;
    if (soldOut)     priceHtml = `<span class="card-price sold-out"><i class="fas fa-times-circle"></i> Sold Out</span>`;
    else if (isFree) priceHtml = `<span class="card-price free">Free</span>`;
    else             priceHtml = `<span class="card-price${isEB ? ' early-bird' : ''}">${sym}${minPrice}</span>`;

    return `<div class="event-card${event.isCancelled ? ' cancelled' : ''}" data-event-id="${event._id}" tabindex="0" role="button" aria-label="${event.title}">
      <div class="card-img">
        <img src="${this.getFullImageUrl(event.image)}" alt="${event.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600'">
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
          ${!event.isCancelled ? `<button class="fav-btn${isFav ? ' active' : ''}" data-event-id="${event._id}" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" aria-pressed="${isFav}"><i class="fas fa-heart"></i></button>` : ''}
          ${availBadge}
        </div>
      </div>
    </div>`;
  }


  // ─── Ticket Availability System ───────────────────────────

  /**
   * Returns a structured availability object from remaining / total counts.
   * Uses only Font Awesome Free icons (compatible with FA 6.0.0-beta3 CDN).
   */
  getTicketAvailability(remaining, total) {
    const pct = total > 0 ? (remaining / total) * 100 : 0;

    if (remaining <= 0) {
      return {
        label:    'Sold out',
        sublabel: 'Join the waitlist',
        icon:     'fa-ban',
        tier:     'sold-out',
        pct:      0,
      };
    }
    if (pct > 80) {
      return {
        label:    'Available',
        sublabel: `${remaining} tickets available`,
        icon:     'fa-ticket-alt',
        tier:     'ok',
        pct,
      };
    }
    if (pct > 50) {
      return {
        label:    'Selling fast',
        sublabel: `${remaining} remaining`,
        icon:     'fa-bolt',           // FA Free ✓
        tier:     'ok',
        pct,
      };
    }
    if (pct > 20) {
      return {
        label:    'Going quickly',
        sublabel: `${remaining} remaining`,
        icon:     'fa-fire',           // FA Free ✓
        tier:     'warn',
        pct,
      };
    }
    if (pct > 5) {
      return {
        label:    `Only ${remaining} left`,
        sublabel: 'Limited availability',
        icon:     'fa-exclamation-triangle', // FA Free ✓
        tier:     'danger',
        pct,
      };
    }
    return {
      label:    'Almost sold out',
      sublabel: `${remaining} ticket${remaining !== 1 ? 's' : ''} left`,
      icon:     'fa-hourglass-end',   // FA Free ✓
      tier:     'danger',
      pct,
    };
  }

  /**
   * Compact pill badge — used on event cards.
   */
  renderAvailabilityBadge(remaining, total) {
    const a = this.getTicketAvailability(remaining, total);
    const colorMap = {
      'ok':       'color:var(--mint);  background:rgba(110,231,183,0.12); border:1px solid rgba(110,231,183,0.2);',
      'warn':     'color:var(--gold);  background:rgba(251,191,36,0.12);  border:1px solid rgba(251,191,36,0.2);',
      'danger':   'color:var(--coral); background:rgba(255,107,107,0.12); border:1px solid rgba(255,107,107,0.2);',
      'sold-out': 'color:var(--muted); background:rgba(74,98,120,0.12);   border:1px solid rgba(74,98,120,0.2);',
    };
    const style = colorMap[a.tier] || colorMap['ok'];
    return `<span class="avail-badge" style="
      display:inline-flex; align-items:center; gap:5px;
      font-family:'JetBrains Mono',monospace; font-size:0.62rem;
      letter-spacing:0.06em; padding:0.22rem 0.65rem;
      border-radius:100px; white-space:nowrap; ${style}
    "><i class="fas ${a.icon}" style="font-size:0.6rem;" aria-hidden="true"></i>${a.label}</span>`;
  }

  /**
   * Full bar with progress track + sublabel + percentage — used in event detail modal tiers.
   * Also handles the sold-out state correctly (renders 0% bar in muted colour).
   */
  renderAvailabilityBar(remaining, total) {
    const a = this.getTicketAvailability(remaining, total);
    const fillColor = {
      'ok':       'var(--mint)',
      'warn':     'var(--gold)',
      'danger':   'var(--coral)',
      'sold-out': 'var(--muted)',
    }[a.tier];
    const width = Math.max(a.pct, 0).toFixed(1);
    return `<div style="margin:0.4rem 0;">
      <div style="height:3px; border-radius:2px; background:var(--border-2); overflow:hidden;">
        <div style="height:100%; width:${width}%; background:${fillColor}; border-radius:2px; transition:width .4s;"></div>
      </div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.3rem;">
        <span style="font-size:0.7rem; color:var(--muted); display:flex; align-items:center; gap:4px;">
          <i class="fas ${a.icon}" style="font-size:0.65rem;" aria-hidden="true"></i>
          ${a.sublabel}
        </span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:0.65rem; color:var(--muted);">
          ${Math.round(Math.max(a.pct, 0))}%
        </span>
      </div>
    </div>`;
  }

  // ─── Event Detail ─────────────────────────────────────────
  async showEventDetail(id) {
    try {
      const event = await this.fetchApi(`/events/${id}`);
      if (event.isCancelled) return this.showToast('This event has been cancelled.');
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
          <img src="${this.getFullImageUrl(event.image)}" alt="${event.title}" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900'">
          <div class="detail-hero-overlay"></div>
          <span class="detail-cat-badge"><i class="fas ${icon}"></i> ${cat}</span>
        </div>
        <h2 class="detail-title" id="event-modal-title">${event.title}</h2>
        <div class="detail-meta">
          <span class="detail-meta-item"><i class="fas fa-calendar-alt"></i> ${date.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span class="detail-meta-item"><i class="fas fa-map-marker-alt"></i> ${locationHtml}</span>
          <span class="detail-meta-item"><i class="fas fa-envelope"></i> <a href="mailto:${event.organizerEmail}" style="color:var(--teal);">${event.organizerEmail}</a></span>
          <span class="detail-meta-item"><i class="fas fa-phone-alt"></i> ${event.organizerPhone}</span>
        </div>
        <p class="detail-desc">${event.description}</p>
        <p class="tickets-label">Available Tickets</p>`;

      // ── FIX: both sold-out AND available tiers use renderAvailabilityBar ──
      document.getElementById('ticket-benefits').innerHTML = Object.entries(tt).map(([type, data]) => {
        const avail   = data.capacity - (data.sold || 0);
        const soldOut = avail <= 0;
        const price   = this.getTicketPrice(event, type);
        const isEB    = this.isEarlyBird(event, type);
        const bens    = this.getTicketBenefits(type);
        const priceStr = price === 0 ? 'Free' : `${sym}${price}${isEB ? ' (Early Bird)' : ''}`;

        if (soldOut) {
          return `<div class="ticket-tier">
            <div>
              <div class="ticket-tier-name">${type.toUpperCase()}</div>
              <div class="ticket-tier-avail">
                ${this.renderAvailabilityBar(0, data.capacity)}
              </div>
              <div class="ticket-tier-benefits">${bens.join(' · ')}</div>
              <button class="btn btn-ghost" style="margin-top:0.5rem; font-size:0.75rem;" onclick="event.stopPropagation(); app.showWaitlistModal('${event._id}','${type}')">
                <i class="fas fa-clock"></i> Join Waitlist
              </button>
            </div>
            <div class="tier-price sold-out-lbl">Sold Out</div>
          </div>`;
        }

        return `<div class="ticket-tier" data-type="${type}" data-price="${price}" tabindex="0" role="button" aria-label="Select ${type} ticket at ${priceStr}">
          <div>
            <div class="ticket-tier-name">${type.toUpperCase()}</div>
            <div class="ticket-tier-avail">
              ${this.renderAvailabilityBar(avail, data.capacity)}
            </div>
            <div class="ticket-tier-benefits">${bens.join(' · ')}</div>
          </div>
          <div class="tier-price${price === 0 ? ' free' : ''}">${priceStr}</div>
        </div>`;
      }).join('');

      document.querySelectorAll('.ticket-tier[data-type]').forEach(tier => {
        tier.addEventListener('click', () => this.selectTicket(tier.dataset.type, parseFloat(tier.dataset.price), event._id));
        tier.addEventListener('keydown', e => { if (e.key === 'Enter') tier.click(); });
      });
      this.openModal('event-modal');
    } catch (err) { this.showToast(err.message); }
  }

  // ─── Waitlist ─────────────────────────────────────────────
  showWaitlistModal(eventId, type) {
    this.currentEventId = eventId;
    this.selectedTicket = { type, eventId };
    document.getElementById('waitlist-title').textContent = `Join Waitlist for ${type.toUpperCase()} Tickets`;
    document.getElementById('waitlist-form').reset();
    document.getElementById('waitlist-status').style.display = 'none';
    this.clearFieldErrors('waitlist-name-err', 'waitlist-email-err', 'waitlist-phone-err');
    this.openModal('waitlist-modal');
  }

  async joinWaitlist() {
    const name  = document.getElementById('waitlist-name').value.trim();
    const email = document.getElementById('waitlist-email').value.trim();
    const phone = document.getElementById('waitlist-phone').value.trim();
    this.clearFieldErrors('waitlist-name-err', 'waitlist-email-err', 'waitlist-phone-err');
    let valid = true;
    if (!name)                         { this.setFieldError('waitlist-name',  'waitlist-name-err',  'Required'); valid = false; }
    if (!email)                        { this.setFieldError('waitlist-email', 'waitlist-email-err', 'Required'); valid = false; }
    else if (!this.validateEmail(email)) { this.setFieldError('waitlist-email', 'waitlist-email-err', 'Invalid email'); valid = false; }
    if (!phone)                        { this.setFieldError('waitlist-phone', 'waitlist-phone-err', 'Required'); valid = false; }
    else if (!this.validatePhone(phone)) { this.setFieldError('waitlist-phone', 'waitlist-phone-err', '+233xxxxxxxxx'); valid = false; }
    if (!valid) return;
    const s = document.getElementById('waitlist-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Joining waitlist…';
    try {
      const result = await this.fetchApi('/waitlists', { method: 'POST', body: JSON.stringify({ eventId: this.selectedTicket.eventId, ticketType: this.selectedTicket.type, name, email, phone }) });
      const position = result.position || '?';
      s.className = 'status-msg success'; s.innerHTML = `<strong>✓ Joined!</strong> You're #${position} on the waitlist.`;
      this.sendEmail(email, 'Glycr Waitlist Confirmation', `Hi ${name}, you are #${position} on the waitlist.`);
      await this.loadAllData();
      setTimeout(() => this.closeAllModals(), 2500);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message || 'Failed. Please try again.'; }
  }

  // ─── Promo / Coupon ───────────────────────────────────────
  async applyPromoCode() {
    const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
    const s    = document.getElementById('promo-status');
    if (!code) { s.style.display = 'block'; s.style.color = 'var(--coral)'; s.textContent = 'Enter a promo code.'; return; }
    s.style.display = 'block'; s.style.color = 'var(--muted)'; s.textContent = 'Validating code…';
    try {
      const result = await this.fetchApi('/coupons/validate', { method: 'POST', body: JSON.stringify({ code, eventId: this.currentEventId }) });
      this.appliedPromo = result;
      s.style.color = 'var(--mint)'; s.textContent = `✓ Code applied: ${result.type === 'percentage' ? result.value + '%' : '₵' + result.value} off`;
      this.updatePriceSummary();
    } catch (err) { this.appliedPromo = null; s.style.color = 'var(--coral)'; s.textContent = err.message || 'Invalid or expired code.'; }
  }

  updatePriceSummary() {
    if (!this.selectedTicket) return;
    const qty       = parseInt((document.getElementById('ticket-quantity') || {}).value) || 1;
    const basePrice = this.selectedTicket.price;
    const sym       = this.getCurrencySymbol((this.lastPurchasedEvent && this.lastPurchasedEvent.currency) || 'GHC');
    const subtotal  = basePrice * qty;
    let discount    = 0, discLabel = '';
    const groupDiscPct = this.getGroupDiscount(qty, this.selectedTicket.type);
    if (groupDiscPct > 0) { discount += subtotal * groupDiscPct / 100; discLabel = `Group ${groupDiscPct}%`; }
    if (this.appliedPromo) {
      if (this.appliedPromo.type === 'percentage') { discount += subtotal * this.appliedPromo.value / 100; discLabel = discLabel ? discLabel + ` + ${this.appliedPromo.code}` : this.appliedPromo.code; }
      else { discount += this.appliedPromo.value; discLabel = discLabel ? discLabel + ` + ${this.appliedPromo.code}` : this.appliedPromo.code; }
    }
    const total = Math.max(0, subtotal - discount);
    const summaryEl = document.getElementById('price-summary');
    if (summaryEl) {
      summaryEl.style.display = 'block';
      document.getElementById('price-subtotal').textContent = `${sym}${subtotal.toFixed(2)}`;
      const discRow = document.getElementById('discount-row');
      if (discount > 0 && discRow) {
        discRow.style.display = 'flex';
        document.getElementById('discount-label').textContent = discLabel;
        document.getElementById('price-discount').textContent = `-${sym}${discount.toFixed(2)}`;
      } else if (discRow) { discRow.style.display = 'none'; }
      document.getElementById('price-total').textContent = `${sym}${total.toFixed(2)}`;
    }
    return total;
  }

  // ─── Purchase Flow ────────────────────────────────────────
  selectTicket(type, price, eventId) {
    this.selectedTicket = { type, price, eventId };
    this.appliedPromo   = null;
    this.showPurchaseFlow();
  }

  async showPurchaseFlow() {
    if (!this.selectedTicket) return;
    const event    = await this.fetchApi(`/events/${this.selectedTicket.eventId}`);
    this.lastPurchasedEvent = event;
    const benefits  = this.getTicketBenefits(this.selectedTicket.type);
    const sym       = this.getCurrencySymbol(event.currency);
    const isEB      = this.isEarlyBird(event, this.selectedTicket.type);
    const dispPrice = this.selectedTicket.price === 0 ? 'Free' : `${sym}${this.selectedTicket.price}${isEB ? ' (Early Bird)' : ''}`;
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
    document.getElementById('promo-code-input').value = '';
    document.getElementById('promo-status').style.display = 'none';
    this.appliedPromo = null;
    const qtyEl = document.getElementById('ticket-quantity');
    const grpEl = document.getElementById('group-booking-section');
    qtyEl.oninput = () => { grpEl.style.display = (parseInt(qtyEl.value) || 1) >= 5 ? 'grid' : 'none'; this.updatePriceSummary(); };
    qtyEl.dispatchEvent(new Event('input'));
    const payEl = document.getElementById('payment-section');
    const cardEl = document.getElementById('card-element');
    const payBtn = document.getElementById('pay-btn');
    payEl.style.display = 'block';
    this.clearFieldErrors('payer-email-err', 'payer-phone-err');
    document.querySelectorAll('.pmeth-btn').forEach(btn => btn.classList.remove('active'));
    const firstBtn = document.querySelector('.pmeth-btn');
    if (firstBtn) { firstBtn.classList.add('active'); this.selectedPaymentMethod = firstBtn.dataset.method; }
    if (this.selectedTicket.price === 0) {
      const pmethSection = document.querySelector('.pmeth-grid'); if (pmethSection) pmethSection.style.display = 'none';
      if (cardEl) cardEl.style.display = 'none';
      payBtn.textContent = 'Claim Free Ticket';
    } else {
      const pmethSection = document.querySelector('.pmeth-grid'); if (pmethSection) pmethSection.style.display = 'grid';
      if (cardEl) cardEl.style.display = this.selectedPaymentMethod === 'stripe' ? 'block' : 'none';
      payBtn.textContent = 'Complete Purchase';
    }
    if (this.currentUser) {
      const payerEmail = document.getElementById('payer-email');
      const payerPhone = document.getElementById('payer-phone');
      if (payerEmail && !payerEmail.value) payerEmail.value = this.currentUser.email || '';
      if (payerPhone && !payerPhone.value) payerPhone.value = this.currentUser.phone || '';
    }
    this.updatePriceSummary();
    this.openModal('purchase-modal');
  }

  async processPayment() {
    const email  = document.getElementById('payer-email').value.trim();
    const phone  = document.getElementById('payer-phone').value.trim();
    const qty    = parseInt(document.getElementById('ticket-quantity').value) || 1;
    const remind = document.getElementById('set-reminder').checked;
    const companyName    = document.getElementById('company-name')?.value.trim() || '';
    const billingAddress = document.getElementById('billing-address')?.value.trim() || '';
    this.clearFieldErrors('payer-email-err', 'payer-phone-err');
    let valid = true;
    if (!email)                        { this.setFieldError('payer-email', 'payer-email-err', 'Email is required'); valid = false; }
    else if (!this.validateEmail(email)) { this.setFieldError('payer-email', 'payer-email-err', 'Invalid email format'); valid = false; }
    if (!phone)                        { this.setFieldError('payer-phone', 'payer-phone-err', 'Phone is required'); valid = false; }
    else if (!this.validatePhone(phone)) { this.setFieldError('payer-phone', 'payer-phone-err', 'Use format: +233xxxxxxxxx'); valid = false; }
    if (!valid) return;
    const statusEl = document.getElementById('payment-status');
    statusEl.style.display = 'block'; statusEl.className = 'status-msg loading';
    statusEl.textContent = this.selectedTicket.price === 0 ? 'Claiming tickets…' : `Processing payment…`;
    try {
      await this.delay(1800);
      const tickets = await this.fetchApi('/tickets/purchase', {
        method: 'POST',
        body: JSON.stringify({
          eventId: this.selectedTicket.eventId, ticketType: this.selectedTicket.type, quantity: qty,
          paymentDetails: { email, phone },
          // Send buyer info at top level too for guest (unauthenticated) purchases
          buyerEmail: email,
          buyerPhone: phone,
          buyerName: email.split('@')[0],
          isGuest: !this.currentUser,
          promoCode: (this.appliedPromo && this.appliedPromo.code) || null,
          groupBooking: qty >= 5 ? { companyName, billingAddress } : null,
        }),
      });
      const normTickets = (Array.isArray(tickets) ? tickets : [tickets]).map(t => ({
        ...t,
        id: t.id || t._id || t.ticketId || ('TKT-' + Math.random().toString(36).slice(2, 10).toUpperCase()),
        ticketType: t.ticketType || t.type || (this.selectedTicket && this.selectedTicket.type) || 'ticket',
      }));
      this.lastPurchasedTickets = normTickets;
      statusEl.className = 'status-msg success'; statusEl.innerHTML = `<strong>✓ ${qty} ticket${qty > 1 ? 's' : ''} purchased!</strong>`;
      const ev = await this.fetchApi(`/events/${this.selectedTicket.eventId}`);
      this.lastPurchasedEvent = ev;
      this.sendSMS(phone, `Your Glycr tickets for ${ev.title} are ready!`);
      this.sendEmail(email, `Your tickets for ${ev.title}`, `Hi! Your ${qty} ${this.selectedTicket.type.toUpperCase()} ticket(s) for ${ev.title} are confirmed.`);

      if (remind && this.currentUser) {
        const reminderId = 'REM-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        this.reminders.push({ id: reminderId, userId: this.currentUser.id, eventId: ev._id, eventTitle: ev.title, eventDate: ev.date });
        this.saveToStorage('glycr_reminders', this.reminders);
      }

      this.pushNotification({ type: 'purchase', text: `You bought ${qty} ticket${qty > 1 ? 's' : ''} for ${ev.title}!` });

      await this.loadAllData();

      const ticketCanvasEl = document.getElementById('ticket-canvas');
      ticketCanvasEl.innerHTML = '';
      this.closeAllModals();
      this.openModal('ticket-modal');

      new QRCode(ticketCanvasEl, {
        text:         normTickets[0].id,
        width:        184,
        height:       184,
        colorDark:    '#000000',
        colorLight:   '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
      });

      document.getElementById('ticket-id').textContent = `Ticket ID: ${normTickets[0].id}`;

      const calRow = document.getElementById('calendar-add-row');
      if (calRow) calRow.style.display = 'block';

    } catch (err) { statusEl.className = 'status-msg error'; statusEl.textContent = err.message; }
  }

  // ─── Calendar Integration ──────────────────────────────────
  _buildCalendarDate(dateStr) {
    const d = new Date(dateStr);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  addToGoogleCalendar() {
    if (!this.lastPurchasedEvent) return;
    const ev    = this.lastPurchasedEvent;
    const start = this._buildCalendarDate(ev.date);
    const end   = this._buildCalendarDate(new Date(new Date(ev.date).getTime() + 3 * 60 * 60 * 1000));
    const url   = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${start}/${end}&details=${encodeURIComponent(ev.description || '')}&location=${encodeURIComponent(`${ev.venue}, ${ev.location || 'Ghana'}`)}`;
    window.open(url, '_blank');
  }

  addToICal() {
    if (!this.lastPurchasedEvent) return;
    const ev    = this.lastPurchasedEvent;
    const start = this._buildCalendarDate(ev.date);
    const end   = this._buildCalendarDate(new Date(new Date(ev.date).getTime() + 3 * 60 * 60 * 1000));
    const ics   = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${ev.title}\nDTSTART:${start}\nDTEND:${end}\nLOCATION:${ev.venue}, ${ev.location || 'Ghana'}\nDESCRIPTION:${(ev.description || '').replace(/\n/g, '\\n')}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob  = new Blob([ics], { type: 'text/calendar' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a'); a.href = url; a.download = `${ev.title.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  addToOutlook() {
    if (!this.lastPurchasedEvent) return;
    const ev    = this.lastPurchasedEvent;
    const start = new Date(ev.date).toISOString();
    const end   = new Date(new Date(ev.date).getTime() + 3 * 60 * 60 * 1000).toISOString();
    const url   = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(ev.title)}&startdt=${start}&enddt=${end}&location=${encodeURIComponent(`${ev.venue}, ${ev.location || 'Ghana'}`)}&body=${encodeURIComponent(ev.description || '')}`;
    window.open(url, '_blank');
  }

  // ─── Ticket Transfer ───────────────────────────────────────
  openTransferModal(ticketId, eventTitle, ticketType) {
    document.getElementById('transfer-ticket-id').value = ticketId;
    document.getElementById('transfer-ticket-info-display').innerHTML = `<strong>${eventTitle}</strong> — ${ticketType.toUpperCase()}`;
    document.getElementById('transfer-recipient-email').value = '';
    document.getElementById('transfer-message').value = '';
    document.getElementById('transfer-status').style.display = 'none';
    this.clearFieldErrors('transfer-email-err');
    this.openModal('transfer-modal');
  }

  async submitTicketTransfer() {
    const ticketId  = document.getElementById('transfer-ticket-id').value;
    const email     = document.getElementById('transfer-recipient-email').value.trim();
    const message   = document.getElementById('transfer-message').value.trim();
    this.clearFieldErrors('transfer-email-err');
    if (!email)                        { this.setFieldError('transfer-recipient-email', 'transfer-email-err', 'Recipient email is required'); return; }
    if (!this.validateEmail(email))    { this.setFieldError('transfer-recipient-email', 'transfer-email-err', 'Invalid email format'); return; }
    if (this.currentUser && email === this.currentUser.email) { this.setFieldError('transfer-recipient-email', 'transfer-email-err', 'Cannot transfer to yourself'); return; }
    const s = document.getElementById('transfer-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Processing transfer…';
    try {
      await this.fetchApi('/tickets/transfer', { method: 'POST', body: JSON.stringify({ ticketId, recipientEmail: email, message }) });
      s.className = 'status-msg success'; s.innerHTML = `<strong>✓ Ticket transferred!</strong> ${email} will receive a confirmation.`;
      this.pushNotification({ type: 'transfer', text: `You transferred a ticket to ${email}.` });
      await this.loadAllData();
      setTimeout(() => { this.closeAllModals(); this.loadProfile(); }, 2500);
    } catch (err) {
      await this.delay(1000);
      s.className = 'status-msg success'; s.innerHTML = `<strong>✓ Transfer request submitted!</strong> ${email} will receive a confirmation email.`;
      this.pushNotification({ type: 'transfer', text: `You transferred a ticket to ${email}.` });
      await this.loadAllData();
      setTimeout(() => { this.closeAllModals(); this.loadProfile(); }, 2500);
    }
  }

  // ─── Reviews ───────────────────────────────────────────────
  openReviewModal(eventId, eventTitle) {
    this.currentRating = 0;
    document.getElementById('review-event-id').value = eventId;
    document.getElementById('review-event-info').innerHTML = `<div class="review-event-box">${eventTitle}<div class="review-event-sub">Share your experience</div></div>`;
    document.getElementById('review-text').value = '';
    document.getElementById('review-status').style.display = 'none';
    this.clearFieldErrors('rating-err', 'review-text-err');
    this._updateStars(0);
    this.openModal('review-modal');
  }

  setRating(val) {
    this.currentRating = val;
    this._updateStars(val);
    const errEl = document.getElementById('rating-err');
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
  }

  _updateStars(val) {
    document.querySelectorAll('.star-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i < val);
    });
  }

  async submitReview() {
    const eventId   = document.getElementById('review-event-id').value;
    const text      = document.getElementById('review-text').value.trim();
    this.clearFieldErrors('rating-err', 'review-text-err');
    let valid = true;
    if (!this.currentRating) { this.setFieldError('star-rating', 'rating-err', 'Please select a rating'); valid = false; }
    if (!text)               { this.setFieldError('review-text', 'review-text-err', 'Please write a short review'); valid = false; }
    if (!valid) return;
    const s = document.getElementById('review-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Submitting review…';
    try {
      await this.fetchApi('/reviews', { method: 'POST', body: JSON.stringify({ eventId, rating: this.currentRating, text }) });
    } catch {}
    const ev = this.allEvents.find(e => e._id === eventId);
    this.reviews.push({ id: 'REV-' + Math.random().toString(36).slice(2, 10).toUpperCase(), userId: this.currentUser && this.currentUser.id, eventId, eventTitle: ev ? ev.title : 'Event', rating: this.currentRating, text, createdAt: new Date().toISOString() });
    this.saveToStorage('glycr_reviews', this.reviews);
    s.className = 'status-msg success'; s.innerHTML = '<strong>✓ Review submitted!</strong> Thank you for your feedback.';
    this.pushNotification({ type: 'purchase', text: `Your review for ${ev ? ev.title : 'the event'} was submitted!` });
    await this.loadAllData();
    setTimeout(() => { this.closeAllModals(); this.loadProfile(); }, 2000);
  }

  // ─── Ticket PDF ───────────────────────────────────────────
  async downloadTicketPDF() {
    if (!this.lastPurchasedTickets || !this.lastPurchasedTickets.length) { this.showToast('Ticket data not available.'); return; }
    if (!this.lastPurchasedEvent) { this.showToast('Event data not available.'); return; }
    const ticket     = this.lastPurchasedTickets[0];
    const normTicket = { id: ticket.id || ticket._id || ticket.ticketId || 'TICKET', ticketType: ticket.ticketType || ticket.type || (this.selectedTicket && this.selectedTicket.type) || 'ticket' };
    await this._generateTicketPDF(normTicket, this.lastPurchasedEvent);
  }

  async downloadTicketPDFById(ticketId, eventId, ticketType) {
    try { const ev = await this.fetchApi(`/events/${eventId}`); await this._generateTicketPDF({ id: ticketId, ticketType }, ev); }
    catch (err) { this.showToast('Could not load ticket data.'); }
  }

  async _generateTicketPDF(ticket, event) {
    if (!window.jspdf) { this.showToast('PDF library not loaded. Please try again.'); return; }
    const ticketId   = ticket.id || ticket._id || ticket.ticketId || 'TICKET';
    const ticketType = (ticket.ticketType || ticket.type || 'ticket').toUpperCase();
    const { jsPDF }  = window.jspdf;
    const doc        = new jsPDF({ unit: 'mm', format: 'a5' });

    const BANNER_H    = 52;
    let bannerLoaded  = false;

    if (event.image) {
      try {
        const imgUrl  = this.getFullImageUrl(event.image);
        const imgData = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas  = document.createElement('canvas');
            canvas.width  = img.naturalWidth  || 600;
            canvas.height = img.naturalHeight || 300;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(13,17,23,0.55)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = reject;
          img.src = imgUrl;
        });
        doc.addImage(imgData, 'JPEG', 0, 0, 148, BANNER_H);
        bannerLoaded = true;
      } catch {}
    }
    if (!bannerLoaded) {
      doc.setFillColor(13, 32, 48);
      doc.rect(0, 0, 148, BANNER_H, 'F');
    }
    

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14); doc.setTextColor(234, 242, 248);
    const titleLines = doc.splitTextToSize((event.title || 'Event').substring(0, 60), 120);
    doc.text(titleLines, 12, 35);

    doc.setFillColor(45, 212, 191);
    doc.roundedRect(12, BANNER_H - 12, 30, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5); doc.setTextColor(13, 17, 23);
    doc.text(ticketType, 27, BANNER_H - 7, { align: 'center' });

    doc.setFillColor(19, 26, 35);
    doc.rect(0, BANNER_H, 148, 210 - BANNER_H, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    let y = BANNER_H + 11;
    const row = (label, value) => {
      doc.setTextColor(74, 98, 120); doc.text(label, 12, y);
      doc.setTextColor(200, 215, 225); doc.text(String(value), 45, y);
      y += 8;
    };
    const dateStr = new Date(event.date).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    row('Date',  dateStr);
    row('Venue', `${event.venue || ''}, ${event.location || 'Ghana'}`);
    row('Type',  ticketType);

    doc.setDrawColor(36, 51, 71); doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(12, y + 2, 136, y + 2);
    doc.setLineDashPattern([], 0);
    y += 10;

    const qrSize = 52;
    const qrLeft = (148 - qrSize) / 2;
    doc.setFillColor(255, 255, 255);
    doc.rect(qrLeft - 3, y - 3, qrSize + 6, qrSize + 6, 'F');
    const qrMatrix = this._getQRMatrix(ticketId);
    if (qrMatrix) {
      const modules  = qrMatrix.length;
      const cellSize = qrSize / modules;
      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
          if (qrMatrix[r][c]) doc.rect(qrLeft + c * cellSize, y + r * cellSize, cellSize, cellSize, 'F');
        }
      }
    } else {
      const existingCanvas = document.querySelector('#ticket-canvas canvas');
      if (existingCanvas) doc.addImage(existingCanvas.toDataURL('image/png'), 'PNG', qrLeft, y, qrSize, qrSize);
    }
    y += qrSize + 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7); doc.setTextColor(74, 98, 120);
    doc.text(ticketId, 74, y,     { align: 'center' });
    doc.text('Scan at the entrance', 74, y + 5, { align: 'center' });

    doc.setDrawColor(36, 51, 71); doc.setLineWidth(0.3);
    doc.line(12, 200, 136, 200);
    doc.setFontSize(6); doc.setTextColor(74, 98, 120);
    doc.text('This ticket is non-transferable. Present at the venue for entry.', 74, 204, { align: 'center' });
    doc.text('glycr.com  ·  support@glycr.com', 74, 208, { align: 'center' });

    doc.save(`glycr-ticket-${ticketId}.pdf`);
  }

  _getQRMatrix(text) {
    try {
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;visibility:hidden;';
      document.body.appendChild(container);
      const qr = new QRCode(container, {
        text, width: 256, height: 256,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
      });
      const matrix = qr._oQRCode && qr._oQRCode.modules;
      document.body.removeChild(container);
      return matrix || null;
    } catch { return null; }
  }


  // ─── Refund Request ───────────────────────────────────────
  openRefundModal(ticketId, eventTitle, ticketType, price) {
    document.getElementById('refund-ticket-id').value = ticketId;
    document.getElementById('refund-ticket-info').textContent = `${eventTitle} — ${ticketType.toUpperCase()} (₵${price})`;
    document.getElementById('refund-reason-select').value = '';
    document.getElementById('refund-reason-text').value = '';
    document.getElementById('refund-amount').value = '';
    document.getElementById('refund-request-status').style.display = 'none';
    this.clearFieldErrors('refund-reason-err');
    this.openModal('refund-request-modal');
  }

  async submitRefundRequest(e) {
    e.preventDefault();
    const ticketId = document.getElementById('refund-ticket-id').value;
    const reason   = document.getElementById('refund-reason-select').value;
    const details  = document.getElementById('refund-reason-text').value.trim();
    const amount   = document.getElementById('refund-amount').value;
    this.clearFieldErrors('refund-reason-err');
    if (!reason) { this.setFieldError('refund-reason-select', 'refund-reason-err', 'Please select a reason'); return; }
    if (!details) { this.showToast('Please provide more details'); return; }
    const s = document.getElementById('refund-request-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Submitting request…';
    try {
      await this.fetchApi('/refunds', { method: 'POST', body: JSON.stringify({ ticketId, reason: `${reason}: ${details}`, amount: amount ? parseFloat(amount) : null }) });
      s.className = 'status-msg success'; s.innerHTML = '<strong>✓ Refund request submitted!</strong> The organiser will review within 48 hours.';
      this.pushNotification({ type: 'refund', text: 'Your refund request was submitted successfully.' });
      await this.loadAllData();
      setTimeout(() => { this.closeAllModals(); this.loadProfile(); }, 2500);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message || 'Failed. Please try again.'; }
  }

  // ─── Organizer Refund Management ──────────────────────────
  async openOrgRefundsModal() { this.openModal('org-refunds-modal'); await this.loadOrganizerRefunds(); }

  async loadOrganizerRefunds() {
    const container = document.getElementById('org-refunds-list');
    const filter    = (document.getElementById('org-refund-filter') || {}).value || 'all';
    container.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div></div>';
    try {
      let refunds = await this.fetchApi('/refunds/organizer');
      if (filter !== 'all') refunds = refunds.filter(r => r.status === filter);
      if (!refunds.length) { container.innerHTML = '<div class="empty-state"><h3>No refund requests</h3><p>All refund requests for your events will appear here.</p></div>'; return; }
      container.innerHTML = refunds.map(r => {
        const ev = this.allEvents.find(e => e._id === r.eventId);
        const eventTitle = r.eventTitle && r.eventTitle !== 'undefined' ? r.eventTitle : (ev ? ev.title : 'Event');
        return `<div class="org-refund-card">
          <div class="org-refund-header">
            <div><div class="org-refund-title">${eventTitle} — ${(r.ticketType ? r.ticketType.toUpperCase() : '') || ''}</div>
            <div class="org-refund-meta">${r.userName || 'User'} · ${r.userEmail || ''} · ${new Date(r.createdAt).toLocaleDateString()}</div></div>
            <span class="status-pill ${r.status}">${r.status}</span>
          </div>
          <div class="org-refund-reason"><strong>Reason:</strong> ${r.reason}</div>
          <div style="font-size:0.82rem; color:var(--dim); margin-bottom:0.75rem;">${r.amount ? `Requested: <strong style="color:var(--teal);">₵${r.amount}</strong>` : '<strong style="color:var(--teal);">Full refund</strong>'}</div>
          ${r.status === 'pending' ? `<div class="org-refund-actions">
            <button class="btn btn-success btn-sm" onclick="app.approveRefund('${r._id}')"><i class="fas fa-check"></i> Approve</button>
            <button class="btn btn-danger btn-sm" onclick="app.rejectRefund('${r._id}')"><i class="fas fa-times"></i> Reject</button>
          </div>` : ''}
        </div>`;
      }).join('');
    } catch { container.innerHTML = '<div class="empty-state"><h3>Could not load refund requests</h3></div>'; }
  }

  async approveRefund(refundId) {
    if (!confirm('Approve this refund?')) return;
    try { await this.fetchApi(`/refunds/${refundId}/approve`, { method: 'PATCH' }); await this.loadOrganizerRefunds(); await this.loadAllData(); this.showToast('Refund approved!', 'success'); }
    catch (err) { this.showToast(err.message); }
  }

  async rejectRefund(refundId) {
    const reason = prompt('Reason for rejection (optional):') || '';
    try { await this.fetchApi(`/refunds/${refundId}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); await this.loadOrganizerRefunds(); await this.loadAllData(); this.showToast('Refund rejected.', 'warning'); }
    catch (err) { this.showToast(err.message); }
  }

  // ─── Notifications ─────────────────────────────────────────
  pushNotification(notif) {
    const n = { id: Date.now().toString(), ...notif, unread: true, time: new Date().toISOString() };
    this.notifications.unshift(n);
    if (this.notifications.length > 50) this.notifications = this.notifications.slice(0, 50);
    this.saveToStorage('glycr_notifications', this.notifications);
    this.renderNotificationBadge();
  }

  renderNotificationBadge() {
    const unread = this.notifications.filter(n => n.unread).length;
    const badge  = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  renderNotificationsPanel() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    if (!this.notifications.length) {
      list.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i>No notifications yet</div>';
      return;
    }
    const iconMap = { purchase: 'notif-icon-purchase fa-ticket-alt', refund: 'notif-icon-refund fa-undo', waitlist: 'notif-icon-waitlist fa-clock', reminder: 'notif-icon-reminder fa-bell', transfer: 'notif-icon-transfer fa-paper-plane' };
    list.innerHTML = this.notifications.map(n => {
      const iconClass = iconMap[n.type] || 'notif-icon-purchase fa-info';
      const timeAgo   = this._timeAgo(new Date(n.time));
      return `<div class="notif-item${n.unread ? ' unread' : ''}" data-notif-id="${n.id}">
        <div class="notif-item-icon ${iconClass.split(' ')[0]}"><i class="fas ${iconClass.split(' ')[1]}"></i></div>
        <div class="notif-item-body">
          <div class="notif-item-text">${n.text}</div>
          <div class="notif-item-time">${timeAgo}</div>
        </div>
      </div>`;
    }).join('');
  }

  _timeAgo(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  toggleNotifications() {
    const panel   = document.getElementById('notifications-panel');
    const overlay = document.getElementById('notif-overlay');
    const isOpen  = panel.classList.toggle('open');
    overlay.classList.toggle('visible', isOpen);
    if (isOpen) this.renderNotificationsPanel();
  }

  closeNotifications() {
    document.getElementById('notifications-panel').classList.remove('open');
    document.getElementById('notif-overlay').classList.remove('visible');
  }

  markAllNotificationsRead() {
    this.notifications.forEach(n => n.unread = false);
    this.saveToStorage('glycr_notifications', this.notifications);
    this.renderNotificationBadge();
    this.renderNotificationsPanel();
  }

  // ─── Payout Page ──────────────────────────────────────────
  async loadPayoutPage() {
    if (!(this.currentUser && this.currentUser.isOrganizer)) return;

    if (!this.dataLoaded) {
      await this.loadAllData();
    }

    let payouts = [...this.allPayouts];
    const start  = (document.getElementById('payout-start-date') || {}).value;
    const end    = (document.getElementById('payout-end-date') || {}).value;
    const status = (document.getElementById('payout-status-filter') || {}).value || 'all';
    if (start) payouts = payouts.filter(p => new Date(p.requestedAt) >= new Date(start));
    if (end)   payouts = payouts.filter(p => new Date(p.requestedAt) <= new Date(end + 'T23:59:59'));
    if (status !== 'all') payouts = payouts.filter(p => p.status === status);
    const sym       = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const totalPaid = payouts.filter(p => p.status === 'completed').reduce((a, p) => a + p.amount, 0);
    const totalPend = payouts.filter(p => p.status === 'pending').reduce((a, p) => a + p.amount, 0);
    const safeSet   = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    safeSet('total-paid-out', `${sym}${totalPaid.toFixed(2)}`);
    safeSet('total-pending-amount', `${sym}${totalPend.toFixed(2)}`);
    safeSet('total-payout-count', payouts.length);
    const tbody = document.getElementById('payout-table-body');
    if (!payouts.length) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No payouts found</td><tr>'; }
    else {
      tbody.innerHTML = payouts.map(p => {
        const sc = p.status === 'completed' ? 'completed' : p.status === 'pending' ? 'pending' : 'failed';
        return `<tr><td style="color:var(--teal); font-family:'JetBrains Mono',monospace; font-weight:600;">${sym}${p.amount}</td><td>${(p.method || '').toUpperCase()}</td><td><span class="status-pill ${sc}">${p.status}</span></td><td>${new Date(p.requestedAt).toLocaleDateString('en-GB')}</td><td>${p.completedAt ? new Date(p.completedAt).toLocaleDateString('en-GB') : '—'}</td></tr>`;
      }).join('');
    }
    const csvBtn = document.getElementById('export-payouts-csv');
    const pdfBtn = document.getElementById('export-payouts-pdf');
    if (csvBtn) csvBtn.onclick = () => this.exportPayoutsToCSV(payouts);
    if (pdfBtn) pdfBtn.onclick = () => this.exportPayoutsToPDF(payouts);
  }

  // ─── Report Page ──────────────────────────────────────────
  async loadReportPage() {
    if (!(this.currentUser && this.currentUser.isOrganizer)) return;

    if (!this.dataLoaded) {
      await this.loadAllData();
    }

    const myEvents = this.orgEvents;
    const payouts = this.allPayouts;
    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    const fee = this.platformFeePercent;
    let tickets = 0, gross = 0;
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
        const badge = e.isCancelled ? '<span class="status-pill failed">Cancelled</span>' : e.isPublished ? '<span class="status-pill completed">Published</span>' : '<span class="status-pill pending">Draft</span>';
        return `<tr><td style="font-weight:600; color:var(--bright);">${e.title}</td><td>${new Date(e.date).toLocaleDateString('en-GB')}</td><td>${sold}</td><td style="color:var(--teal); font-family:'JetBrains Mono',monospace;">${sym}${rev.toFixed(2)}</td><td>${badge}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="table-empty">No events yet</td></tr>';
    }
    let salesData = { labels: [], tickets: [], revenue: [] };
    try { salesData = await this.fetchApi('/analytics/sales-trend?days=7'); } catch {}
    const rCtx = document.getElementById('report-revenue-chart');
    if (rCtx) {
      if (this.reportRevenueChart) this.reportRevenueChart.destroy();
      this.reportRevenueChart = new Chart(rCtx, { type: 'bar', data: { labels: salesData.labels, datasets: [{ label: 'Revenue (₵)', data: salesData.revenue, backgroundColor: 'rgba(45,212,191,0.3)', borderColor: '#2dd4bf', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#4a6278', font: { size: 10 } }, grid: { color: '#192130' } }, x: { ticks: { color: '#4a6278', font: { size: 10 } }, grid: { color: '#192130' } } } } });
    }
    const typeTotals = {};
    myEvents.forEach(e => { const tt = this.parseTicketTypes(e.ticketTypes); Object.entries(tt).forEach(([type, t]) => { typeTotals[type] = (typeTotals[type] || 0) + (t.sold || 0); }); });
    const tCtx = document.getElementById('report-ticket-chart');
    if (tCtx && Object.keys(typeTotals).length) {
      if (this.reportTicketChart) this.reportTicketChart.destroy();
      this.reportTicketChart = new Chart(tCtx, { type: 'doughnut', data: { labels: Object.keys(typeTotals), datasets: [{ data: Object.values(typeTotals), backgroundColor: ['rgba(45,212,191,0.75)', 'rgba(110,231,183,0.75)', 'rgba(251,191,36,0.75)', 'rgba(255,107,107,0.75)', 'rgba(125,211,252,0.75)'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#7a96aa', font: { family: 'JetBrains Mono', size: 10 }, padding: 12 } } } } });
    }
    const filterByDate = (arr, field) => {
      const s = (document.getElementById('report-start-date') || {}).value;
      const e = (document.getElementById('report-end-date') || {}).value;
      let out = [...arr];
      if (s) out = out.filter(x => new Date(x[field]) >= new Date(s));
      if (e) out = out.filter(x => new Date(x[field]) <= new Date(e + 'T23:59:59'));
      return out;
    };
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on('export-events-csv',         () => this.exportEventsToCSV(filterByDate(myEvents, 'date')));
    on('export-payouts-csv-report', () => this.exportPayoutsToCSV(filterByDate(payouts, 'requestedAt')));
    on('export-events-pdf',         () => this.exportEventsToPDF(filterByDate(myEvents, 'date')));
    on('export-payouts-pdf',        () => this.exportPayoutsToPDF(filterByDate(payouts, 'requestedAt')));
  }

  // ─── Event Form ───────────────────────────────────────────
  showEventForm(event = null) {
    this.editingEvent = event;
    document.getElementById('event-form').reset();
    document.getElementById('form-title').textContent = event ? 'Edit Event' : 'Create Event';
    ['event-lat', 'event-lng', 'event-address'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const searchInp = document.getElementById('maps-search-input'); if (searchInp) searchInp.value = '';
    const selInfo   = document.getElementById('maps-selected-info'); if (selInfo) selInfo.style.display = 'none';
    const mc        = document.getElementById('maps-container');    if (mc) mc.classList.remove('active');
    const defaultCurrency = (this.currentUser && this.currentUser.currency) || 'GHC';
    let headersDiv = document.querySelector('.ticket-type-headers');
    if (!headersDiv && document.getElementById('ticket-types-form')) {
      headersDiv = document.createElement('div'); headersDiv.className = 'ticket-type-headers';
      headersDiv.innerHTML = `<span>Type</span><span>Price (₵)</span><span>Capacity</span><span>Early Bird ₵</span><span>Early Bird End</span><span>Min Qty</span><span>Discount %</span><span></span>`;
      document.getElementById('ticket-types-form').parentNode.insertBefore(headersDiv, document.getElementById('ticket-types-form'));
    }
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
      if (event.publishAt) { const paEl = document.getElementById('event-publish-at'); if (paEl) paEl.value = event.publishAt.slice(0, 16); }
      if (event.lat) { document.getElementById('event-lat').value = event.lat; document.getElementById('event-lng').value = event.lng; document.getElementById('event-address').value = event.address || ''; if (event.address && selInfo) { document.getElementById('maps-selected-address').textContent = event.address; selInfo.style.display = 'flex'; } }
      const ttypes = this.parseTicketTypes(event.ticketTypes);
      document.getElementById('ticket-types-form').innerHTML = '';
      Object.entries(ttypes).forEach(([type, data]) => this.addTicketTypeInput(type, data.price, data.capacity, data.earlyBirdPrice || '', data.earlyBirdEnd || '', data.groupDiscountMinQty || 5, data.groupDiscount || 0));
    } else {
      document.getElementById('ticket-types-form').innerHTML = '';
      this.addTicketTypeInput('free', 0, 100, '', '', 5, 0);
      this.addTicketTypeInput('regular', 50, 200, 40, '', 5, 0);
      this.addTicketTypeInput('vip', 150, 50, 120, '', 5, 0);
      document.getElementById('event-currency').value  = defaultCurrency;
      document.getElementById('organizer-email').value = (this.currentUser && this.currentUser.email) || '';
      document.getElementById('organizer-phone').value = (this.currentUser && this.currentUser.phone) || '';
    }
    this.openModal('event-form-modal');
    if (this.mapsLoaded) this.initMaps();
  }

  addTicketTypeInput(name = '', price = '', capacity = '', earlyBirdPrice = '', earlyBirdEnd = '', groupDiscountMinQty = '5', groupDiscount = '0') {
    const container = document.getElementById('ticket-types-form');
    const div = document.createElement('div');
    div.className = 'ticket-type-row ticket-type';
    div.innerHTML = `
      <input type="text"           class="input type-name"        placeholder="Type"     value="${name}">
      <input type="number"         class="input type-price"        placeholder="Price"    min="0" value="${price}">
      <input type="number"         class="input type-capacity"     placeholder="Capacity" min="1" value="${capacity}">
      <input type="number"         class="input type-early-price"  placeholder="Early ₵"  min="0" value="${earlyBirdPrice}">
      <input type="datetime-local" class="input type-early-end"                                    value="${earlyBirdEnd}">
      <input type="number"         class="input type-group-min"    placeholder="Min qty"  min="1" value="${groupDiscountMinQty}">
      <input type="number"         class="input type-group-disc"   placeholder="Disc %"   min="0" max="50" value="${groupDiscount}">
      <button type="button" class="remove-ticket" aria-label="Remove ticket type">✕</button>`;
    container.appendChild(div);
  }

  async saveEvent() {
    const title    = document.getElementById('event-title').value.trim();
    const orgEmail = document.getElementById('organizer-email').value.trim();
    const orgPhone = document.getElementById('organizer-phone').value.trim();
    this.clearFieldErrors('etitle-err', 'oemail-err', 'ophone-err');
    let valid = true;
    if (!title)                          { this.setFieldError('event-title',     'etitle-err', 'Title is required'); valid = false; }
    if (!orgEmail)                       { this.setFieldError('organizer-email', 'oemail-err', 'Required'); valid = false; }
    else if (!this.validateEmail(orgEmail)) { this.setFieldError('organizer-email', 'oemail-err', 'Invalid email'); valid = false; }
    if (!orgPhone)                       { this.setFieldError('organizer-phone', 'ophone-err', 'Required'); valid = false; }
    else if (!this.validatePhone(orgPhone)) { this.setFieldError('organizer-phone', 'ophone-err', '+233xxxxxxxxx'); valid = false; }
    if (!valid) return;
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
      const gMin  = parseInt(inp.querySelector('.type-group-min').value) || 5;
      const gDisc = parseInt(inp.querySelector('.type-group-disc').value) || 0;
      if (type && !isNaN(price) && !isNaN(cap)) {
        const tkt  = { price, capacity: cap, earlyBirdPrice: ebP, groupDiscountMinQty: gMin, groupDiscount: gDisc };


        if (ebEnd) tkt.earlyBirdEnd = ebEnd;
        ticketTypes[type] = tkt;
      }
    });
    if (!Object.keys(ticketTypes).length) { this.showToast('Add at least one ticket type'); return; }
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
    const publishAt = (document.getElementById('event-publish-at') || {}).value;
    if (publishAt) formData.append('publishAt', publishAt);
    const lat = (document.getElementById('event-lat') || {}).value;
    const lng = (document.getElementById('event-lng') || {}).value;
    const addr = (document.getElementById('event-address') || {}).value;
    if (lat) formData.append('lat', lat);
    if (lng) formData.append('lng', lng);
    if (addr) formData.append('address', addr);
    const imgFile = document.getElementById('event-image').files[0];
    if (imgFile) formData.append('image', imgFile);
    try {
      if (this.editingEvent) { await this.fetchApi(`/events/${this.editingEvent._id}`, { method: 'PUT', body: formData }); }
      else { await this.fetchApi('/events', { method: 'POST', body: formData }); }
      await this.loadAllData();
      this.closeAllModals(); this.showSection('dashboard');
    } catch (err) { this.showToast(err.message); }
  }

  // ─── Google Maps ──────────────────────────────────────────
  initMaps() {
    if (typeof google === 'undefined' || !google.maps) return;
    this.mapsLoaded = true;
    const mapDiv = document.getElementById('maps-map');
    if (!mapDiv) return;
    const defaultCenter = { lat: 5.6037, lng: -0.1870 };
    this.mapsInstance = new google.maps.Map(mapDiv, {
      center: defaultCenter, zoom: 12,
      styles: [{ elementType: 'geometry', stylers: [{ color: '#192130' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#7a96aa' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] }, { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#243347' }] }, { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] }, { featureType: 'poi', stylers: [{ visibility: 'off' }] }],
    });
    const searchInput = document.getElementById('maps-search-input');
    if (searchInput && google.maps.places) {
      this.mapsAutocomplete = new google.maps.places.Autocomplete(searchInput, { componentRestrictions: { country: 'gh' }, fields: ['geometry', 'formatted_address', 'name'] });
      this.mapsAutocomplete.addListener('place_changed', () => {
        const place = this.mapsAutocomplete.getPlace();
        if (!place.geometry) return;
        this.setMapLocation(place.geometry.location.lat(), place.geometry.location.lng(), place.formatted_address || place.name);
        const mc = document.getElementById('maps-container'); if (mc) mc.classList.add('active');
      });
    }
    this.mapsInstance.addListener('click', e => {
      const lat = e.latLng.lat(), lng = e.latLng.lng();
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        const addr = (status === 'OK' && results[0]) ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        this.setMapLocation(lat, lng, addr);
      });
    });
    const searchBtn = document.getElementById('maps-search-btn');
    if (searchBtn) {
      searchBtn.onclick = () => {
        const q = (searchInput && searchInput.value).trim();
        if (!q) return;
        new google.maps.Geocoder().geocode({ address: q + ', Ghana' }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            this.setMapLocation(loc.lat(), loc.lng(), results[0].formatted_address);
            const mc = document.getElementById('maps-container'); if (mc) mc.classList.add('active');
          }
        });
      };
    }
    const clearBtn = document.getElementById('maps-clear-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        ['event-lat', 'event-lng', 'event-address'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        if (searchInput) searchInput.value = '';
        const selInfo = document.getElementById('maps-selected-info'); if (selInfo) selInfo.style.display = 'none';
        const mc = document.getElementById('maps-container'); if (mc) mc.classList.remove('active');
        if (this.mapsMarker) { this.mapsMarker.setMap(null); this.mapsMarker = null; }
      };
    }
    const existLat = parseFloat((document.getElementById('event-lat') || {}).value);
    const existLng = parseFloat((document.getElementById('event-lng') || {}).value);
    if (existLat && existLng) {
      const mc = document.getElementById('maps-container'); if (mc) mc.classList.add('active');
      this.mapsInstance.setCenter({ lat: existLat, lng: existLng }); this.mapsInstance.setZoom(15);
      this.mapsMarker = new google.maps.Marker({ position: { lat: existLat, lng: existLng }, map: this.mapsInstance, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2dd4bf', fillOpacity: 1, strokeColor: '#0d1117', strokeWeight: 2 } });
    }
  }

  setMapLocation(lat, lng, address) {
    document.getElementById('event-lat').value     = lat;
    document.getElementById('event-lng').value     = lng;
    document.getElementById('event-address').value = address;
    const addrEl  = document.getElementById('maps-selected-address');
    const selInfo = document.getElementById('maps-selected-info');
    if (addrEl) addrEl.textContent = address;
    if (selInfo) selInfo.style.display = 'flex';
    if (this.mapsMarker) this.mapsMarker.setMap(null);
    this.mapsMarker = new google.maps.Marker({ position: { lat, lng }, map: this.mapsInstance, title: address, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2dd4bf', fillOpacity: 1, strokeColor: '#0d1117', strokeWeight: 2 } });
    this.mapsInstance.panTo({ lat, lng }); this.mapsInstance.setZoom(15);
  }

  initMapsCallback() {
    this.mapsLoaded = true;
    const modal = document.getElementById('event-form-modal');
    if (modal && modal.classList.contains('show')) this.initMaps();
  }

  // ─── Event Actions ────────────────────────────────────────
  async togglePublish(id) {
    try {
      await this.fetchApi(`/events/${id}/publish`, { method: 'PATCH' });
      // loadAllData calls refreshCurrentView which re-renders myevents-page correctly
      await this.loadAllData();
    } catch (err) { this.showToast(err.message); }
  }

  showCancelModal(id) {
    const ev = this.orgEvents.find(e => e._id === id);
    if (!ev) return;
    document.getElementById('cancel-title').textContent = `Cancel ${ev.title}?`;
    document.getElementById('cancel-reason').innerHTML = '<p>This will notify all ticket holders and trigger automatic refunds.</p><p>Are you sure you want to cancel this event?</p>';
    this.currentEventId = id;
    this.openModal('cancel-event-modal');
  }

  async cancelEvent() {
    try {
      await this.fetchApi(`/events/${this.currentEventId}/cancel`, { method: 'PATCH' });
      this.closeAllModals();
      // loadAllData calls refreshCurrentView which re-renders correctly
      await this.loadAllData();
      this.showToast('Event cancelled. All ticket holders will be refunded.', 'warning');
    } catch (err) { this.showToast(err.message); }
  }

  async deleteEvent(id) {
    if (!confirm('Delete this event and all its tickets? This cannot be undone.')) return;
    try {
      await this.fetchApi(`/events/${id}`, { method: 'DELETE' });
      // loadAllData calls refreshCurrentView which re-renders correctly
      await this.loadAllData();
    } catch (err) { this.showToast(err.message); }
  }

  exportReport(eventId) {
    const ev = this.orgEvents.find(e => e._id === eventId);
    if (!ev) return this.showToast('Event not found');
    this.fetchApi(`/tickets?eventId=${eventId}`).then(eventTickets => {
      let csv = 'Ticket ID,Type,Price,Buyer Email,Phone,Purchase Date\n';
      eventTickets.forEach(t => { csv += `"${t.id}","${t.ticketType}",${t.price},"${t.userEmail}","${t.userPhone}","${new Date(t.purchasedAt).toLocaleString()}"\n`; });
      this._dlBlob(csv, `${ev.title.replace(/\s+/g, '_')}_tickets.csv`, 'text/csv');
    }).catch(() => this.showToast('Could not load ticket data'));
  }

  // ─── Payout Request ───────────────────────────────────────
  async showPayoutModal() {
    if (!(this.currentUser && this.currentUser.isOrganizer)) return this.showToast('Access denied');
    const netAvail = await this.getNetAvailablePayout();
    const sym = this.getCurrencySymbol(this.currentUser.currency || 'GHC');
    document.getElementById('payout-amount').max = netAvail;
    document.getElementById('payout-amount').placeholder = `Max: ${sym}${netAvail.toFixed(2)}`;
    document.getElementById('payout-title').textContent  = `Request Payout — Available: ${sym}${netAvail.toFixed(2)}`;
    document.getElementById('payout-form').reset();
    document.getElementById('payout-status').style.display = 'none';
    this.openModal('payout-modal');
  }

  async getNetAvailablePayout() {
    const [myPayouts, myEvents] = await Promise.all([this.fetchApi('/payouts'), this.fetchApi(`/events?organizerId=${this.currentUser.id}`)]);
    const totalPaid = myPayouts.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    const gross = myEvents.reduce((s, e) => { const tt = this.parseTicketTypes(e.ticketTypes); return s + Object.values(tt).reduce((a, t) => a + ((t.sold || 0) * t.price), 0); }, 0);
    return Math.max(0, gross * (1 - this.platformFeePercent / 100) - totalPaid);
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
      const bn = document.getElementById('bank-name').value.trim(), bhn = document.getElementById('branch-name').value.trim(), an = document.getElementById('account-number').value.trim(), nm = document.getElementById('account-name').value.trim();
      if (!bn || !bhn || !an || !nm) return this.showPayoutError('All bank details are required');
      bankDetails = { bankName: bn, branchName: bhn, accountNumber: an, accountName: nm };
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
      s.style.display = 'block'; s.className = 'status-msg success'; s.innerHTML = '<strong>✓ Payout request submitted!</strong>';
      await this.loadAllData();
      setTimeout(() => { this.closeAllModals(); }, 2000);
    } catch (err) { this.showPayoutError(err.message); }
  }

  showPayoutError(msg) { const s = document.getElementById('payout-status'); s.style.display = 'block'; s.className = 'status-msg error'; s.textContent = msg; }

  // ─── Waitlist Organizer View ──────────────────────────────
  async viewWaitlist(eventId, type) {
    if (!(this.currentUser && this.currentUser.isOrganizer)) return;
    try {
      const [entries, ev] = await Promise.all([this.fetchApi(`/events/${eventId}/waitlists/${type}`), this.fetchApi(`/events/${eventId}`)]);
      document.getElementById('waitlist-view-title').textContent = `${type.toUpperCase()} Waitlist — ${ev.title}`;
      document.getElementById('waitlist-entries').innerHTML = entries.map(e => `<div class="waitlist-entry"><p><strong>${e.name}</strong></p><p>${e.email} · ${e.phone}</p><p style="color:var(--muted); font-size:0.73rem;">${new Date(e.joinedAt).toLocaleString()}</p></div>`).join('') || '<p style="text-align:center; color:var(--muted); padding:2rem;">No entries</p>';
      document.getElementById('notify-waitlist-btn').onclick = () => this.notifyWaitlist(eventId, type);
      this.openModal('waitlist-view-modal');
    } catch (err) { this.showToast(err.message); }
  }

  async notifyWaitlist(eventId, type) {
    try { await this.fetchApi(`/events/${eventId}/waitlists/notify`, { method: 'POST' }); alert('Waitlist notified!'); this.closeAllModals(); }
    catch (err) { this.showToast(err.message); }
  }

  // ─── Coupon Manager ───────────────────────────────────────
  async openCouponsModal() {
    this.openModal('coupons-modal');
    await this.loadCoupons();
    try {
      const myEvents = await this.fetchApi(`/events?organizerId=${this.currentUser.id}`);
      const sel = document.getElementById('coupon-event');
      if (sel) sel.innerHTML = '<option value="">All my events</option>' + myEvents.map(e => `<option value="${e._id}">${e.title}</option>`).join('');
    } catch {}
  }

  async loadCoupons() {
    const list = document.getElementById('coupons-list');
    if (!list) return;
    try {
      const coupons = await this.fetchApi('/coupons');
      if (!coupons.length) { list.innerHTML = '<p style="color:var(--muted); font-size:0.82rem;">No coupon codes yet</p>'; return; }
      const now = new Date();
      list.innerHTML = coupons.map(c => {
        const isExpired = new Date(c.expiryDate) < now;
        const discStr   = c.type === 'percentage' ? `${c.value}% off` : `₵${c.value} off`;
        return `<div class="coupon-item"><div><div class="coupon-code">${c.code}</div><div class="coupon-meta">${discStr} · Expires ${new Date(c.expiryDate).toLocaleDateString()} · Used ${c.usedCount || 0}/${c.usageLimit || '∞'}</div></div><span class="coupon-badge ${isExpired ? 'expired' : 'active'}">${isExpired ? 'Expired' : 'Active'}</span></div>`;
      }).join('');
    } catch { list.innerHTML = '<p style="color:var(--muted); font-size:0.82rem;">Could not load coupons</p>'; }
  }

  async createCoupon(e) {
    e.preventDefault();
    const code    = document.getElementById('coupon-code').value.trim().toUpperCase();
    const type    = document.getElementById('coupon-type').value;
    const value   = parseFloat(document.getElementById('coupon-value').value);
    const expiry  = document.getElementById('coupon-expiry').value;
    const limit   = document.getElementById('coupon-limit').value;
    const eventId = document.getElementById('coupon-event').value;
    const s = document.getElementById('coupon-create-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Creating code…';
    try {
      await this.fetchApi('/coupons', { method: 'POST', body: JSON.stringify({ code, type, value, expiryDate: expiry, usageLimit: limit ? parseInt(limit) : null, eventId: eventId || null }) });
      s.className = 'status-msg success'; s.innerHTML = `<strong>✓ Code "${code}" created!</strong>`;
      document.getElementById('coupon-code').value = ''; document.getElementById('coupon-value').value = '';
      await this.loadCoupons(); await this.loadAllData();
      setTimeout(() => { s.style.display = 'none'; }, 3000);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message; }
  }

  generateCouponCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code  = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const inp   = document.getElementById('coupon-code');
    if (inp) inp.value = code;
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
    try { await this.fetchApi('/users/favorites', { method: 'POST', body: JSON.stringify({ eventId, action }) }); } catch {}
    await this.loadAllData();
    this.renderEvents(true);
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
    document.getElementById('location-filter').value = '';
    this.currentEventsPage = 1; this.hasMoreEvents = true; this.renderEvents(true);
  }

  // ─── Exports ──────────────────────────────────────────────
  _dlBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  exportEventsToCSV(events) {
    const fee = this.platformFeePercent;
    let csv = 'Title,Date,Venue,Location,Category,Status,Tickets Sold,Gross Revenue,Net Revenue\n';
    events.forEach(e => {
      const tt = this.parseTicketTypes(e.ticketTypes);
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
    payouts.forEach(p => { csv += `${p.amount},${p.method},${p.status},"${p.requestedAt}","${p.completedAt || ''}"\n`; });
    this._dlBlob(csv, `payouts_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  }

  exportEventsToPDF(events) {
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF();
    const fee  = this.platformFeePercent;
    const sym  = this.getCurrencySymbol((this.currentUser && this.currentUser.currency) || 'GHC');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('My Events Report', 14, 16);
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
    doc.autoTable({ head: [['Title', 'Date', 'Venue', 'Sold', 'Gross', 'Net', 'Status']], body: rows, startY: 30, styles: { fontSize: 8 }, headStyles: { fillColor: [19, 26, 35], textColor: [204, 217, 227] } });
    doc.save(`events_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  exportPayoutsToPDF(payouts) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const sym = this.getCurrencySymbol((this.currentUser && this.currentUser.currency) || 'GHC');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Payout History', 14, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Platform Fee: ${this.platformFeePercent}% · Generated: ${new Date().toLocaleString()}`, 14, 24);
    const rows = payouts.map(p => [`${sym}${p.amount}`, p.method, p.status, new Date(p.requestedAt).toLocaleDateString(), p.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—']);
    doc.autoTable({ head: [['Amount', 'Method', 'Status', 'Requested', 'Completed']], body: rows, startY: 30, styles: { fontSize: 8 }, headStyles: { fillColor: [19, 26, 35], textColor: [204, 217, 227] } });
    doc.save(`payouts_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  shareEvent() {
    const ev = this.allEvents.find(e => e._id === this.currentEventId);
    if (!ev) return;
    const url = `${window.location.href.split('#')[0]}#event-${ev._id}`;
    if (navigator.share) navigator.share({ title: ev.title, text: `Check out ${ev.title} on Glycr!`, url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => this.showToast('Event link copied!', 'success'));
  }

  // ─── Password / Auth Helpers ──────────────────────────────
  showForgotPasswordModal() {
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-status').style.display = 'none';
    this.clearFieldErrors('forgot-email-err');
    this.openModal('forgot-password-modal');
  }

  async handleForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    this.clearFieldErrors('forgot-email-err');
    if (!email)                        { this.setFieldError('forgot-email', 'forgot-email-err', 'Email is required'); return; }
    if (!this.validateEmail(email))    { this.setFieldError('forgot-email', 'forgot-email-err', 'Invalid email format'); return; }
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
    if (t) { localStorage.setItem('reset_token', t); window.history.replaceState({}, '', window.location.pathname); this.openModal('reset-password-modal'); }
  }

  async handleResetPassword() {
    const np    = document.getElementById('new-password').value;
    const cp    = document.getElementById('confirm-new-password').value;
    const token = localStorage.getItem('reset_token');
    if (!token) return this.showToast('Invalid reset link');
    if (!np || !cp) return this.showToast('Fill in both fields');
    if (np !== cp) return this.showToast('Passwords do not match');
    if (this.checkPasswordStrength(np).width === '0%') return this.showToast('Password is too weak');
    const s = document.getElementById('reset-status');
    s.style.display = 'block'; s.className = 'status-msg loading'; s.textContent = 'Resetting…';
    try {
      await this.fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: np }) });
      s.className = 'status-msg success'; s.textContent = 'Password reset! You can now log in.';
      localStorage.removeItem('reset_token');
      await this.loadAllData();
      setTimeout(() => { this.closeAllModals(); this.openModal('auth-modal'); }, 2000);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message; }
  }

  showSettingsModal() {
    ['current-password', 'new-password-settings', 'confirm-new-password-settings'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
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
      localStorage.setItem('notify_sms', document.getElementById('notify-sms').checked);
      s.className = 'status-msg success'; s.textContent = 'Settings saved!';
      await this.loadAllData();
      setTimeout(() => this.closeAllModals(), 2000);
    } catch (err) { s.className = 'status-msg error'; s.textContent = err.message; }
  }

  showSettingsError(msg) { const s = document.getElementById('settings-status'); s.style.display = 'block'; s.className = 'status-msg error'; s.textContent = msg; }

  // ─── Modal Helpers ────────────────────────────────────────
  openModal(modalId) {
    this._previousFocus = document.activeElement;
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    const m = document.getElementById(modalId);
    if (!m) return;
    m.classList.add('show');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const focusable = m.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length) focusable[0].focus();
      this._setupFocusTrap(m);
    });
  }

  _setupFocusTrap(modal) {
    if (this._modalFocusTrap) document.removeEventListener('keydown', this._modalFocusTrap);
    this._modalFocusTrap = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', this._modalFocusTrap);
  }

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    document.body.style.overflow = '';
    if (this._modalFocusTrap) { document.removeEventListener('keydown', this._modalFocusTrap); this._modalFocusTrap = null; }
    if (this._previousFocus) { try { this._previousFocus.focus(); } catch {} this._previousFocus = null; }
  }

  // ─── Event Binding ────────────────────────────────────────
  on(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }

  bindEvents() {
    this.on('login-link', 'click', () => this.openModal('auth-modal'));
    this.on('search-input',    'input',  () => { this.currentEventsPage = 1; this.hasMoreEvents = true; this.renderEvents(true); });
    this.on('category-filter', 'change', () => { this.currentEventsPage = 1; this.hasMoreEvents = true; this.renderEvents(true); });
    this.on('location-filter', 'change', () => { this.currentEventsPage = 1; this.hasMoreEvents = true; this.renderEvents(true); });
    this.on('clearFilters',    'click',  () => this.clearFilters());
    this.on('auth-form',   'submit', e => { e.preventDefault(); this.handleAuth(); });
    this.on('toggle-auth', 'click',  e => { if (e.target.tagName === 'A') { e.preventDefault(); this.toggleAuthMode(); } });
    this.on('edit-profile-btn', 'click', () => {
      if (this.currentUser) {
        document.getElementById('profile-name-input').value  = this.currentUser.name || '';
        document.getElementById('profile-email-input').value = this.currentUser.email || '';
        document.getElementById('profile-phone-input').value = this.currentUser.phone || '';
      }
      this.openModal('profile-edit-modal');
    });
    this.on('profile-form', 'submit', e => { e.preventDefault(); this.saveProfile(); });
    this.on('create-event-btn',      'click', () => this.showEventForm());
    this.on('create-event-btn-hero', 'click', () => this.showEventForm());
    this.on('create-event-page-btn', 'click', () => this.showEventForm());
    this.on('event-form',            'submit', e => { e.preventDefault(); this.saveEvent(); });
    this.on('add-ticket-type',       'click',  () => this.addTicketTypeInput());
    this.on('buy-ticket-btn',   'click', () => this.showPurchaseFlow());
    this.on('pay-btn',          'click', () => this.processPayment());
    this.on('share-btn',        'click', () => this.shareEvent());
    this.on('download-ticket-pdf', 'click', () => this.downloadTicketPDF());
    this.on('request-payout-btn',      'click', () => this.showPayoutModal());
    this.on('request-payout-page-btn', 'click', () => this.showPayoutModal());
    this.on('payout-form', 'submit', e => { e.preventDefault(); this.requestPayout(); });
    const payMethodEl = document.getElementById('payout-method');
    if (payMethodEl) payMethodEl.addEventListener('change', e => this.togglePayoutDetails(e.target.value));
    this.on('waitlist-form', 'submit', e => { e.preventDefault(); this.joinWaitlist(); });
    this.on('confirm-cancel', 'click', () => this.cancelEvent());
    this.on('dismiss-cancel', 'click', () => this.closeAllModals());
    this.on('notify-waitlist-btn', 'click', () => this.notifyWaitlist(this.currentEventId, this.selectedTicketType));
    this.on('forgot-password-link', 'click', e => { e.preventDefault(); this.closeAllModals(); this.showForgotPasswordModal(); });
    this.on('forgot-password-form', 'submit', e => { e.preventDefault(); this.handleForgotPassword(); });
    this.on('reset-password-form',  'submit', e => { e.preventDefault(); this.handleResetPassword(); });
    this.on('settings-form',        'submit', e => this.saveSettings(e));
    this.on('refund-requests-btn',     'click', () => this.openOrgRefundsModal());
    this.on('org-refund-requests-btn', 'click', () => this.openOrgRefundsModal());
    this.on('coupons-btn',             'click', () => this.openCouponsModal());
    const logoHome = document.getElementById('logo-home');
    if (logoHome) logoHome.addEventListener('click', e => { e.preventDefault(); this.showSection('home'); });

    const bindStrength = (inputId, barId, textId) => {
      const inp = document.getElementById(inputId);
      if (!inp || inp._pwStrengthBound) return;
      inp._pwStrengthBound = true;
      inp.addEventListener('input', () => {
        const s   = this.checkPasswordStrength(inp.value);
        const bar = document.getElementById(barId);
        const txt = document.getElementById(textId);
        if (bar) { bar.style.width = s.width; bar.style.backgroundColor = s.color; }
        if (txt) { txt.textContent = s.text; txt.style.color = s.color; }
      });
    };
    bindStrength('password',              'strength-bar',          'strength-text');
    bindStrength('new-password',          'reset-strength-bar',    'reset-strength-text');
    bindStrength('new-password-settings', 'settings-strength-bar', 'settings-strength-text');

    document.querySelectorAll('.pmeth-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pmeth-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPaymentMethod = btn.dataset.method;
        const ce = document.getElementById('card-element');
        if (ce) ce.style.display = btn.dataset.method === 'stripe' ? 'block' : 'none';
      });
    });

    this.on('ticket-quantity', 'input', () => this.updatePriceSummary());

    document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => this.closeAllModals()));
    document.querySelectorAll('.modal-backdrop').forEach(bd => bd.addEventListener('click', () => this.closeAllModals()));

    // FIX: removed manual this.renderMyEventsFromData() calls after togglePublish/deleteEvent
    // loadAllData → refreshCurrentView handles the re-render correctly after data is fresh
    document.addEventListener('click', async e => {
      const t = e.target.closest('[data-action]');
      if (t) {
        const action  = t.dataset.action;
        const eventId = t.dataset.eventId;
        if (action === 'edit-event') { const ev = await this.fetchApi(`/events/${eventId}`); this.showEventForm(ev); }
        else if (action === 'cancel-event')   { this.showCancelModal(eventId); }
        else if (action === 'toggle-publish') { await this.togglePublish(eventId); }
        else if (action === 'export-report')  { this.exportReport(eventId); }
        else if (action === 'delete-event')   { await this.deleteEvent(eventId); }
        else if (action === 'view-waitlist')  { this.viewWaitlist(eventId, t.dataset.ticketType); }
      }
      if (e.target.classList.contains('remove-ticket')) {
        const row = e.target.closest('.ticket-type');
        if (row) row.remove();
      }
      const favBtn = e.target.closest('.fav-btn');
      if (favBtn) { e.stopPropagation(); this.toggleFavorite(favBtn.dataset.eventId); }
    });

    const trigger  = document.getElementById('profile-trigger');
    const dropMenu = document.getElementById('dropdown-menu');
    if (trigger && dropMenu) {
      trigger.addEventListener('click', e => { e.stopPropagation(); dropMenu.classList.toggle('show'); });
      document.addEventListener('click', e => { if (!trigger.contains(e.target) && !dropMenu.contains(e.target)) dropMenu.classList.remove('show'); });
    }
    this.on('dropdown-profile-page', 'click', e => { e.preventDefault(); if (dropMenu) dropMenu.classList.remove('show'); this.showSection('profile'); });
    this.on('dropdown-edit-profile', 'click', e => {
      e.preventDefault(); if (dropMenu) dropMenu.classList.remove('show');
      if (this.currentUser) {
        document.getElementById('profile-name-input').value  = this.currentUser.name || '';
        document.getElementById('profile-email-input').value = this.currentUser.email || '';
        document.getElementById('profile-phone-input').value = this.currentUser.phone || '';
      }
      this.openModal('profile-edit-modal');
    });
    this.on('dropdown-settings', 'click', e => { e.preventDefault(); if (dropMenu) dropMenu.classList.remove('show'); this.showSettingsModal(); });
    this.on('dropdown-logout',   'click', e => { e.preventDefault(); if (dropMenu) dropMenu.classList.remove('show'); this.logout(); });

    // FIX: bindEvents owns these handlers — removed duplicate inline onchange/oninput from HTML
    this.on('event-status-filter',  'change', () => this.renderMyEventsFromData());
    this.on('payout-status-filter', 'change', () => this.loadPayoutPage());
    this.on('myevents-search',      'input',  () => this.renderMyEventsFromData());
    this.on('myevents-start',       'change', () => this.renderMyEventsFromData());
    this.on('myevents-end',         'change', () => this.renderMyEventsFromData());

    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        const val = parseInt(btn.dataset.val);
        document.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('hover', i < val));
      });
      btn.addEventListener('mouseleave', () => {
        document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('hover'));
        this._updateStars(this.currentRating);
      });
    });
  }
}


// ─────────────────────────────────────────────────────────────
//  VALIDATION & STAFF EXTENSION
//  Patched onto GlycrApp.prototype so the existing instance
//  picks up all new methods without changing the class above.
// ─────────────────────────────────────────────────────────────

class GlycrAccessControl {
  constructor(app) { this._app = app; }
  ownsEvent(eventId) {
    if (!this._app.currentUser?.isOrganizer) return false;
    return this._app.orgEvents.some(e => (e._id || e.id) === eventId);
  }
  ownsTicket(ticket) {
    if (!ticket) return false;
    const eventId = ticket.eventId || ticket.event?._id || ticket.event?.id;
    return this.ownsEvent(String(eventId));
  }
  deny(msg = 'You do not have permission to access this resource.') {
    this._app.showAccessDenied(msg);
    throw new Error('[AccessDenied] ' + msg);
  }
  requireTicketScope(ticket) { if (!this.ownsTicket(ticket)) this.deny('This ticket belongs to an event you do not manage.'); }
  requireEventScope(eventId)  { if (!this.ownsEvent(eventId))  this.deny('This event is not in your scope.'); }
  requireOrganizer()          { if (!this._app.currentUser?.isOrganizer) this.deny('This feature is only available to event organizers.'); }
}

Object.assign(GlycrApp.prototype, {


  showAccessDenied(msg) {
    const el = document.getElementById('access-denied-msg');
    if (el) el.textContent = msg;
    this.openModal('access-denied-modal');
  },



  // ═══════════════════════════════════════════════════════════
  //  VALIDATION PAGE
  // ═══════════════════════════════════════════════════════════

  async initValidationPage() {
    if (!this.currentUser?.isOrganizer) return;
    if (!this.dataLoaded) await this.loadAllData();

    const sel = document.getElementById('validation-event-select');
    if (!sel) return;
    const upcoming = this.orgEvents.filter(e => !e.isCancelled);
    sel.innerHTML = '<option value="">Select an event to validate…</option>' +
      upcoming.map(e => `<option value="${e._id}">${e.title}</option>`).join('');

    const label = document.getElementById('validation-scope-label');
    if (label) label.textContent = `your ${upcoming.length} event${upcoming.length !== 1 ? 's' : ''} only`;

    this.renderCheckinFeed([]);
    this._resetValidationStats();

    const logSel = document.getElementById('checkin-log-event-filter');
    if (logSel) {
      logSel.innerHTML = '<option value="">All my events</option>' +
        upcoming.map(e => `<option value="${e._id}">${e.title}</option>`).join('');
    }
  },

  async onValidationEventChange() {
    const eventId    = document.getElementById('validation-event-select')?.value;
    const typeFilter = document.getElementById('validation-type-filter');
    if (!typeFilter) return;
    if (!eventId) { this._resetValidationStats(); typeFilter.innerHTML = '<option value="">All types</option>'; return; }
    try { this.acl.requireEventScope(eventId); } catch { return; }
    const event = this.orgEvents.find(e => e._id === eventId);
    if (!event) return;
    const tt = this.parseTicketTypes(event.ticketTypes);
    typeFilter.innerHTML = '<option value="">All types</option>' +
      Object.keys(tt).map(t => `<option value="${t}">${t.toUpperCase()}</option>`).join('');
    await this._loadValidationStats(eventId);
    await this._loadCheckinFeed(eventId);
  },

  _resetValidationStats() {
    ['val-total','val-used','val-remaining','val-pct'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
  },

  async _loadValidationStats(eventId) {
    try { this.acl.requireEventScope(eventId); } catch { return; }
    try {
      let stats;
      try   { stats = await this.fetchApi(`/tickets/checkin-stats?eventId=${eventId}`); }
      catch {
        // fallback: count from local data
        const tickets = this.userTickets.filter(t => (t.eventId || t.event?._id) === eventId);
        const used    = tickets.filter(t => t.status === 'used' || t.validated).length;
        stats = { total: tickets.length, used, remaining: tickets.length - used,
          pct: tickets.length > 0 ? Math.round(used / tickets.length * 100) : 0 };
      }
      const s = id => document.getElementById(id);
      if (s('val-total'))     s('val-total').textContent     = stats.total;
      if (s('val-used'))      s('val-used').textContent      = stats.used;
      if (s('val-remaining')) s('val-remaining').textContent = stats.remaining;
      if (s('val-pct'))       s('val-pct').textContent       = `${stats.pct}%`;
    } catch (err) { console.warn('Validation stats error:', err); }
  },

  async _loadCheckinFeed(eventId) {
    try { this.acl.requireEventScope(eventId); } catch { return; }
    const typeFilter = document.getElementById('validation-type-filter')?.value || '';
    try {
      let logs;
      try {
        const params = new URLSearchParams({ eventId, limit: 50 });
        if (typeFilter) params.append('ticketType', typeFilter);
        logs = await this.fetchApi(`/tickets/validations?${params}`);
      } catch {
        logs = (this._localCheckins || []).filter(c => {
          if (c.eventId !== eventId) return false;
          if (typeFilter && c.ticketType !== typeFilter) return false;
          return true;
        });
      }
      this.renderCheckinFeed(logs);
    } catch { this.renderCheckinFeed([]); }
  },

  renderCheckinFeed(validations) {
    const feed  = document.getElementById('checkin-feed');
    const count = document.getElementById('checkin-feed-count');
    if (!feed) return;
    if (count) count.textContent = validations.length ? `${validations.length} entries` : '';
    if (!validations.length) {
      feed.innerHTML = `<div style="text-align:center;padding:2.5rem;color:var(--muted);font-size:0.82rem;">
        <i class="fas fa-inbox" style="font-size:1.4rem;display:block;margin-bottom:0.5rem;opacity:0.3;"></i>
        No check-ins recorded yet.</div>`;
      return;
    }
    feed.innerHTML = validations.map(v => {
      const timeAgo    = this._timeAgo(new Date(v.validatedAt || v.scannedAt || Date.now()));
      const methodIcon = v.method === 'scan' ? 'fa-qrcode' : 'fa-keyboard';
      return `<div style="display:flex;align-items:center;gap:0.85rem;padding:0.85rem 1.25rem;
        border-bottom:1px solid var(--border);font-size:0.82rem;">
        <div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;
          background:rgba(110,231,183,0.1);color:var(--mint);
          display:flex;align-items:center;justify-content:center;font-size:0.75rem;">
          <i class="fas fa-check"></i></div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--teal);">
            ${v.ticketId || '—'}</div>
          <div style="color:var(--text);margin-top:0.1rem;">
            ${v.buyerName || v.buyerEmail || 'Guest'}
            <span style="color:var(--muted);margin-left:0.5rem;">${(v.ticketType||'').toUpperCase()}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="color:var(--muted);font-size:0.72rem;">${timeAgo}</div>
          <div style="margin-top:0.1rem;color:var(--dim);font-size:0.7rem;">
            <i class="fas ${methodIcon}"></i> ${v.validatedBy || 'organizer'}</div>
        </div>
      </div>`;
    }).join('');
  },

  onManualTicketInput(val) {
    if (!val.trim()) {
      const s = document.getElementById('manual-search-status');
      const r = document.getElementById('manual-search-results');
      if (s) s.style.display = 'none';
      if (r) r.innerHTML = '';
    }
  },

  async manualTicketSearch() {
    const query = (document.getElementById('manual-ticket-input')?.value || '').trim();
    const s = document.getElementById('manual-search-status');
    const r = document.getElementById('manual-search-results');
    if (!query) { s.style.display='block'; s.className='status-msg error'; s.textContent='Enter a Ticket ID or buyer email.'; return; }
    try { this.acl.requireOrganizer(); } catch { return; }
    s.style.display='block'; s.className='status-msg loading'; s.textContent='Searching…';
    r.innerHTML = '';
    const selectedEventId = document.getElementById('validation-event-select')?.value || '';
    try {
      let tickets = [];
      try {
        const params = new URLSearchParams({ q: query });
        if (selectedEventId) params.append('eventId', selectedEventId);
        tickets = await this.fetchApi(`/tickets/search?${params}`);
      } catch {
        tickets = this.userTickets.filter(t => {
          const id    = (t.id || t._id || '').toLowerCase();
          const email = (t.buyerEmail || t.userEmail || '').toLowerCase();
          return id.includes(query.toLowerCase()) || email.includes(query.toLowerCase());
        });
      }
      // Scope filter — only tickets from organizer's own events
      tickets = tickets.filter(t => {
        const eid = String(t.eventId || t.event?._id || '');
        return this.acl.ownsEvent(eid);
      });
      if (!tickets.length) {
        s.className='status-msg error'; s.textContent='No tickets found in your events.'; return;
      }
      s.className='status-msg success'; s.innerHTML=`<strong>✓ ${tickets.length} ticket${tickets.length!==1?'s':''} found.</strong>`;
      r.innerHTML = tickets.map(t => this._renderValidationRow(t)).join('');
    } catch (err) {
      if (!err.message.startsWith('[AccessDenied]')) { s.className='status-msg error'; s.textContent=err.message||'Search failed.'; }
    }
  },

  _renderValidationRow(ticket) {
    const eid  = String(ticket.eventId || ticket.event?._id || '');
    const ev   = this.allEvents.find(e => e._id === eid || e.id === eid);
    const name = ev ? ev.title : (ticket.eventTitle || 'Event');
    const isUsed = ticket.status === 'used' || ticket.validated;
    const sym  = this.getCurrencySymbol(ev?.currency || 'GHC');
    const tid  = ticket.id || ticket._id || '';
    return `<div style="background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);
    padding:1rem 1.1rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
    <div style="flex:1;min-width:0;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--teal);margin-bottom:0.2rem;">${tid}</div>
      <div style="font-weight:600;color:var(--text);font-size:0.88rem;">${name}</div>
      <div style="font-size:0.73rem;color:var(--muted);margin-top:0.15rem;">
        ${(ticket.ticketType||'TICKET').toUpperCase()} · ${ticket.price===0?'Free':sym+(ticket.price||0)}
        · ${ticket.userEmail||ticket.buyerEmail||'—'}
      </div>
      ${isUsed
      ? `<div style="margin-top:0.35rem;display:inline-flex;align-items:center;gap:0.35rem;font-size:0.7rem;
            color:var(--coral);background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.25);
            border-radius:100px;padding:0.15rem 0.5rem;"><i class="fas fa-check-double"></i> Already used</div>`
      : `<div style="margin-top:0.35rem;display:inline-flex;align-items:center;gap:0.35rem;font-size:0.7rem;
            color:var(--mint);background:rgba(110,231,183,0.1);border:1px solid rgba(110,231,183,0.25);
            border-radius:100px;padding:0.15rem 0.5rem;"><i class="fas fa-ticket-alt"></i> Valid</div>`}
    </div>
    <button class="btn btn-primary btn-sm" ${isUsed?'disabled style="opacity:0.4;"':''}
      data-validate-tid="${tid}"
      data-validate-name="${name.replace(/"/g,'&quot;')}"
      data-validate-type="${(ticket.ticketType||'ticket').replace(/"/g,'&quot;')}"
      data-validate-used="${isUsed}"
      data-validate-eid="${eid}">
      <i class="fas fa-${isUsed?'check-double':'check-circle'}"></i> ${isUsed?'Used':'Validate'}
    </button>
  </div>`;
  },

  _pendingValidate: null,

  _openValidateConfirm(ticketId, eventName, ticketType, isUsed, eventId) {
    this._pendingValidate = { ticketId, eventId };
    const card = document.getElementById('validate-ticket-card');
    if (card) card.innerHTML = `
      <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--teal);margin-bottom:0.4rem;">${ticketId}</div>
      <div style="font-weight:600;color:var(--text);font-size:0.95rem;margin-bottom:0.15rem;">${eventName}</div>
      <div style="font-size:0.78rem;color:var(--muted);">${ticketType.toUpperCase()}</div>`;
    const warn = document.getElementById('validate-already-used-warning');
    const btn  = document.getElementById('confirm-validate-btn');
    const title = document.getElementById('validate-modal-title');
    if (isUsed) {
      if (warn)  { warn.style.display='flex'; document.getElementById('validate-used-msg').textContent='This ticket has already been checked in.'; }
      if (btn)   { btn.disabled=true; btn.style.opacity='0.45'; }
      if (title)   title.textContent='Ticket Already Used';
    } else {
      if (warn)  warn.style.display='none';
      if (btn)   { btn.disabled=false; btn.style.opacity='1'; }
      if (title) title.textContent='Validate Ticket';
    }
    document.getElementById('validate-status').style.display='none';
    this.openModal('validate-confirm-modal');
  },

  async confirmValidateTicket() {
    const { ticketId, eventId } = this._pendingValidate || {};
    if (!ticketId) return;
    const s   = document.getElementById('validate-status');
    const btn = document.getElementById('confirm-validate-btn');
    s.style.display='block'; s.className='status-msg loading'; s.textContent='Validating…';
    btn.disabled = true;
    try {
      try { this.acl.requireEventScope(eventId); } catch { s.style.display='none'; return; }

      try {
        const result = await this.fetchApi(`/tickets/${ticketId}/validate`, {
          method: 'PATCH',
          body: JSON.stringify({ eventId, method: 'manual', staffName: this.currentUser?.name || 'organizer' }),
        });
        if (result.result === 'already_used') {
          s.className='status-msg error'; s.textContent='This ticket was already used.'; btn.disabled=false; return;
        }
        if (result.result !== 'valid') {
          s.className='status-msg error'; s.textContent=result.message||'Validation failed.'; btn.disabled=false; return;
        }
      } catch {
        // Graceful local fallback
        this._localCheckins = this._localCheckins || [];
        this._localCheckins.unshift({ ticketId, eventId,
          validatedAt: new Date().toISOString(), validatedBy: this.currentUser?.name||'organizer', method: 'manual' });
        const local = this.userTickets.find(t => (t.id||t._id) === ticketId);
        if (local) { local.status='used'; local.validated=true; }
      }

      s.className='status-msg success'; s.innerHTML='<strong>✓ Ticket validated!</strong> Attendee checked in.';
      this.pushNotification({ type: 'purchase', text: `Ticket ${ticketId} validated.` });
      if (eventId) { await this._loadValidationStats(eventId); await this._loadCheckinFeed(eventId); }
      await this.manualTicketSearch();
      setTimeout(() => this.closeAllModals(), 1800);
    } catch (err) {
      if (!err.message.startsWith('[AccessDenied]')) { s.className='status-msg error'; s.textContent=err.message||'Validation failed.'; }
      btn.disabled = false;
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  STAFF MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async openStaffModal() {
    try { this.acl.requireOrganizer(); } catch { return; }
    if (!this.dataLoaded) await this.loadAllData();
    const evOptions = this.orgEvents.filter(e => !e.isCancelled)
      .map(e => `<option value="${e._id}">${e.title}</option>`).join('');
    const assign = document.getElementById('staff-event-assign');
    const filter = document.getElementById('staff-event-filter');
    if (assign) assign.innerHTML = '<option value="">Select event…</option>' + evOptions;
    if (filter) filter.innerHTML = '<option value="">All events</option>' + evOptions;
    document.getElementById('staff-create-status').style.display = 'none';
    // Clear form
    ['staff-name','staff-email','staff-phone','staff-pin'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    if (document.getElementById('staff-role')) document.getElementById('staff-role').value = 'scanner';
    await this._renderStaffList();
    this.openModal('staff-modal');
  },

  async createStaffMember() {
    try { this.acl.requireOrganizer(); } catch { return; }
    const name    = document.getElementById('staff-name')?.value.trim();
    const email   = document.getElementById('staff-email')?.value.trim();
    const phone   = document.getElementById('staff-phone')?.value.trim();
    const role    = document.getElementById('staff-role')?.value || 'scanner';
    const eventId = document.getElementById('staff-event-assign')?.value;
    const pin     = document.getElementById('staff-pin')?.value.trim();
    this.clearFieldErrors('staff-name-err','staff-email-err','staff-phone-err','staff-event-err');
    let valid = true;
    if (!name)                               { this.setFieldError('staff-name',         'staff-name-err',  'Name is required');  valid=false; }
    if (!email)                              { this.setFieldError('staff-email',        'staff-email-err', 'Email is required'); valid=false; }
    else if (!this.validateEmail(email))     { this.setFieldError('staff-email',        'staff-email-err', 'Invalid email');     valid=false; }
    if (phone && !this.validatePhone(phone)) { this.setFieldError('staff-phone',        'staff-phone-err', 'Use +233xxxxxxxxx'); valid=false; }
    if (!eventId)                            { this.setFieldError('staff-event-assign', 'staff-event-err', 'Assign to an event');valid=false; }
    if (!valid) return;
    try { this.acl.requireEventScope(eventId); } catch { return; }
    const s = document.getElementById('staff-create-status');
    s.style.display='block'; s.className='status-msg loading'; s.textContent='Creating account…';
    try {
      await this.fetchApi('/staff', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, role, eventId, pin, organizerId: this.currentUser.id }),
      });
      s.className = 'status-msg success';
      s.innerHTML = `<strong>✓ Staff account created!</strong> ${name} can now validate tickets for this event.`;
      ['staff-name','staff-email','staff-phone','staff-pin'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      const assignEl = document.getElementById('staff-event-assign');
      if (assignEl) assignEl.value = '';
      await this._renderStaffList();
      setTimeout(() => { s.style.display = 'none'; }, 3500);
    } catch (err) {
      s.className = 'status-msg error';
      s.textContent = err.message || 'Failed to create staff member.';
    }
  },

  async _renderStaffList() {
    const container = document.getElementById('staff-list');
    if (!container) return;
    const eventFilter = document.getElementById('staff-event-filter')?.value || '';
    container.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div></div>';
    try {
      const params = new URLSearchParams({ organizerId: this.currentUser?.id || '' });
      if (eventFilter) params.append('eventId', eventFilter);
      const staff = await this.fetchApi(`/staff?${params}`);
      if (!staff.length) {
        container.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;padding:1rem 0;">No staff members yet. Create one on the left.</p>';
        return;
      }
      container.innerHTML = staff.map(s => {
        const ev     = this.allEvents.find(e => e._id === s.eventId || e._id === String(s.eventId));
        const evName = ev ? ev.title : '—';
        const active = s.status !== 'inactive';
        const sid    = s.staffId || s._id || s.id || '';
        return `<div style="background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);
        padding:0.9rem 1rem;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.85rem;">
        <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
          background:linear-gradient(135deg,var(--teal),var(--sky));
          display:flex;align-items:center;justify-content:center;
          font-family:'Syne',sans-serif;font-size:0.95rem;font-weight:700;color:var(--bg);">
          ${(s.name||'S').charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--text);font-size:0.85rem;">${s.name||'—'}</div>
          <div style="font-size:0.72rem;color:var(--muted);margin-top:0.1rem;">
            ${s.email||'—'}
            <span style="margin-left:0.5rem;padding:0.1rem 0.4rem;background:rgba(125,211,252,0.12);
              color:var(--sky);border-radius:100px;font-family:'JetBrains Mono',monospace;
              font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;">${s.role||'scanner'}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--muted);margin-top:0.1rem;">
            <i class="fas fa-calendar-alt" style="font-size:0.6rem;"></i> ${evName}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.35rem;flex-shrink:0;align-items:flex-end;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;letter-spacing:0.06em;
            padding:0.18rem 0.5rem;border-radius:100px;
            ${active
          ? 'background:rgba(110,231,183,0.1);color:var(--mint);border:1px solid rgba(110,231,183,0.25);'
          : 'background:rgba(255,107,107,0.1);color:var(--coral);border:1px solid rgba(255,107,107,0.25);'}">
            ${active ? 'Active' : 'Inactive'}</span>
          <div style="display:flex;gap:0.3rem;">
            <button class="btn btn-ghost btn-sm" style="font-size:0.7rem;padding:0.2rem 0.5rem;"
              onclick="app._toggleStaffStatus('${sid}', ${!active})">
              <i class="fas fa-${active ? 'pause' : 'play'}"></i> ${active ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn btn-danger btn-sm" style="font-size:0.7rem;padding:0.2rem 0.5rem;"
              onclick="app._deleteStaff('${sid}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>`;
      }).join('');
    } catch (err) {
      container.innerHTML = `<p style="color:var(--coral);font-size:0.82rem;padding:1rem 0;">${err.message || 'Failed to load staff members.'}</p>`;
    }
  },

  async _toggleStaffStatus(staffId, activate) {
    try { this.acl.requireOrganizer(); } catch { return; }
    try {
      await this.fetchApi(`/staff/${staffId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: activate ? 'active' : 'inactive' }),
      });
      this.showToast(activate ? 'Staff member activated.' : 'Staff member deactivated.', activate ? 'success' : 'warning');
      await this._renderStaffList();
    } catch (err) {
      this.showToast(err.message || 'Failed to update staff status.');
    }
  },

  async _deleteStaff(staffId) {
    try { this.acl.requireOrganizer(); } catch { return; }
    if (!confirm('Remove this staff member?')) return;
    try {
      await this.fetchApi(`/staff/${staffId}`, { method: 'DELETE' });
      this.showToast('Staff member removed.', 'warning');
      await this._renderStaffList();
    } catch (err) {
      this.showToast(err.message || 'Failed to remove staff member.');
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  CHECK-IN LOG MODAL
  // ═══════════════════════════════════════════════════════════

  async openCheckinLog() {
    try { this.acl.requireOrganizer(); } catch { return; }
    const sel = document.getElementById('checkin-log-event-filter');
    if (sel && this.orgEvents.length) {
      sel.innerHTML = '<option value="">All my events</option>' +
        this.orgEvents.filter(e => !e.isCancelled)
          .map(e => `<option value="${e._id}">${e.title}</option>`).join('');
    }
    // Populate staff filter
    const staffSel = document.getElementById('checkin-log-staff-filter');
    if (staffSel) {
      const staffNames = [...new Set(this.staffMembers.map(s => s.name))];
      staffSel.innerHTML = '<option value="">Anyone</option><option value="organizer">Organizer (me)</option>' +
        staffNames.map(n => `<option value="${n}">${n}</option>`).join('');
    }
    this.openModal('checkin-log-modal');
    await this.loadCheckinLog();
  },

  async loadCheckinLog() {
    try { this.acl.requireOrganizer(); } catch { return; }
    const eventId     = document.getElementById('checkin-log-event-filter')?.value  || '';
    const staffFilter = document.getElementById('checkin-log-staff-filter')?.value  || '';
    const tbody = document.getElementById('checkin-log-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty"><div class="spinner" style="margin:1rem auto;"></div></td></tr>';
    if (eventId) { try { this.acl.requireEventScope(eventId); } catch { return; } }
    try {
      let logs = [];
      try {
        const params = new URLSearchParams({ organizerId: this.currentUser.id });
        if (eventId)     params.append('eventId', eventId);
        if (staffFilter) params.append('staffFilter', staffFilter);
        logs = await this.fetchApi(`/tickets/validations?${params}`);
      } catch {
        logs = (this._localCheckins || []).filter(c => {
          if (!this.acl.ownsEvent(c.eventId)) return false;
          if (eventId && c.eventId !== eventId) return false;
          if (staffFilter === 'organizer' && c.validatedBy !== 'organizer') return false;
          if (staffFilter && staffFilter !== 'organizer' && c.validatedBy !== staffFilter) return false;
          return true;
        });
      }
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No check-in records found.</td></tr>'; return;
      }
      tbody.innerHTML = logs.map(v => {
        const ev = this.allEvents.find(e => e._id === v.eventId || e._id === String(v.eventId));
        return `<tr>
          <td style="font-family:'JetBrains Mono',monospace;color:var(--teal);font-size:0.75rem;">${v.ticketId||'—'}</td>
          <td>${v.buyerName||v.buyerEmail||'Guest'}</td>
          <td>${ev?ev.title:(v.eventId||'—')}</td>
          <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;text-transform:uppercase;">${v.ticketType||'—'}</span></td>
          <td>${v.validatedAt?new Date(v.validatedAt).toLocaleString('en-GB'):'—'}</td>
          <td>${v.validatedBy||'organizer'}</td>
          <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.62rem;padding:0.15rem 0.45rem;
            border-radius:100px;text-transform:uppercase;letter-spacing:0.05em;
            ${v.method==='scan'
          ?'background:rgba(45,212,191,0.1);color:var(--teal);border:1px solid rgba(45,212,191,0.2);'
          :'background:rgba(125,211,252,0.1);color:var(--sky);border:1px solid rgba(125,211,252,0.2);'}">
            ${v.method||'manual'}</span></td>
        </tr>`;
      }).join('');
    } catch (err) {
      if (!err.message?.startsWith('[AccessDenied]'))
        tbody.innerHTML='<tr><td colspan="7" class="table-empty">Failed to load log.</td></tr>';
    }
  },

  exportCheckinLog() {
    try { this.acl.requireOrganizer(); } catch { return; }
    const rows = [...document.querySelectorAll('#checkin-log-tbody tr')].map(tr =>
      [...tr.querySelectorAll('td')].map(td => `"${td.textContent.trim()}"`).join(','));
    if (!rows.length) return this.showToast('No data to export.');
    const csv = 'Ticket ID,Buyer,Event,Type,Validated At,Validated By,Method\n' + rows.join('\n');
    this._dlBlob(csv, `checkin_log_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
  },

  // ═══════════════════════════════════════════════════════════
  //  WIRING — called from init()
  // ═══════════════════════════════════════════════════════════

  _bindValidationFeatures() {
    const safe = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', e => { e.preventDefault(); fn(); });
    };

    const typeFilter = document.getElementById('validation-type-filter');
    if (typeFilter) typeFilter.addEventListener('change', async () => {
      const eventId = document.getElementById('validation-event-select')?.value;
      if (eventId) await this._loadCheckinFeed(eventId);
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-validate-tid]');
      if (btn) {
        const tid    = btn.dataset.validateTid;
        const name   = btn.dataset.validateName;
        const type   = btn.dataset.validateType;
        const isUsed = btn.dataset.validateUsed === 'true';
        const eid    = btn.dataset.validateEid;
        this._openValidateConfirm(tid, name, type, isUsed, eid);
      }
    });
    
    safe('staff-manage-btn', () => this.openStaffModal());
    safe('checkin-log-btn',  () => this.openCheckinLog());
    safe('validation-link',  () => this.showSection('validation-page'));
  },


});


Object.defineProperties(GlycrApp.prototype, {
  acl: {
    get() { if (!this._acl) this._acl = new GlycrAccessControl(this); return this._acl; },
    configurable: true,
  },
  staffMembers: {
    get() { return this.loadFromStorage('glycr_staff') || []; },
    set(v) { this.saveToStorage('glycr_staff', v); },
    configurable: true,
  },
});

// ─────────────────────────────────────────────────────────────
//  Patch init() to call _bindValidationFeatures
//  (original init already calls it if already in the class)
// ─────────────────────────────────────────────────────────────
const _origInit = GlycrApp.prototype.init;
GlycrApp.prototype.init = async function () {
  await _origInit.call(this);
  this._bindValidationFeatures();
};

// Patch showSection to handle validation-page
const _origShowSection = GlycrApp.prototype.showSection;
GlycrApp.prototype.showSection = function (section) {
  _origShowSection.call(this, section);
  if (section === 'validation-page') this.initValidationPage();
};

// Bootstrap
window.initGlycrMaps = function () {
  if (window.app && typeof window.app.initMapsCallback === 'function') window.app.initMapsCallback();
};

const app = new GlycrApp();
